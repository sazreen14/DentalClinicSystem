import 'dotenv/config';
import {randomBytes} from 'node:crypto';
import {db,closeDatabase} from '../src/config/database.js';
import {env} from '../src/config/env.js';
import {provisionDevelopmentAccounts,provisionTemporaryDoctorB} from '../src/services/provisioningService.js';
import {seedClinicOperations} from '../src/services/clinicOperationsSeedService.js';
import {seedClinicalRecords} from '../src/services/clinicalRecordsSeedService.js';
import {seedClinicDoctors} from '../src/services/clinicDoctorSeedService.js';

if(env.nodeEnv!=='test'||!/_test$/i.test(env.db.database))throw new Error('Integration-test prerequisites require NODE_ENV=test and a DB_NAME ending with _test.');
const password=()=>`T${randomBytes(18).toString('base64url')}a1`;
try{
  await provisionDevelopmentAccounts({doctorPassword:password(),adminPassword:password()});
  await provisionTemporaryDoctorB({password:password(),passwordVariableName:'generated test-only password'});
  await seedClinicDoctors();
  await seedClinicOperations();
  await seedClinicalRecords();
  await db.execute("UPDATE users SET email_verified_at=CURRENT_TIMESTAMP WHERE role='Patient'");
  console.log(`Minimum integration-test prerequisites ready in ${env.db.database}.`);
}finally{await closeDatabase();}
