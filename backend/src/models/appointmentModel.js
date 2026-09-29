export async function findPatientForUser(db, userId) {
  const [rows] = await db.execute("SELECT id, patient_id FROM patients WHERE user_id = ? LIMIT 1", [userId]);
  return rows[0] ?? null;
}
export async function findActivePatientByCode(db, code) {
  const [rows] = await db.execute("SELECT p.id FROM patients p JOIN users u ON u.id=p.user_id WHERE p.patient_id=? AND u.account_status='Active' LIMIT 1", [code]);
  return rows[0] ?? null;
}

export async function findDoctorForUser(db, userId) {
  const [rows] = await db.execute("SELECT id, doctor_id FROM doctors WHERE user_id = ? LIMIT 1", [userId]);
  return rows[0] ?? null;
}

const detailsSql = `SELECT a.*, p.patient_id AS patient_code, p.user_id AS patient_user_id, pu.full_name AS patient_name, COALESCE(pu.email,p.contact_email) AS patient_email,
  d.doctor_id AS doctor_code, d.user_id AS doctor_user_id, du.full_name AS doctor_name, ds.service_code, ds.name AS service_name,
  ds.duration_minutes FROM appointments a
  JOIN patients p ON p.id=a.patient_id JOIN users pu ON pu.id=p.user_id
  JOIN doctors d ON d.id=a.doctor_id JOIN users du ON du.id=d.user_id
  JOIN dental_services ds ON ds.id=a.dental_service_id`;

export async function listPatientAppointments(db, patientId) {
  const [rows] = await db.execute(`${detailsSql} WHERE a.patient_id=? ORDER BY a.appointment_date DESC,a.appointment_time DESC`, [patientId]); return rows;
}
export async function listDoctorAppointments(db, doctorId, activeOnly=false) {
  const status = activeOnly ? " AND a.status IN ('Pending','Confirmed')" : "";
  const [rows] = await db.execute(`${detailsSql} WHERE a.doctor_id=?${status} ORDER BY a.appointment_date,a.appointment_time`, [doctorId]); return rows;
}
export async function listAllAppointments(db) {
  const [rows] = await db.execute(`${detailsSql} ORDER BY a.appointment_date DESC,a.appointment_time`); return rows;
}
export async function findAppointment(db, publicId, { forUpdate = false, patientId } = {}) {
  const ownership = patientId === undefined ? "" : " AND a.patient_id=?";
  const [rows] = await db.execute(`${detailsSql} WHERE a.appointment_id=?${ownership} LIMIT 1${forUpdate ? " FOR UPDATE" : ""}`, patientId === undefined ? [publicId] : [publicId, patientId]); return rows[0] ?? null;
}
function allowedDoctorSql(allowedDoctorIds) {
  const ids = [...allowedDoctorIds];
  return { ids, placeholders: ids.map(() => "?").join(",") };
}

export async function getOptions(db, allowedDoctorIds) {
  const [services] = await db.execute("SELECT service_code AS id,name,duration_minutes AS durationMinutes,description,icon_key AS iconKey FROM dental_services WHERE status='Active' ORDER BY name");
  const { ids, placeholders } = allowedDoctorSql(allowedDoctorIds);
  const [doctors] = await db.execute(`SELECT d.doctor_id AS id,u.full_name AS name,d.professional_title AS professionalTitle,d.specialization FROM doctors d JOIN users u ON u.id=d.user_id WHERE u.account_status='Active' AND d.doctor_id IN (${placeholders}) ORDER BY u.full_name`, ids);
  return { services, doctors };
}
export async function findService(db, code) { const [r]=await db.execute("SELECT * FROM dental_services WHERE service_code=? AND status='Active' LIMIT 1",[code]); return r[0]??null; }
export async function findDoctor(db, code, allowedDoctorIds) {
  if (!allowedDoctorIds.has(code)) return null;
  const [r]=await db.execute("SELECT d.* FROM doctors d JOIN users u ON u.id=d.user_id WHERE d.doctor_id=? AND u.account_status='Active' LIMIT 1",[code]); return r[0]??null;
}
export async function insertAppointment(db, v) {
  const [r]=await db.execute(`INSERT INTO appointments (appointment_id,patient_id,doctor_id,dental_service_id,appointment_date,appointment_time,status,patient_note_ciphertext,booking_source,encryption_key_version) VALUES (?,?,?,?,?,?,'Pending',?,?,?)`,[v.appointmentId,v.patientId,v.doctorId,v.serviceId,v.date,v.time,v.noteCiphertext,v.bookingSource??'Patient',v.keyVersion]); return r.insertId;
}
export async function insertHistory(db,v){ await db.execute(`INSERT INTO appointment_history (appointment_id,action,previous_date,previous_time,new_date,new_time,previous_status,new_status,reason_ciphertext,encryption_key_version,changed_by_user_id) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,[v.id,v.action,v.previousDate??null,v.previousTime??null,v.newDate??null,v.newTime??null,v.previousStatus??null,v.newStatus??null,v.reasonCiphertext??null,v.keyVersion??null,v.userId]); }
export async function updateStatus(db,id,status,fields={}) { await db.execute(`UPDATE appointments SET status=?, cancellation_reason_ciphertext=COALESCE(?,cancellation_reason_ciphertext),cancelled_by=COALESCE(?,cancelled_by),encryption_key_version=COALESCE(?,encryption_key_version) WHERE id=?`,[status,fields.reasonCiphertext??null,fields.cancelledBy??null,fields.keyVersion??null,id]); }
export async function updateSchedule(db,id,v){ await db.execute(`UPDATE appointments SET original_date=COALESCE(original_date,appointment_date),original_time=COALESCE(original_time,appointment_time),appointment_date=?,appointment_time=?,status=?,reschedule_reason_ciphertext=?,encryption_key_version=COALESCE(?,encryption_key_version) WHERE id=?`,[v.date,v.time,v.status??'Confirmed',v.reasonCiphertext??null,v.keyVersion??null,id]); }
