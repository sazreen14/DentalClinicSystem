const placeholders = (values) => values.map(() => "?").join(",");

async function ids(db, sql, params = []) {
  const [rows] = await db.execute(sql, params);
  return rows.map((row) => row.id);
}

async function removeByIds(db, table, column, values) {
  if (values.length) await db.execute(`DELETE FROM ${table} WHERE ${column} IN (${placeholders(values)})`, values);
}

async function cleanupGroup(db, { userIds, patientIds, doctorIds, serviceIds }) {
  const appointmentIds = serviceIds.length || patientIds.length || doctorIds.length
    ? await ids(db, `SELECT id FROM appointments WHERE ${[
        serviceIds.length ? `dental_service_id IN (${placeholders(serviceIds)})` : null,
        patientIds.length ? `patient_id IN (${placeholders(patientIds)})` : null,
        doctorIds.length ? `doctor_id IN (${placeholders(doctorIds)})` : null,
      ].filter(Boolean).join(" OR ")}`, [...serviceIds, ...patientIds, ...doctorIds])
    : [];
  const recordIds = patientIds.length || doctorIds.length
    ? await ids(db, `SELECT id FROM clinical_records WHERE ${[
        patientIds.length ? `patient_id IN (${placeholders(patientIds)})` : null,
        doctorIds.length ? `doctor_id IN (${placeholders(doctorIds)})` : null,
      ].filter(Boolean).join(" OR ")}`, [...patientIds, ...doctorIds])
    : [];
  const invoiceIds = appointmentIds.length || patientIds.length
    ? await ids(db, `SELECT id FROM invoices WHERE ${[
        appointmentIds.length ? `appointment_id IN (${placeholders(appointmentIds)})` : null,
        patientIds.length ? `patient_id IN (${placeholders(patientIds)})` : null,
      ].filter(Boolean).join(" OR ")}`, [...appointmentIds, ...patientIds])
    : [];

  await removeByIds(db, "invoice_items", "invoice_id", invoiceIds);
  await removeByIds(db, "invoices", "id", invoiceIds);
  await removeByIds(db, "clinical_images", "clinical_record_id", recordIds);
  const chartEntryIds = await ids(db, recordIds.length ? `SELECT id FROM dental_chart_entries WHERE clinical_record_id IN (${placeholders(recordIds)})` : "SELECT id FROM dental_chart_entries WHERE 1=0", recordIds);
  await removeByIds(db, "dental_chart_entry_surfaces", "dental_chart_entry_id", chartEntryIds);
  await removeByIds(db, "dental_chart_entries", "id", chartEntryIds);
  await removeByIds(db, "patient_clinical_instructions", "clinical_record_id", recordIds);
  await removeByIds(db, "treatment_history", "clinical_record_id", recordIds);
  await removeByIds(db, "clinical_notes", "clinical_record_id", recordIds);
  await removeByIds(db, "clinical_records", "id", recordIds);
  await removeByIds(db, "appointment_history", "appointment_id", appointmentIds);
  if (userIds.length) {
    await removeByIds(db, "notifications", "recipient_user_id", userIds);
    await removeByIds(db, "security_audit_logs", "user_id", userIds);
    await removeByIds(db, "password_reset_tokens", "user_id", userIds);
    await removeByIds(db, "refresh_tokens", "user_id", userIds);
  }
  await removeByIds(db, "appointments", "id", appointmentIds);
  if (doctorIds.length) {
    await removeByIds(db, "doctor_blocked_times", "doctor_id", doctorIds);
    await removeByIds(db, "appointment_time_slots", "doctor_id", doctorIds);
    await removeByIds(db, "doctor_working_hours", "doctor_id", doctorIds);
  }
  await removeByIds(db, "dental_services", "id", serviceIds);
  await removeByIds(db, "patient_clinical_profiles", "patient_id", patientIds);
  await removeByIds(db, "patients", "id", patientIds);
  await removeByIds(db, "doctors", "id", doctorIds);
  await removeByIds(db, "users", "id", userIds);
  return { users: userIds.length, patients: patientIds.length, doctors: doctorIds.length, services: serviceIds.length, appointments: appointmentIds.length, clinicalRecords: recordIds.length };
}

