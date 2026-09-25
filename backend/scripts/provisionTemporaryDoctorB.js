import "dotenv/config";
import { closeDatabase } from "../src/config/database.js";
import { provisionTemporaryDoctorB } from "../src/services/provisioningService.js";

try {
  const doctorBPasswordVariable = process.env.SEED_DOCTOR_B_PASSWORD
    ? "SEED_DOCTOR_B_PASSWORD"
    : "SEED_DOCTOR_PASSWORD";
  const result = await provisionTemporaryDoctorB({
    password: process.env[doctorBPasswordVariable],
    passwordVariableName: doctorBPasswordVariable,
    overwritePasswords: process.env.SEED_OVERWRITE_PASSWORDS === "true",
  });
  console.log(`Dr. Muhammad Nur Syahidi provisioning: ${result.action}; profile: ${result.profileAction}; status: ${result.accountStatus}`);
  console.log("No password or authentication token was displayed.");
} catch (error) {
  console.error(`Provisioning failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  await closeDatabase();
}
