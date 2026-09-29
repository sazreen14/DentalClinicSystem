const invoiceSelect = `SELECT i.*,p.patient_id patient_code,u.full_name patient_name,u.email patient_email,
  a.appointment_id appointment_code,d.doctor_id doctor_code,du.full_name doctor_name,ds.name appointment_service,
  ci.clinic_name,ci.phone clinic_phone,ci.email clinic_email,ci.address clinic_address
  FROM invoices i
  JOIN patients p ON p.id=i.patient_id
  JOIN users u ON u.id=p.user_id
  LEFT JOIN appointments a ON a.id=i.appointment_id
  LEFT JOIN doctors d ON d.id=a.doctor_id
  LEFT JOIN users du ON du.id=d.user_id
  LEFT JOIN dental_services ds ON ds.id=a.dental_service_id
  LEFT JOIN clinic_information ci ON ci.id=(SELECT MIN(id) FROM clinic_information)`;

export async function patientByCode(executor, patientCode, { lock = false } = {}) {
  const [rows] = await executor.execute(`SELECT p.*,u.full_name,u.email,u.account_status FROM patients p JOIN users u ON u.id=p.user_id WHERE p.patient_id=? LIMIT 1${lock ? " FOR UPDATE" : ""}`, [patientCode]);
  return rows[0] ?? null;
}

export async function patientForUser(executor, userId) {
  const [rows] = await executor.execute("SELECT id,patient_id FROM patients WHERE user_id=? LIMIT 1", [userId]);
  return rows[0] ?? null;
}

export async function doctorForUser(executor, userId) {
  const [rows] = await executor.execute("SELECT id,doctor_id FROM doctors WHERE user_id=? LIMIT 1", [userId]);
  return rows[0] ?? null;
}

export async function appointmentByCode(executor, appointmentCode, { lock = false } = {}) {
  const [rows] = await executor.execute(`SELECT * FROM appointments WHERE appointment_id=? LIMIT 1${lock ? " FOR UPDATE" : ""}`, [appointmentCode]);
  return rows[0] ?? null;
}

export async function insertInvoice(executor, value) {
  const [result] = await executor.execute(`INSERT INTO invoices(invoice_id,invoice_number,patient_id,appointment_id,created_by_user_id) VALUES(?,?,?,?,?)`, [value.invoiceId, value.provisionalNumber, value.patientId, value.appointmentId ?? null, value.userId]);
  return result.insertId;
}

export async function setInvoiceNumber(executor, id, invoiceNumber) {
  await executor.execute("UPDATE invoices SET invoice_number=? WHERE id=?", [invoiceNumber, id]);
}

export async function invoiceByCode(executor, invoiceCode, { lock = false } = {}) {
  const [rows] = await executor.execute(`${invoiceSelect} WHERE i.invoice_id=? LIMIT 1${lock ? " FOR UPDATE" : ""}`, [invoiceCode]);
  return rows[0] ?? null;
}

export async function itemsForInvoice(executor, invoiceId) {
  const [rows] = await executor.execute("SELECT * FROM invoice_items WHERE invoice_id=? ORDER BY id", [invoiceId]);
  return rows;
}

export async function invoiceForUser(executor, invoiceCode, user) {
  if (user.role === "Admin") return invoiceByCode(executor, invoiceCode);
  let ownership;
  if (user.role === "Patient") {
    ownership = "p.user_id=?";
  } else if (user.role === "Doctor") {
    ownership = `EXISTS (SELECT 1 FROM doctors actor WHERE actor.user_id=? AND (
      EXISTS (SELECT 1 FROM appointments ra WHERE ra.patient_id=i.patient_id AND ra.doctor_id=actor.id AND ra.status IN ('Pending','Confirmed','Completed'))
      OR EXISTS (SELECT 1 FROM clinical_records rr WHERE rr.patient_id=i.patient_id AND rr.doctor_id=actor.id)
    ))`;
  } else return null;
  const [rows] = await executor.execute(`${invoiceSelect} WHERE i.invoice_id=? AND i.status='Issued' AND ${ownership} LIMIT 1`, [invoiceCode, user.id]);
  return rows[0] ?? null;
}

export async function insertItem(executor, value) {
  await executor.execute(`INSERT INTO invoice_items(item_id,invoice_id,description,quantity,unit_price,line_total) VALUES(?,?,?,?,?,?)`, [value.itemId, value.invoiceId, value.description, value.quantity, value.unitPrice, value.lineTotal]);
}

export async function itemByCode(executor, invoiceId, itemCode, { lock = false } = {}) {
  const [rows] = await executor.execute(`SELECT * FROM invoice_items WHERE invoice_id=? AND item_id=? LIMIT 1${lock ? " FOR UPDATE" : ""}`, [invoiceId, itemCode]);
  return rows[0] ?? null;
}

export async function updateItem(executor, id, value) {
  await executor.execute("UPDATE invoice_items SET description=?,quantity=?,unit_price=?,line_total=? WHERE id=?", [value.description, value.quantity, value.unitPrice, value.lineTotal, id]);
}

export async function removeItem(executor, id) {
  await executor.execute("DELETE FROM invoice_items WHERE id=?", [id]);
}

export async function setTotals(executor, invoiceId, total) {
  await executor.execute("UPDATE invoices SET subtotal=?,total=? WHERE id=? AND status='Draft'", [total, total, invoiceId]);
}

export async function issueInvoice(executor, invoiceId, userId) {
  await executor.execute("UPDATE invoices SET status='Issued',issue_date=CURRENT_DATE,issued_at=CURRENT_TIMESTAMP,issued_by_user_id=? WHERE id=? AND status='Draft'", [userId, invoiceId]);
}

export async function listAdminInvoices(executor) {
  const [rows] = await executor.execute(`${invoiceSelect} ORDER BY i.created_at DESC,i.id DESC`);
  return rows;
}

export async function listPatientInvoices(executor, patientId) {
  const [rows] = await executor.execute(`${invoiceSelect} WHERE i.patient_id=? AND i.status='Issued' ORDER BY i.issue_date DESC,i.id DESC`, [patientId]);
  return rows;
}

export async function listDoctorInvoices(executor, doctorId) {
  const [rows] = await executor.execute(`${invoiceSelect} WHERE i.status='Issued' AND (
    EXISTS (SELECT 1 FROM appointments ra WHERE ra.patient_id=i.patient_id AND ra.doctor_id=? AND ra.status IN ('Pending','Confirmed','Completed'))
    OR EXISTS (SELECT 1 FROM clinical_records rr WHERE rr.patient_id=i.patient_id AND rr.doctor_id=?)
  ) ORDER BY i.issue_date DESC,i.id DESC`, [doctorId, doctorId]);
  return rows;
}