export async function cleanupKnownIntegrationFixtures(db, filter = {}) {
  const [services] = await db.execute(`
    SELECT id, service_code, name FROM dental_services
     WHERE (name='Security Test Service' AND service_code REGEXP '^SVC-SEC-[A-Z0-9]+$')
        OR (name='Synthetic Appointment Service' AND service_code REGEXP '^SVC-[A-Z0-9]+$')
        OR (name='Synthetic Safe Service' AND service_code REGEXP '^TEST-SVC-[A-Z0-9]+$')
  `);
  const groups = [];
  for (const service of services) {
    const family = service.name === "Security Test Service" ? "security" : service.name === "Synthetic Appointment Service" ? "appointments" : "operations";
    const tag = service.service_code.replace(family === "security" ? "SVC-SEC-" : family === "appointments" ? "SVC-" : "TEST-SVC-", "");
    if ((filter.family && filter.family !== family) || (filter.tag && filter.tag !== tag)) continue;
    const userPattern = family === "security" ? `SEC-%-${tag}` : family === "appointments" ? `UT-%-${tag}` : `UT-OPS-${tag}`;
    const emailPattern = family === "security" ? `security.%.${tag}@example.test` : family === "appointments" ? `%.${tag}@example.test` : `ops.${tag}@example.test`;
    const [users] = await db.execute("SELECT id FROM users WHERE user_id LIKE ? AND email LIKE ?", [userPattern, emailPattern]);
    if (!users.length) continue;
    const userIds = users.map((row) => row.id);
    const patientIds = await ids(db, `SELECT id FROM patients WHERE user_id IN (${placeholders(userIds)})`, userIds);
    const doctorIds = await ids(db, `SELECT id FROM doctors WHERE user_id IN (${placeholders(userIds)})`, userIds);
    groups.push({ family, tag, userIds, patientIds, doctorIds, serviceIds: [service.id] });
  }
  const removed = [];
  for (const group of groups) removed.push({ family: group.family, tag: group.tag, ...(await cleanupGroup(db, group)) });
  return removed;
}

export async function cleanupAuxiliaryIntegrationFixtures(db, { family, tag } = {}) {
  const clauses = {
    invoice: ["user_id LIKE ? AND email LIKE ?", [`USR-INV-%-${tag || "%"}`, `invoice.%.${tag || "%"}@example.test`]],
    notification: ["user_id LIKE ? AND full_name LIKE 'Notification %' AND email LIKE ?", [`NT-%-${tag || "%"}`, `%.${tag || "%"}@example.test`]],
    identity: ["full_name='Synthetic Identity Patient' AND email LIKE ?", [tag ? `identity.${tag}@example.test` : "identity.%@example.test"]],
    auth: ["full_name='Synthetic Auth Patient' AND email LIKE ?", [tag ? `synthetic.auth.${tag}@example.test` : "synthetic.auth.%@example.test"]],
  };
  const families = family ? [family] : Object.keys(clauses);
  const removed = [];
  for (const name of families) {
    const [where, params] = clauses[name];
    const [users] = await db.execute(`SELECT id FROM users WHERE ${where}`, params);
    if (!users.length) continue;
    const userIds = users.map((row) => row.id);
    const patientIds = await ids(db, `SELECT id FROM patients WHERE user_id IN (${placeholders(userIds)})`, userIds);
    const doctorIds = await ids(db, `SELECT id FROM doctors WHERE user_id IN (${placeholders(userIds)})`, userIds);
    const serviceIds = name === "invoice"
      ? await ids(db, `SELECT id FROM dental_services WHERE name='Invoice Test Service' AND service_code LIKE ?`, [`SVC-INV-${tag || "%"}`])
      : [];
    removed.push({ family: name, ...(await cleanupGroup(db, { userIds, patientIds, doctorIds, serviceIds })) });
  }
  return removed;
}
