import 'dotenv/config';
import { closeDatabase } from '../src/config/database.js';
import { seedClinicDoctors } from '../src/services/clinicDoctorSeedService.js';

try{console.log(await seedClinicDoctors());}
catch(error){console.error(`Doctor seed failed: ${error.message}`);process.exitCode=1;}
finally{await closeDatabase();}
