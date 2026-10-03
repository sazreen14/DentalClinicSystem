import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { AppError } from '../src/utils/AppError.js';

// Execute the current service functions with in-memory dependencies: no DB imports or writes.
const source = await readFile(new URL('../src/services/clinicalRecordsService.js', import.meta.url), 'utf8');
const completionSource = await readFile(new URL('../src/services/appointmentCompletionService.js', import.meta.url), 'utf8');
const addSource = source.slice(source.indexOf('export async function addNote('), source.indexOf('export async function amendNote(')).replace('export ', '');
function harness({ status = 'Confirmed', patientId = 1, doctorId = 2, failAudit = false } = {}) {
  let state = { appointment: { id: 10, appointment_id: 'APT-TEST', patient_id: patientId, doctor_id: doctorId, status }, notes: [], treatments: [], history: [], audits: [] };
  const connection = {};
  const check = c => assert.equal(c, connection);
  const writeAudit = async (entry, c) => { check(c); if (failAudit) throw new Error('audit failure'); state.audits.push(entry); };
  const appointments = {
    updateStatus: async (c, id, value) => { check(c); assert.equal(id, 10); state.appointment.status = value; },
    insertHistory: async (c, value) => { check(c); state.history.push(value); },
  };
  const completeTreatmentAppointment = new Function('appointments', 'writeAudit', 'AppError', completionSource.replace(/^import .*;\r?\n/gm, '').replace('export ', '') + '\nreturn completeTreatmentAppointment;')(appointments, writeAudit, AppError);
  const m = {
    validateAppointment: async (c, id, p, d, options) => { check(c); assert.equal(options.lock, true); return id === 'APT-TEST' && p === state.appointment.patient_id && d === state.appointment.doctor_id ? { ...state.appointment } : null; },
    recordForAppointment: async () => state.record,
    insertRecord: async (c, value) => { check(c); state.record = { id: 20, patient_id: value.patientId, doctor_id: value.doctorId }; return 20; },
    insertNote: async (c, value) => { check(c); state.notes.push(value); return state.notes.length; },
    insertTreatment: async (c, value) => { check(c); state.treatments.push(value); },
    noteById: async () => state.notes.at(-1),
  };
  const encrypted = { ciphertext: 'test-ciphertext', keyVersion: 1 };
  const bindings = { m, AppError, completeTreatmentAppointment, writeAudit, randomUUID: () => 'synthetic',
    scopedDoctor: async () => ({ doctor: { id: 2 }, p: { id: 1 } }),
    inTransaction: async callback => { const before = structuredClone(state); try { return await callback(connection); } catch (error) { state = before; throw error; } },
    encryptedPayload: () => ({ diagnosis: encrypted, note: encrypted, action: encrypted, prescription: encrypted, follow: encrypted, keyVersion: 1 }),
    enc: () => encrypted, note: value => value, clinicalNoteAdded: async () => {},
  };
  const addNote = new Function(...Object.keys(bindings), addSource + '\nreturn addNote;')(...Object.values(bindings));
  return { save: (treatmentStatus, appointmentId = 'APT-TEST') => addNote(3, 'PAT-TEST', { treatmentStatus, appointmentId }), state: () => state };
}

test('Completed treatment updates the exact appointment in the clinical transaction, once', async () => {
  const h = harness();
  await h.save('Completed');
  assert.equal(h.state().appointment.status, 'Completed');
  assert.equal(h.state().treatments[0].appointmentId, 10);
  assert.equal(h.state().history.length, 1);
  await h.save('Completed');
  assert.equal(h.state().history.length, 1);
});
test('Planned and In Progress leave the appointment Confirmed', async () => {
  for (const status of ['Planned', 'In Progress']) {
    const h = harness(); await h.save(status);
    assert.equal(h.state().appointment.status, 'Confirmed');
    assert.equal(h.state().history.length, 0);
  }
});
test('missing, unknown, different-patient and different-doctor links cannot create a visit', async () => {
  for (const [options, id, code] of [[{}, '', 'APPOINTMENT_REQUIRED'], [{}, 'UNKNOWN', 'INVALID_APPOINTMENT_LINK'], [{patientId: 9}, 'APT-TEST', 'INVALID_APPOINTMENT_LINK'], [{doctorId: 9}, 'APT-TEST', 'INVALID_APPOINTMENT_LINK']]) {
    const h = harness(options);
    await assert.rejects(h.save('Completed', id), { code });
    assert.equal(h.state().notes.length, 0);
  }
});
test('Pending and Cancelled appointments cannot receive new visits', async () => {
  for (const status of ['Pending', 'Cancelled']) await assert.rejects(harness({status}).save('Completed'), {code: 'INVALID_APPOINTMENT_STATUS'});
});
test('transaction failure rolls back both the clinical visit and appointment completion', async () => {
  const h = harness({failAudit: true});
  await assert.rejects(h.save('Completed'), /audit failure/);
  assert.equal(h.state().appointment.status, 'Confirmed');
  assert.equal(h.state().notes.length, 0);
  assert.equal(h.state().treatments.length, 0);
});
