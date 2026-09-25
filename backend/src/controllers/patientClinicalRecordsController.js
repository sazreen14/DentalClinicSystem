import * as s from '../services/clinicalRecordsService.js';export async function record(q,r){r.json({status:'success',record:await s.patientRecord(q.user.id)});}
