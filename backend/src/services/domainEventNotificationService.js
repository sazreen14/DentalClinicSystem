import { db } from "../config/database.js";
import { listActiveAdminUserIds } from "../models/notificationModel.js";
import { createNotification } from "./notificationService.js";

export async function runBestEffortNotification(eventName, task) {
  try {
    await task();
    return true;
  } catch (error) {
    if (process.env.NODE_ENV !== "test") {
      console.error("Notification dispatch failed", {
        event: eventName,
        error: error?.code || error?.name || "UNKNOWN_ERROR",
      });
    }
    return false;
  }
}

async function notifyAdmins(values) {
  const adminIds = await listActiveAdminUserIds(db);
  await Promise.all(adminIds.map((recipientUserId) => createNotification(db, { ...values, recipientUserId })));
}

export function appointmentBooked(appointment) {
  return runBestEffortNotification("APPOINTMENT_BOOKED", () => notifyAdmins({
    type: "new-appointment", title: "New appointment awaiting confirmation",
    message: `${appointment.patientName} booked ${appointment.service} with ${appointment.doctorName} on ${appointment.date} at ${appointment.time}.`,
    relatedRoute: "/admin-appointments", relatedEntityType: "Appointment", relatedEntityId: appointment.id,
  }));
}

export function appointmentConfirmed(appointment, patientUserId) {
  return runBestEffortNotification("APPOINTMENT_CONFIRMED", () => createNotification(db, {
    recipientUserId: patientUserId, type: "appointment-confirmed", title: "Appointment confirmed",
    message: `Your ${appointment.service} appointment on ${appointment.date} at ${appointment.time} has been confirmed.`,
    relatedRoute: "/patient-appointments", relatedEntityType: "Appointment", relatedEntityId: appointment.id,
  }));
}

export function appointmentRescheduled(appointment, patientUserId) {
  return runBestEffortNotification("APPOINTMENT_RESCHEDULED", () => createNotification(db, {
    recipientUserId: patientUserId, type: "appointment-rescheduled", title: "Appointment rescheduled",
    message: `Your ${appointment.service} appointment has been moved to ${appointment.date} at ${appointment.time}.`,
    relatedRoute: "/patient-appointments", relatedEntityType: "Appointment", relatedEntityId: appointment.id,
  }));
}
export function appointmentRescheduledByPatient(appointment) {
  return runBestEffortNotification("APPOINTMENT_RESCHEDULED_BY_PATIENT", () => notifyAdmins({
    type: "reschedule-request", title: "Appointment rescheduled by patient",
    message: `${appointment.patientName} selected a new time for ${appointment.date} at ${appointment.time}; staff confirmation is required.`,
    relatedRoute: "/admin-appointments", relatedEntityType: "Appointment", relatedEntityId: appointment.id,
  }));
}

export function appointmentCancelledByPatient(appointment) {
  return runBestEffortNotification("APPOINTMENT_CANCELLED_BY_PATIENT", () => notifyAdmins({
    type: "appointment-cancelled", title: "Patient cancelled appointment",
    message: `${appointment.patientName} cancelled the ${appointment.service} appointment scheduled for ${appointment.date} at ${appointment.time}.`,
    relatedRoute: "/admin-appointments", relatedEntityType: "Appointment", relatedEntityId: appointment.id,
  }));
}

export function appointmentCancelledByAdmin(appointment, patientUserId) {
  return runBestEffortNotification("APPOINTMENT_CANCELLED_BY_ADMIN", () => createNotification(db, {
    recipientUserId: patientUserId, type: "appointment-cancelled", title: "Appointment cancelled",
    message: `Your ${appointment.service} appointment on ${appointment.date} at ${appointment.time} was cancelled by the clinic.`,
    relatedRoute: "/patient-appointments", relatedEntityType: "Appointment", relatedEntityId: appointment.id,
  }));
}

export function clinicalNoteAdded({ patientUserId, patientId, treatment }) {
  return runBestEffortNotification("CLINICAL_NOTE_ADDED", () => createNotification(db, {
    recipientUserId: patientUserId, type: "record-updated", title: "Clinical record updated",
    message: `A new ${treatment} clinical entry was added to your dental record.`,
    relatedRoute: "/patient-records", relatedEntityType: "Patient", relatedEntityId: patientId,
  }));
}
