// Match the photo key and the authenticated actor in the same query. Unknown
// keys and another patient's keys are intentionally indistinguishable.
export async function canReadProfilePhoto(db, user, filename) {
  if (!["Patient", "Doctor", "Admin"].includes(user.role)) return false;
  const [rows] = await db.execute(`
    SELECT p.id FROM patients p WHERE p.profile_photo_key=? AND (
      p.user_id=? OR ?='Admin' OR (?='Doctor' AND EXISTS (
        SELECT 1 FROM doctors d WHERE d.user_id=? AND (
          EXISTS (SELECT 1 FROM appointments a WHERE a.patient_id=p.id AND a.doctor_id=d.id AND a.status IN ('Pending','Confirmed','Completed'))
          OR EXISTS (SELECT 1 FROM clinical_records cr WHERE cr.patient_id=p.id AND cr.doctor_id=d.id)
        )
      ))
    )
    UNION ALL
    SELECT d.id FROM doctors d WHERE d.profile_photo_key=? AND (d.user_id=? OR ?='Admin')
    LIMIT 1`, [filename, user.id, user.role, user.role, user.id, filename, user.id, user.role]);
  return rows.length > 0;
}
