import { verifyFixtureEmail } from "./helpers/verifyFixtureEmail.js";
import './helpers/requireTestDatabase.js';
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { randomBytes } from 'node:crypto';
import { unlink } from 'node:fs/promises';
import path from 'node:path';
import bcrypt from 'bcrypt';
import app from '../src/app.js';
import { db } from '../src/config/database.js';
import { encryptField } from '../src/services/fieldEncryptionService.js';
import { createAccessToken } from '../src/services/tokenService.js';
import { photoDirectory } from '../src/services/patientPhotoService.js';

const tag = randomBytes(5).toString('hex').toUpperCase();
const password = `Synthetic9-${randomBytes(16).toString('hex')}`;
const users = [];
const patients = [];
const doctors = [];
let server, base, patientA, patientB, doctor, otherDoctor, admin;
let serviceId, appointmentId, recordId, invoiceId, photoKey;
const appointmentCode = `APT-ISO-${tag}`;
const recordCode = `REC-ISO-${tag}`;
const invoiceCode = `INV-ISO-${tag}`;
const notificationCode = `NTF-${tag.padEnd(20, '0')}`;

async function call(route, { token, cookie, method = 'GET', body } = {}) {
  const response = await fetch(`${base}/api${route}`, {
    method,
    headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(cookie ? { cookie } : {}), ...(body ? { 'content-type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = response.headers.get('content-type')?.includes('application/json') ? await response.json() : null;
  return { status: response.status, data, cookie: response.headers.get('set-cookie')?.split(';')[0] };
}

async function register(suffix) {
  const email = `isolation.${tag}.${suffix}@example.test`;
  const result = await call('/auth/register/patient', { method: 'POST', body: {
    fullName: `Synthetic Isolation ${suffix}`, email, password,
    identityNumber: `ISO-${tag}-${suffix}`, dateOfBirth: '1990-01-01', gender: 'Female',
    phone: '+60123456789', address: 'Synthetic test address',
  } });
  assert.equal(result.status, 201);
  const [[row]] = await db.execute('SELECT u.id,p.id patient_db_id,p.patient_id FROM users u JOIN patients p ON p.user_id=u.id WHERE u.email=?', [email]);
  users.push(row.id); patients.push(row.patient_db_id);
  await verifyFixtureEmail(email);
  return { ...row, email };
}

async function staff(role, suffix) {
  const [result] = await db.execute('INSERT INTO users(email_verified_at,user_id,full_name,email,password_hash,role) VALUES(CURRENT_TIMESTAMP,?,?,?,?,?)',
    [`USR-ISO-${suffix}-${tag}`, `Synthetic ${suffix}`, `isolation.${suffix}.${tag}@example.test`, await bcrypt.hash(password, 10), role]);
  users.push(result.insertId);
  const user = { id: result.insertId, user_id: `USR-ISO-${suffix}-${tag}`, role };
  if (role === 'Doctor') {
    const [row] = await db.execute("INSERT INTO doctors(doctor_id,user_id,professional_title,license_number) VALUES(?,?,'Dentist',?)", [`DOC-ISO-${suffix}-${tag}`, user.id, `ISO-${suffix}-${tag}`]);
    doctors.push(row.insertId); user.doctorId = row.insertId;
  }
  return { ...user, token: createAccessToken(user) };
}

async function login(patient) {
  const result = await call('/auth/login', { method: 'POST', body: { email: patient.email, password } });
  assert.equal(result.status, 200);
  return { token: result.data.accessToken, cookie: result.cookie };
}

before(async () => {
  await new Promise(resolve => { server = app.listen(0, '127.0.0.1', () => { base = `http://127.0.0.1:${server.address().port}`; resolve(); }); });
  patientA = await register('A'); patientB = await register('B');
  doctor = await staff('Doctor', 'D'); otherDoctor = await staff('Doctor', 'OTHER'); admin = await staff('Admin', 'ADMIN');
  const [service] = await db.execute("INSERT INTO dental_services(service_code,name,duration_minutes,status) VALUES(?, 'Synthetic isolation service',30,'Active')", [`SVC-ISO-${tag}`]);
  serviceId = service.insertId;
  const [appointment] = await db.execute("INSERT INTO appointments(appointment_id,patient_id,doctor_id,dental_service_id,appointment_date,appointment_time,status) VALUES(?,?,?,?,DATE_ADD(CURRENT_DATE, INTERVAL 7 DAY),'10:00','Confirmed')", [appointmentCode, patientA.patient_db_id, doctor.doctorId, serviceId]);
  appointmentId = appointment.insertId;
  const [record] = await db.execute('INSERT INTO clinical_records(record_id,patient_id,doctor_id,appointment_id) VALUES(?,?,?,?)', [recordCode, patientA.patient_db_id, doctor.doctorId, appointmentId]);
  recordId = record.insertId;
  const instruction = encryptField('Synthetic A instruction', 'patient_clinical_instructions.content');
  await db.execute("INSERT INTO patient_clinical_instructions(instruction_id,clinical_record_id,patient_id,doctor_id,instruction_type,title,content_ciphertext,encryption_key_version,publication_status) VALUES(?,?,?,?,'General Care','Synthetic A instruction',?,?,'Published')", [`INS-ISO-${tag}`, recordId, patientA.patient_db_id, doctor.doctorId, instruction.ciphertext, instruction.keyVersion]);
  const notification = encryptField('Synthetic A notification', 'notifications.message');
  await db.execute("INSERT INTO notifications(notification_id,recipient_user_id,type,title,message_ciphertext,encryption_key_version) VALUES(?,?,'record-updated','Synthetic A notification',?,?)", [notificationCode, patientA.id, notification.ciphertext, notification.keyVersion]);
  const [invoice] = await db.execute("INSERT INTO invoices(invoice_id,invoice_number,patient_id,appointment_id,status,created_by_user_id) VALUES(?,?,?,?,'Issued',?)", [invoiceCode, invoiceCode, patientA.patient_db_id, appointmentId, admin.id]);
  invoiceId = invoice.insertId;
});

after(async () => {
  // Delete only IDs created by this test; never reset the database.
  if (photoKey) await unlink(path.join(photoDirectory, photoKey)).catch(() => {});
  for (const id of users) {
    await db.execute('DELETE FROM security_audit_logs WHERE user_id=?', [id]);
    await db.execute('DELETE FROM refresh_tokens WHERE user_id=?', [id]);
    await db.execute('DELETE FROM notifications WHERE recipient_user_id=?', [id]);
  }
  if (invoiceId) await db.execute('DELETE FROM invoices WHERE id=?', [invoiceId]);
  if (recordId) {
    await db.execute('DELETE FROM patient_clinical_instructions WHERE clinical_record_id=?', [recordId]);
    await db.execute('DELETE FROM clinical_records WHERE id=?', [recordId]);
  }
  if (appointmentId) await db.execute('DELETE FROM appointments WHERE id=?', [appointmentId]);
  for (const id of patients) await db.execute('DELETE FROM patients WHERE id=?', [id]);
  for (const id of doctors) await db.execute('DELETE FROM doctors WHERE id=?', [id]);
  for (const id of users) await db.execute('DELETE FROM users WHERE id=?', [id]);
  if (serviceId) await db.execute('DELETE FROM dental_services WHERE id=?', [serviceId]);
  if (server) await new Promise(resolve => server.close(resolve));
});

test('A owns appointments, published records, notifications and invoices; B stays empty after logout and refresh', async () => {
  const a = await login(patientA);
  assert.equal((await call('/appointments/my', a)).data.appointments.length, 1);
  assert.equal((await call('/patient/records', a)).data.record.instructions.length, 1);
  assert.equal((await call('/notifications', a)).data.notifications.length, 1);
  assert.equal((await call('/invoices', a)).data.invoices.length, 1);
  assert.equal((await call('/auth/logout', { ...a, method: 'POST' })).status, 200);
  assert.equal((await call('/auth/refresh', { cookie: a.cookie, method: 'POST' })).status, 401);
  let b = await login(patientB);
  for (let i = 0; i < 2; i += 1) {
    assert.deepEqual((await call(`/appointments/my?patient_id=${patientA.patient_id}`, b)).data.appointments, []);
    assert.deepEqual((await call(`/patient/records?patientId=${patientA.patient_id}`, b)).data.record.instructions, []);
    assert.deepEqual((await call('/notifications', b)).data.notifications, []);
    assert.deepEqual((await call('/invoices', b)).data.invoices, []);
    assert.equal((await call('/patient/profile', b)).data.patient.patientId, patientB.patient_id);
    const refreshed = await call('/auth/refresh', { cookie: b.cookie, method: 'POST' });
    assert.equal(refreshed.status, 200);
    b = { token: refreshed.data.accessToken, cookie: refreshed.cookie };
  }
});

test('B cannot access A resource IDs; unknown IDs return the same response', async () => {
  const b = await login(patientB);
  for (const suffix of ['', '/pdf']) {
    const denied = await call(`/invoices/${invoiceCode}${suffix}`, b);
    const missing = await call(`/invoices/INV-UNKNOWN${suffix}`, b);
    assert.equal(denied.status, 404); assert.deepEqual(denied.data, missing.data);
  }
  for (const action of ['cancel', 'reschedule']) {
    const body = action === 'cancel' ? { reason: 'Synthetic denied attempt' } : { date: '2099-01-01', time: '10:00', reason: 'Synthetic denied attempt' };
    const denied = await call(`/appointments/${appointmentCode}/${action}`, { ...b, method: 'POST', body });
    const missing = await call(`/appointments/APT-UNKNOWN/${action}`, { ...b, method: 'POST', body });
    assert.equal(denied.status, 404); assert.deepEqual(denied.data, missing.data);
  }
  assert.equal((await call(`/notifications/${notificationCode}/read`, { ...b, method: 'POST' })).status, 404);
  assert.equal((await call(`/doctor/patients/${patientA.patient_id}/record`, b)).status, 403);
  assert.equal((await call(`/admin/identity/patients/${patientA.patient_id}`, b)).status, 403);
  const [[appointment]] = await db.execute('SELECT status FROM appointments WHERE id=?', [appointmentId]);
  assert.equal(appointment.status, 'Confirmed');
});

test('Doctor relationship scope and Admin review permissions remain enforced', async () => {
  assert.equal((await call(`/doctor/patients/${patientA.patient_id}/record`, doctor)).status, 200);
  assert.equal((await call(`/doctor/patients/${patientA.patient_id}/record`, otherDoctor)).status, 404);
  assert.equal((await call(`/doctor/patients/${patientB.patient_id}/record`, doctor)).status, 404);
  assert.equal((await call(`/invoices/${invoiceCode}`, doctor)).status, 200);
  assert.equal((await call(`/invoices/${invoiceCode}`, otherDoctor)).status, 404);
  assert.equal((await call(`/admin/patient-records/${patientA.patient_id}`, admin)).status, 200);
  assert.equal((await call(`/invoices/${invoiceCode}`, admin)).status, 200);
});

test('profile photos require authentication and ownership or an authorized staff relationship', async () => {
  const a = await login(patientA), b = await login(patientB);
  const form = new FormData();
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');
  form.append('photo', new Blob([png], { type: 'image/png' }), 'synthetic.png');
  const upload = await fetch(`${base}/api/patient/profile/photo`, { method: 'POST', headers: { authorization: `Bearer ${a.token}` }, body: form });
  assert.equal(upload.status, 200);
  const url = (await upload.json()).patient.photoUrl;
  photoKey = url.split('/').at(-1);
  assert.equal((await fetch(`${base}${url}`)).status, 401);
  for (const [actor, expected] of [[a, 200], [b, 404], [doctor, 200], [otherDoctor, 404], [admin, 200]]) {
    const result = await fetch(`${base}${url}`, { headers: { authorization: `Bearer ${actor.token}` } });
    assert.equal(result.status, expected);
    assert.match(result.headers.get('cache-control'), /no-store/);
    await result.arrayBuffer();
  }
});
