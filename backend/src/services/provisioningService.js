import bcrypt from "bcrypt";
import { db } from "../config/database.js";
import { env } from "../config/env.js";
import { writeAudit } from "./auditService.js";

export const DEVELOPMENT_ACCOUNTS = Object.freeze({
  doctor: Object.freeze({
    userId: "USR-DEV-DOCTOR",
    doctorId: "DOC-DEV-ROSNI",
    fullName: "Dr. Rosni binti Adam",
    email: "doctor.dev@dentalclinic.local",
    role: "Doctor",
    professionalTitle: "Dental Surgeon",
    specialization: null,
    licenseNumber: "PENDING-VERIFICATION-ROSNI",
    qualification: "Bachelor of Dental Surgery",
    yearsOfExperience: 12,
  }),
  doctorB: Object.freeze({
    userId: "USR-DEV-DOCTOR-B",
    doctorId: "DOC-DEV-DOCTOR-B",
    fullName: "Dr. Muhammad Nur Syahidi bin Sahnon",
    email: "doctor.b.dev@dentalclinic.local",
    role: "Doctor",
    professionalTitle: "Dentist",
    specialization: "General",
    licenseNumber: "PENDING-VERIFICATION-SYAHIDI",
    qualification: null,
    yearsOfExperience: null,
  }),
  admin: Object.freeze({
    userId: "USR-DEV-ADMIN",
    fullName: "Clinic Admin",
    email: "admin.dev@dentalclinic.local",
    role: "Admin",
  }),
});

function assertSeedPassword(name, value) {
  if (!value || value.length < 8 || !/[A-Z]/.test(value) || !/[a-z]/.test(value) || !/[0-9]/.test(value)) {
    throw new Error(`${name} must contain at least 8 characters with uppercase, lowercase, and a number`);
  }
}

async function findProvisionedUser(connection, account) {
  const [rows] = await connection.execute(
    "SELECT id, user_id, email, role, account_status FROM users WHERE email = ? OR user_id = ? FOR UPDATE",
    [account.email, account.userId],
  );
  if (rows.length > 1) throw new Error(`Conflicting development identity for ${account.role}`);
  const user = rows[0] ?? null;
  if (user && (user.email !== account.email || user.user_id !== account.userId || user.role !== account.role)) {
    throw new Error(`Existing account conflicts with the approved ${account.role} development identity`);
  }
  return user;
}

async function ensureUser(connection, account, passwordHash, overwritePasswords) {
  const existing = await findProvisionedUser(connection, account);
  if (!existing) {
    const [result] = await connection.execute(
      "INSERT INTO users (user_id, full_name, email, password_hash, role, account_status) VALUES (?, ?, ?, ?, ?, 'Active')",
      [account.userId, account.fullName, account.email, passwordHash, account.role],
    );
    return { id: result.insertId, action: "created", accountStatus: "Active" };
  }
  if (overwritePasswords) {
    await connection.execute("UPDATE users SET full_name = ?, password_hash = ? WHERE id = ?", [account.fullName, passwordHash, existing.id]);
    return { id: existing.id, action: "updated", accountStatus: existing.account_status };
  }
  await connection.execute("UPDATE users SET full_name = ? WHERE id = ?", [account.fullName, existing.id]);
  return { id: existing.id, action: "skipped-existing", accountStatus: existing.account_status };
}

async function ensureDoctorProfile(connection, userId, doctor) {
  const [rows] = await connection.execute(
    "SELECT id, user_id, doctor_id, license_number FROM doctors WHERE user_id = ? OR doctor_id = ? OR license_number = ? FOR UPDATE",
    [userId, doctor.doctorId, doctor.licenseNumber],
  );
  if (rows.some((row) => Number(row.user_id) !== Number(userId))) throw new Error("Doctor ID or license is already assigned to another account");
  if (!rows.length) {
    await connection.execute(
      `INSERT INTO doctors (doctor_id, user_id, professional_title, specialization, license_number, qualification, years_of_experience)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [doctor.doctorId, userId, doctor.professionalTitle, doctor.specialization, doctor.licenseNumber, doctor.qualification, doctor.yearsOfExperience],
    );
    return "created";
  }
  await connection.execute(
    `UPDATE doctors SET professional_title = ?, specialization = ?, license_number = ?, qualification = ?, years_of_experience = ?
      WHERE user_id = ?`,
    [doctor.professionalTitle, doctor.specialization, doctor.licenseNumber, doctor.qualification, doctor.yearsOfExperience, userId],
  );
  return "synchronized";
}

async function ensureDefaultDoctorHours(connection, userId) {
  const [[doctor]] = await connection.execute("SELECT id FROM doctors WHERE user_id = ? LIMIT 1", [userId]);
  await connection.execute(
    `INSERT INTO doctor_working_hours (doctor_id, day_of_week, is_working, start_time, end_time)
     SELECT ?, day_of_week, is_open, opening_time, closing_time FROM clinic_operating_hours
     ON DUPLICATE KEY UPDATE doctor_id = VALUES(doctor_id)`,
    [doctor.id],
  );
}

async function provisionOne(account, password, overwritePasswords, { seedDefaultWorkingHours = false, passwordVariableName = `SEED_${account.role.toUpperCase()}_PASSWORD` } = {}) {
  assertSeedPassword(passwordVariableName, password);
  const passwordHash = await bcrypt.hash(password, env.bcryptSaltRounds);
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const user = await ensureUser(connection, account, passwordHash, overwritePasswords);
    const profileAction = account.role === "Doctor" ? await ensureDoctorProfile(connection, user.id, account) : "not-required";
    if (seedDefaultWorkingHours) await ensureDefaultDoctorHours(connection, user.id);
    if (user.action !== "skipped-existing" || profileAction === "created") {
      await writeAudit({
        userId: user.id,
        eventType: "DEVELOPMENT_ACCOUNT_PROVISIONED",
        outcome: "Success",
        ipAddress: "provisioning-cli",
        metadata: { role: account.role, userAction: user.action, profileAction },
      }, connection);
    }
    await connection.commit();
    return { role: account.role, userId: account.userId, action: user.action, profileAction, accountStatus: user.accountStatus };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function provisionDevelopmentAccounts({ doctorPassword, adminPassword, overwritePasswords = false }) {
  if (env.nodeEnv === "production") throw new Error("Development account provisioning is disabled in production");
  const doctor = await provisionOne(DEVELOPMENT_ACCOUNTS.doctor, doctorPassword, overwritePasswords);
  const admin = await provisionOne(DEVELOPMENT_ACCOUNTS.admin, adminPassword, overwritePasswords);
  return { doctor, admin };
}

export async function provisionTemporaryDoctorB({ password, passwordVariableName = "SEED_DOCTOR_B_PASSWORD", overwritePasswords = false }) {
  if (env.nodeEnv === "production") throw new Error("Development account provisioning is disabled in production");
  return provisionOne(DEVELOPMENT_ACCOUNTS.doctorB, password, overwritePasswords, { seedDefaultWorkingHours:true, passwordVariableName });
}
