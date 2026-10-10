import { db } from '../config/database.js';

// Manual read-only inspection only; never change historical records.
export async function reconcileCompletedVisits(patientCode, { apply = false } = {}) {
  if (apply) throw new Error('Historical reconciliation is disabled; this utility is dry-run only.');
  if (!patientCode) throw new Error('An explicit patient code is required for dry-run inspection.');
  const [candidates] = await db.execute(`SELECT DISTINCT a.id, a.appointment_id
    FROM appointments a JOIN patients p ON p.id = a.patient_id
    JOIN clinical_records cr ON cr.patient_id = p.id
    JOIN treatment_history t ON t.clinical_record_id = cr.id
    WHERE p.patient_id = ? AND a.status IN ('Pending','Confirmed')
      AND a.appointment_date <= CURRENT_DATE AND t.treatment_date <= CURRENT_DATE
      AND t.treatment_status = 'Completed' AND a.doctor_id = t.doctor_id
      AND a.doctor_id = cr.doctor_id
      AND COALESCE(t.appointment_id, cr.appointment_id) = a.id
      AND (t.appointment_id IS NULL OR cr.appointment_id IS NULL OR t.appointment_id = cr.appointment_id)
      AND NOT EXISTS (SELECT 1 FROM treatment_history replacement WHERE replacement.supersedes_treatment_id=t.id)`, [patientCode]);
  return { eligible: candidates.length, updated: 0, appointmentIds: candidates.map(row => row.appointment_id) };
}
