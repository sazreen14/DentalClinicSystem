import { db } from '../src/config/database.js';
import { reconcileCompletedVisits } from '../src/services/completedVisitReconciliation.js';

try {
  if (process.argv.includes('--apply')) throw new Error('Historical reconciliation is disabled; --apply is not supported.');
  const patientCode = process.argv.find(arg => arg.startsWith('--patient='))?.slice('--patient='.length);
  if (!patientCode) throw new Error('Specify --patient=<patient-code>. This utility is dry-run only.');
  console.log(JSON.stringify(await reconcileCompletedVisits(patientCode)));
} catch (error) {
  console.error(error.code || error.message);
  process.exitCode = 1;
} finally {
  await db.end();
}
