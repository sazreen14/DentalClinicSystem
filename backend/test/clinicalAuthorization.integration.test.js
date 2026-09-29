import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { db } from "../src/config/database.js";
import { doctorHasPatient, doctorPatients } from "../src/models/clinicalRecordsModel.js";
import { cleanupKnownIntegrationFixtures } from "./helpers/databaseFixtureCleanup.js";

const tag = Date.now().toString(36).toUpperCase();
const ids = { users: [], patients: [], doctors: [], appointments: [], records: [], service: null };
let cleaned = false;
async function cleanup() { if (!cleaned) { await cleanupKnownIntegrationFixtures(db, { family: "security", tag }); cleaned = true; } }

async function createUser(role, suffix) {
  const [result] = await db.execute("INSERT INTO users(email_verified_at,user_id,full_name,email,password_hash,role) VALUES(CURRENT_TIMESTAMP,?,?,?,?,?)", [`SEC-${suffix}-${tag}`, `Security ${suffix}`, `security.${suffix}.${tag}@example.test`, "$2b$12$syntheticSecurityHashOnly000000000000000000000000000", role]);
  ids.users.push(result.insertId); return result.insertId;
}

before(async () => {
  const doctorUser = await createUser("Doctor", "DOC");
  const unrelatedUser = await createUser("Doctor", "OTHERDOC");
  let result;
  [result] = await db.execute("INSERT INTO doctors(doctor_id,user_id,professional_title,license_number) VALUES(?,?,?,?)", [`DOC-SEC-${tag}`, doctorUser, "Dentist", `LIC-SEC-${tag}`]); ids.doctors.push(result.insertId);
  [result] = await db.execute("INSERT INTO doctors(doctor_id,user_id,professional_title,license_number) VALUES(?,?,?,?)", [`DOC-SEC-OTHER-${tag}`, unrelatedUser, "Dentist", `LIC-SEC-OTHER-${tag}`]); ids.doctors.push(result.insertId);
  [result] = await db.execute("INSERT INTO dental_services(service_code,name,duration_minutes,status) VALUES(?,?,30,'Active')", [`SVC-SEC-${tag}`, "Security Test Service"]); ids.service = result.insertId;
  for (const suffix of ["PENDING", "CONFIRMED", "COMPLETED", "CANCELLED", "RECORD", "UNRELATED"]) {
    const userId = await createUser("Patient", suffix);
    [result] = await db.execute("INSERT INTO patients(patient_id,user_id,date_of_birth,gender,phone_ciphertext,phone_blind_index,phone_key_version,registration_date) VALUES(?,?,?,'Female',?,?,1,CURRENT_DATE)", [`PT-SEC-${suffix}-${tag}`, userId, "1990-01-01", "encrypted-only", `${suffix}${tag}`.padEnd(64, "0").slice(0,64)]); ids.patients.push(result.insertId);
  }
  for (const [index,status] of ["Pending","Confirmed","Completed","Cancelled"].entries()) {
    [result] = await db.execute("INSERT INTO appointments(appointment_id,patient_id,doctor_id,dental_service_id,appointment_date,appointment_time,status,booking_source) VALUES(?,?,?,?,CURRENT_DATE,? ,?,'Admin')", [`APT-SEC-${status}-${tag}`, ids.patients[index], ids.doctors[0], ids.service, `${9+index}:00`, status]); ids.appointments.push(result.insertId);
  }
  [result] = await db.execute("INSERT INTO clinical_records(record_id,patient_id,doctor_id) VALUES(?,?,?)", [`REC-SEC-${tag}`, ids.patients[4], ids.doctors[0]]); ids.records.push(result.insertId);
});

after(cleanup);

test("valid appointment and historical clinical relationships grant access", async () => {
  for (const patientId of ids.patients.slice(0,3)) assert.equal(await doctorHasPatient(db, ids.doctors[0], patientId), true);
  assert.equal(await doctorHasPatient(db, ids.doctors[0], ids.patients[4]), true);
  const directory = await doctorPatients(db, ids.doctors[0]);
  const codes = new Set(directory.map((row) => row.patient_id));
  for (const suffix of ["PENDING","CONFIRMED","COMPLETED","RECORD"]) assert.ok(codes.has(`PT-SEC-${suffix}-${tag}`));
});

test("cancelled-only and unrelated Doctor relationships are denied", async () => {
  assert.equal(await doctorHasPatient(db, ids.doctors[0], ids.patients[3]), false);
  assert.equal(await doctorHasPatient(db, ids.doctors[1], ids.patients[0]), false);
  const directory = await doctorPatients(db, ids.doctors[0]);
  assert.equal(directory.some((row) => row.patient_id === `PT-SEC-CANCELLED-${tag}`), false);
});
test("clinical authorization fixtures are removed", cleanup);
import './helpers/requireTestDatabase.js';
