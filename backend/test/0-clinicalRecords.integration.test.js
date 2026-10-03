import { reconcileCompletedVisits } from '../src/services/completedVisitReconciliation.js';
import './helpers/requireTestDatabase.js';
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import app from '../src/app.js';
import { db } from '../src/config/database.js';
import { createAccessToken } from '../src/services/tokenService.js';
import { encryptField } from '../src/services/fieldEncryptionService.js';
import * as s from '../src/services/clinicalRecordsService.js';

const tag = randomBytes(6).toString('hex').toUpperCase();
const patientCode = 'PT-NOTE-' + tag;
const marker = 'Synthetic API Note ' + tag;
const userIds = [], doctorIds = [], appointmentIds = [];
let patientDbId, server, base, doctor, otherDoctor, patient, admin;
let added, amended, instruction, auditStart = 0;

async function api(path, { method = 'GET', token, body } = {}) {
  const response = await fetch(base + path, {
    method,
    headers: { ...(token ? { authorization: 'Bearer ' + token } : {}), ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { response, json: await response.json() };
}

async function fixtureUser(role, suffix) {
  const userId = 'USR-NOTE-' + suffix + '-' + tag;
  const [result] = await db.execute('INSERT INTO users(email_verified_at,user_id,full_name,email,password_hash,role) VALUES(CURRENT_TIMESTAMP,?,?,?,?,?)',
    [userId, 'Synthetic Note ' + suffix, 'note.' + suffix + '.' + tag + '@example.test', 'synthetic-unused-login-hash', role]);
  userIds.push(result.insertId);
  const user = { id: result.insertId, user_id: userId, role };
  if (role === 'Doctor') {
    const [profile] = await db.execute('INSERT INTO doctors(doctor_id,user_id,professional_title,license_number) VALUES(?,?,?,?)',
      ['DOC-NOTE-' + suffix + '-' + tag, user.id, 'Dentist', 'LIC-NOTE-' + suffix + '-' + tag]);
    doctorIds.push(profile.insertId); user.doctorId = profile.insertId;
  }
  return user;
}

before(async () => {
  doctor = await fixtureUser('Doctor', 'D'); otherDoctor = await fixtureUser('Doctor', 'OTHER');
  patient = await fixtureUser('Patient', 'P'); admin = await fixtureUser('Admin', 'ADMIN');
  const phone = encryptField('+601100000001', 'patients.phone');
  const [profile] = await db.execute("INSERT INTO patients(patient_id,user_id,date_of_birth,gender,phone_ciphertext,phone_blind_index,phone_key_version,registration_date) VALUES(?,?,'1992-06-15','Female',?,?,?,CURRENT_DATE)",
    [patientCode, patient.id, phone.ciphertext, randomBytes(32).toString('hex'), phone.keyVersion]);
  patientDbId = profile.insertId;
  // Both synthetic doctors have a clinical relationship; note authorship is separate.
  for (const [index, actor] of [doctor, otherDoctor].entries()) {
    await db.execute('INSERT INTO clinical_records(record_id,patient_id,doctor_id) VALUES(?,?,?)',
      ['REC-NOTE-' + index + '-' + tag, patientDbId, actor.doctorId]);
  }
  const [[service]] = await db.query('SELECT id FROM dental_services LIMIT 1');
  const [appointment] = await db.execute("INSERT INTO appointments(appointment_id,patient_id,doctor_id,dental_service_id,appointment_date,appointment_time,status) VALUES(?,?,?,?,CURRENT_DATE,'09:00','Confirmed')", ['APT-BASE-'+tag,patientDbId,doctor.doctorId,service.id]);
  appointmentIds.push(appointment.insertId);
  const [[audit]] = await db.execute('SELECT COALESCE(MAX(id),0) id FROM security_audit_logs'); auditStart = Number(audit.id);
  await new Promise(resolve => { server = app.listen(0, '127.0.0.1', () => { base = 'http://127.0.0.1:' + server.address().port + '/api'; resolve(); }); });
});

after(async () => {
  // Delete only this run's fixture IDs, including partially completed setup.
  for (const id of userIds) {
    await db.execute('DELETE FROM security_audit_logs WHERE user_id=?', [id]);
    await db.execute('DELETE FROM notifications WHERE recipient_user_id=?', [id]);
  }
  if (patientDbId) {
    await db.execute('DELETE FROM patient_clinical_instructions WHERE patient_id=?', [patientDbId]);
    if (amended) await db.execute('DELETE FROM clinical_notes WHERE id=?', [amended.id]);
    await db.execute('DELETE FROM clinical_notes WHERE clinical_record_id IN (SELECT id FROM clinical_records WHERE patient_id=?)', [patientDbId]);
    await db.execute('DELETE FROM treatment_history WHERE clinical_record_id IN (SELECT id FROM clinical_records WHERE patient_id=?)', [patientDbId]);
    await db.execute('DELETE FROM clinical_records WHERE patient_id=?', [patientDbId]);
    await db.execute('DELETE FROM patient_clinical_profiles WHERE patient_id=?', [patientDbId]);
    for (const id of appointmentIds) { await db.execute('DELETE FROM appointment_history WHERE appointment_id=?', [id]); await db.execute('DELETE FROM appointments WHERE id=?', [id]); }
    await db.execute('DELETE FROM patients WHERE id=?', [patientDbId]);
  }
  for (const id of doctorIds) await db.execute('DELETE FROM doctors WHERE id=?', [id]);
  for (const id of userIds) await db.execute('DELETE FROM users WHERE id=?', [id]);
  if (server) { server.closeAllConnections?.(); await new Promise(resolve => server.close(resolve)); }
});

const payload = { appointmentId: 'APT-BASE-'+tag, treatment: 'Synthetic Review', treatmentStatus: 'Completed', diagnosis: 'Synthetic diagnosis', procedurePerformed: 'Synthetic procedure', clinicalNote: marker, prescription: 'Synthetic prescription', followUpRecommendation: 'Synthetic follow-up' };

test('New patient with encounters but no treatments has no recent visits', async () => {
  assert.deepEqual((await s.patientRecord(patient.id)).recentVisits, []);
  assert.equal((await s.patientRecord(patient.id)).completedVisitCount, 0);
});

test('Doctor appends encrypted note and treatment history', async () => {
  assert.ok((await s.doctorDirectory(doctor.id)).some(row => row.patientId === patientCode));
  added = await s.addNote(doctor.id, patientCode, payload, '127.0.0.1');
  const record = await s.doctorRecord(doctor.id, patientCode);
  assert.ok(record.clinicalNotes.some(row => row.id === added.id));
  assert.ok(record.treatments.some(row => row.treatment === payload.treatment));
  const [[stored]] = await db.execute('SELECT clinical_note_ciphertext,diagnosis_ciphertext FROM clinical_notes WHERE id=?', [added.id]);
  assert.ok(!stored.clinical_note_ciphertext.includes(marker));
  assert.ok(!stored.diagnosis_ciphertext.includes(payload.diagnosis));
  const [[notification]] = await db.execute('SELECT type,message_ciphertext FROM notifications WHERE recipient_user_id=? AND related_entity_id=? ORDER BY id DESC LIMIT 1', [patient.id, patientCode]);
  assert.equal(notification.type, 'record-updated');
  assert.ok(!notification.message_ciphertext.includes(payload.treatment));
});

test('Another assigned Doctor cannot amend the original Doctor note', async () => {
  await assert.rejects(() => s.amendNote(otherDoctor.id, patientCode, added.id, { ...payload, amendmentReason: 'Synthetic unauthorized amendment' }, '127.0.0.1'), error => error.statusCode === 403 && error.code === 'FORBIDDEN');
});

test('Admin and unauthenticated users cannot amend a clinical note', async () => {
  const path = '/doctor/patients/' + patientCode + '/clinical-notes/' + added.id + '/amend';
  const body = { ...payload, amendmentReason: 'Synthetic denied amendment' };
  assert.equal((await api(path, { method: 'POST', token: createAccessToken(admin), body })).response.status, 403);
  assert.equal((await api(path, { method: 'POST', body })).response.status, 401);
});

test('Amendment preserves original and links replacement', async () => {
  amended = await s.amendNote(doctor.id, patientCode, added.id, { ...payload, clinicalNote: 'Corrected synthetic note', amendmentReason: 'Synthetic correction' });
  assert.equal(amended.supersedesNoteId, added.id);
  const [[original]] = await db.execute('SELECT id FROM clinical_notes WHERE id=?', [added.id]);
  assert.equal(Number(original.id), added.id);
});

test('Doctor updates authorized encrypted clinical profile', async () => {
  const value = await s.updateClinicalProfile(doctor.id, patientCode, { medicalHistory: 'Synthetic medical history', allergies: 'Synthetic allergy', medications: 'Synthetic medication' }, '127.0.0.1');
  assert.equal(value.allergies, 'Synthetic allergy');
  const [[stored]] = await db.execute('SELECT medical_history_ciphertext,allergies_ciphertext FROM patient_clinical_profiles WHERE patient_id=?', [patientDbId]);
  assert.ok(!stored.medical_history_ciphertext.includes('Synthetic medical'));
  assert.ok(!stored.allergies_ciphertext.includes('Synthetic allergy'));
  await assert.rejects(() => s.updateClinicalProfile(doctor.id, 'PT-NOT-RELATED', { medicalHistory: 'x', allergies: 'x', medications: 'x' }, '127.0.0.1'));
});

test('Patient ownership and Admin read-only RBAC are enforced', async () => {
  assert.equal((await s.patientRecord(patient.id)).patientId, patientCode);
  assert.equal((await s.adminRecord(patientCode)).patientId, patientCode);
  for (const actor of [patient, admin]) {
    const result = await api('/doctor/patients/' + patientCode + '/clinical-notes', { method: 'POST', token: createAccessToken(actor), body: payload });
    assert.equal(result.response.status, 403);
  }
  assert.equal((await api('/patient/records/' + patientCode, { token: createAccessToken(patient) })).response.status, 404);
});

test('Patient instructions are encrypted, Draft-first, publishable and withdrawable', async () => {
  instruction = await s.createInstruction(doctor.id, patientCode, { recordId: added.recordId, type: 'Follow-up', title: 'Synthetic guidance', content: 'Synthetic private instruction content' }, '127.0.0.1');
  assert.equal(instruction.status, 'Draft');
  let own = await s.patientRecord(patient.id);
  assert.deepEqual(Object.keys(own).sort(), ['completedVisitCount', 'instructions', 'patientId', 'recentVisits']);
  assert.equal(own.instructions.some(row => row.id === instruction.id), false);
  const [[stored]] = await db.execute('SELECT content_ciphertext,encryption_key_version FROM patient_clinical_instructions WHERE instruction_id=?', [instruction.id]);
  assert.ok(!stored.content_ciphertext.includes('Synthetic private instruction content'));
  assert.ok(stored.encryption_key_version);
  await s.publishInstruction(doctor.id, patientCode, instruction.id, '127.0.0.1');
  own = await s.patientRecord(patient.id);
  const visible = own.instructions.find(row => row.id === instruction.id);
  assert.equal(visible.status, 'Published');
  assert.equal(visible.content, 'Synthetic private instruction content');
  assert.equal('contentCiphertext' in visible, false);
  assert.equal('encryptionKeyVersion' in visible, false);
  assert.ok((await s.adminRecord(patientCode)).instructions.some(row => row.id === instruction.id));
  await s.withdrawInstruction(doctor.id, patientCode, instruction.id, '127.0.0.1');
  assert.equal((await s.patientRecord(patient.id)).instructions.some(row => row.id === instruction.id), false);
});

test('Patient and Admin cannot mutate Patient instructions', async () => {
  for (const actor of [patient, admin]) {
    const result = await api('/doctor/patients/' + patientCode + '/instructions', { method: 'POST', token: createAccessToken(actor), body: { recordId: added.recordId, type: 'General Care', title: 'Synthetic denied instruction', content: 'Synthetic denied content' } });
    assert.equal(result.response.status, 403);
  }
});

test('Instruction audit history uses safe public metadata', async () => {
  const [events] = await db.execute("SELECT event_type,metadata FROM security_audit_logs WHERE user_id=? AND event_type IN ('PATIENT_INSTRUCTION_CREATED','PATIENT_INSTRUCTION_PUBLISHED','PATIENT_INSTRUCTION_WITHDRAWN') AND id>? ORDER BY id", [doctor.id, auditStart]);
  assert.deepEqual(events.map(row => row.event_type), ['PATIENT_INSTRUCTION_CREATED', 'PATIENT_INSTRUCTION_PUBLISHED', 'PATIENT_INSTRUCTION_WITHDRAWN']);
  for (const event of events) {
    const metadata = typeof event.metadata === 'string' ? JSON.parse(event.metadata) : event.metadata;
    assert.equal(metadata.instructionId, instruction.id);
    assert.equal(JSON.stringify(metadata).includes('Synthetic private instruction content'), false);
  }
});


test('Patient recent visits match treatment history without exposing private notes', async () => {
  const [[record]] = await db.execute('SELECT id FROM clinical_records WHERE patient_id=? ORDER BY id LIMIT 1', [patientDbId]);
  for (const days of [-3, -2, -1, 1]) {
    await db.execute("INSERT INTO treatment_history(clinical_record_id,doctor_id,treatment_date,treatment_name,treatment_status,encryption_key_version) VALUES(?,?,DATE_ADD(CURRENT_DATE, INTERVAL ? DAY),?,'Completed',1)", [record.id, doctor.doctorId, days, `Synthetic dated visit ${days}`]);
  }
  const [[clock]] = await db.query('SELECT DATE_FORMAT(CURRENT_DATE, "%Y-%m-%d") today');
  const history = (await s.doctorRecord(doctor.id, patientCode)).treatments;
  const seen = new Set();
  const expected = history.filter(row => { if(row.date > clock.today || row.status !== 'Completed' || !row.appointmentId || seen.has(row.recordId)) return false; seen.add(row.recordId); return true; }).slice(0, 3).map(({id,date,treatment,doctor,status}) => ({id,date,treatment,doctor,status}));
  const result = await api('/patient/records?patient_id=not-the-current-patient', { token: createAccessToken(patient) });
  assert.equal(result.response.status, 200);
  assert.deepEqual(result.json.record.recentVisits, expected);
  assert.equal(expected.length, 1);
  assert.equal(result.json.record.completedVisitCount, 1);
  for (const visit of result.json.record.recentVisits) assert.deepEqual(Object.keys(visit).sort(), ['date','doctor','id','status','treatment']);
});


test('Completed treatment completes only its linked appointment without duplicate visits', async () => {
  const [[service]] = await db.query('SELECT id FROM dental_services LIMIT 1');
  assert.ok(service, 'Test clinic service fixture is required');
  const code = 'APT-NOTE-' + tag;
  const [inserted] = await db.execute("INSERT INTO appointments(appointment_id,patient_id,doctor_id,dental_service_id,appointment_date,appointment_time,status) VALUES(?,?,?,?,CURRENT_DATE,'10:00','Confirmed')", [code,patientDbId,doctor.doctorId,service.id]);
  appointmentIds.push(inserted.insertId);
  const input = { ...payload, appointmentId: code };
  const priorCount = (await s.patientRecord(patient.id)).completedVisitCount;
  await s.addNote(doctor.id, patientCode, { ...input, treatmentStatus: 'Planned' });
  assert.equal((await s.patientRecord(patient.id)).completedVisitCount, priorCount);
  const [[plannedAppointment]] = await db.execute('SELECT status FROM appointments WHERE id=?',[inserted.insertId]);
  assert.equal(plannedAppointment.status,'Confirmed');
  await s.addNote(doctor.id, patientCode, { ...input, treatmentStatus: 'In Progress' });
  assert.equal((await s.patientRecord(patient.id)).completedVisitCount, priorCount);
  let [[a]] = await db.execute('SELECT status FROM appointments WHERE id=?',[inserted.insertId]);
  assert.equal(a.status,'Confirmed');
  await s.addNote(doctor.id, patientCode, input);
  [[a]] = await db.execute('SELECT status FROM appointments WHERE id=?',[inserted.insertId]);
  assert.equal(a.status,'Completed');
  const ownAppointments = await api('/appointments/my', {token:createAccessToken(patient)});
  assert.equal(ownAppointments.json.appointments.find(row=>row.id===code).status,'Completed');
  assert.equal((await s.patientRecord(patient.id)).completedVisitCount,priorCount+1);
  const [[history]] = await db.execute("SELECT COUNT(*) n FROM appointment_history WHERE appointment_id=? AND action='Completed'",[inserted.insertId]);
  assert.equal(Number(history.n),1);
  const before = await s.patientRecord(patient.id);
  await s.addNote(doctor.id, patientCode, input);
  assert.equal((await s.patientRecord(patient.id)).completedVisitCount,before.completedVisitCount);
  const [[recordCount]] = await db.execute('SELECT COUNT(*) n FROM clinical_records WHERE appointment_id=?',[inserted.insertId]);
  assert.equal(Number(recordCount.n),1);
  await assert.rejects(s.addNote(otherDoctor.id,patientCode,input), { code:'INVALID_APPOINTMENT_LINK' });
  assert.equal((await reconcileCompletedVisits(patientCode)).eligible,0);
  await assert.rejects(reconcileCompletedVisits(patientCode,{apply:true}), /dry-run only/);
  await db.execute("UPDATE appointments SET status='Cancelled' WHERE id=?",[inserted.insertId]);
  await assert.rejects(s.addNote(doctor.id,patientCode,input), {code:'INVALID_APPOINTMENT_STATUS'});
  assert.equal((await reconcileCompletedVisits(patientCode)).updated,0);
});


test('New visits reject missing, foreign, unknown, pending and future appointment links', async () => {
  const {appointmentId, ...unlinked} = payload;
  for (const treatmentStatus of ['Planned','In Progress','Completed']) {
    await assert.rejects(s.addNote(doctor.id,patientCode,{...unlinked,treatmentStatus}), {code:'APPOINTMENT_REQUIRED'});
  }
  const rejected = await api('/doctor/patients/'+patientCode+'/clinical-notes', {method:'POST',token:createAccessToken(doctor),body:unlinked});
  assert.equal(rejected.response.status,422);
  await assert.rejects(s.addNote(doctor.id,patientCode,{...payload,appointmentId:'UNKNOWN'}), {code:'INVALID_APPOINTMENT_LINK'});
  const [[service]] = await db.query('SELECT id FROM dental_services LIMIT 1');
  const code='APT-REJECT-'+tag;
  const [inserted]=await db.execute("INSERT INTO appointments(appointment_id,patient_id,doctor_id,dental_service_id,appointment_date,appointment_time,status) VALUES(?,?,?,?,CURRENT_DATE,'11:00','Pending')",[code,patientDbId,doctor.doctorId,service.id]);
  appointmentIds.push(inserted.insertId);
  await assert.rejects(s.addNote(doctor.id,patientCode,{...payload,appointmentId:code}),{code:'INVALID_APPOINTMENT_STATUS'});
  await db.execute("UPDATE appointments SET status='Confirmed', appointment_date=DATE_ADD(CURRENT_DATE,INTERVAL 1 DAY) WHERE id=?",[inserted.insertId]);
  await assert.rejects(s.addNote(doctor.id,patientCode,{...payload,appointmentId:code}),{code:'INVALID_APPOINTMENT_DATE'});
  const [[count]]=await db.execute('SELECT COUNT(*) n FROM clinical_records WHERE appointment_id=?',[inserted.insertId]);
  assert.equal(Number(count.n),0);
});
