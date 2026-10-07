import { env } from "../config/env.js";
import { findDoctorForUser } from "../models/appointmentModel.js";
import { getServices } from "../models/clinicOperationsModel.js";
import { clinicClock, getAvailability, assertAvailable } from "./appointmentAvailabilityService.js";
import { inTransaction } from "./authService.js";
import { writeAudit } from "./auditService.js";
import { AppError } from "../utils/AppError.js";

async function ownDoctor(executor, userId) {
  const doctor = await findDoctorForUser(executor, userId);
  if (!doctor) throw new AppError("Doctor profile is unavailable.", 403, "DOCTOR_PROFILE_REQUIRED");
  return doctor;
}

async function shortestService(executor) {
  // Booking's only service-dependent availability rule is duration. If any
  // active service fits, the shortest fits; still use booking's exact checks.
  const services = await getServices(executor, true);
  return services.sort((a, b) => Number(a.duration_minutes) - Number(b.duration_minutes) || a.service_code.localeCompare(b.service_code))[0];
}

async function todayBlocks(executor, doctorId, date) {
  const [rows] = await executor.execute(
    "SELECT id, start_time, end_time FROM doctor_blocked_times WHERE doctor_id = ? AND blocked_date = ? ORDER BY start_time",
    [doctorId, date],
  );
  return rows.map(row => ({ id: Number(row.id), date, start: row.start_time.slice(0, 5), end: row.end_time.slice(0, 5) }));
}

export async function doctorTodayAvailability(executor, userId, now = new Date()) {
  const doctor = await ownDoctor(executor, userId);
  const { date } = clinicClock(now);
  const service = await shortestService(executor);
  const blockedTimes = await todayBlocks(executor, doctor.id, date);
  let slots = [];
  if (service && env.bookingDoctorIds.has(doctor.doctor_id)) {
    try {
      ({ slots } = await getAvailability(executor, { doctorCode: doctor.doctor_id, serviceCode: service.service_code, date, now }));
    } catch (error) {
      if (error.code !== "DOCTOR_UNAVAILABLE" && error.code !== "SERVICE_UNAVAILABLE") throw error;
    }
  }
  return {
    date, slots, blockedTimes, durationMinutes: service ? Number(service.duration_minutes) : null,
    generatedAt: now.toISOString(), expiresAt: new Date(Math.floor(now.getTime() / 60000) * 60000 + 60000).toISOString(),
  };
}

export async function blockDoctorToday(userId, input, ipAddress = "unknown") {
  await inTransaction(async executor => {
    const now = new Date();
    const { date } = clinicClock(now);
    if (input.date !== date) throw new AppError("Today has changed. Reload the available slots.", 409, "AVAILABILITY_DATE_CHANGED");
    const doctor = await ownDoctor(executor, userId);
    const service = await shortestService(executor);
    if (!service) throw new AppError("No available time slots for today.", 409, "APPOINTMENT_SLOT_UNAVAILABLE");
    await assertAvailable(executor, { doctorCode: doctor.doctor_id, serviceCode: service.service_code, date, time: input.time, now });
    const [hour, minute] = input.time.split(":").map(Number);
    const endMinutes = hour * 60 + minute + Number(service.duration_minutes);
    const end = `${String(Math.floor(endMinutes / 60)).padStart(2, "0")}:${String(endMinutes % 60).padStart(2, "0")}`;
    const [result] = await executor.execute(
      "INSERT INTO doctor_blocked_times (doctor_id, blocked_date, start_time, end_time, reason) VALUES (?, ?, ?, ?, ?)",
      [doctor.id, date, input.time, end, "Blocked by doctor"],
    );
    await writeAudit({ userId, eventType: "DOCTOR_TIME_BLOCKED", outcome: "Success", ipAddress, metadata: { blockId: result.insertId, date, start: input.time, end } }, executor);
  });
}

export async function unblockDoctorToday(userId, blockId, ipAddress = "unknown") {
  await inTransaction(async executor => {
    const doctor = await ownDoctor(executor, userId);
    const { date } = clinicClock();
    const [result] = await executor.execute(
      "DELETE FROM doctor_blocked_times WHERE id = ? AND doctor_id = ? AND blocked_date = ?",
      [blockId, doctor.id, date],
    );
    if (!result.affectedRows) throw new AppError("Today's blocked slot was not found.", 404, "BLOCKED_TIME_NOT_FOUND");
    await writeAudit({ userId, eventType: "DOCTOR_TIME_UNBLOCKED", outcome: "Success", ipAddress, metadata: { blockId: Number(blockId), date } }, executor);
  });
}
