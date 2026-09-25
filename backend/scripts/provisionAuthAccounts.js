import "dotenv/config";
import { closeDatabase } from "../src/config/database.js";
import { provisionDevelopmentAccounts } from "../src/services/provisioningService.js";

const overwritePasswords = process.env.SEED_OVERWRITE_PASSWORDS === "true";

try {
  const result = await provisionDevelopmentAccounts({
    doctorPassword: process.env.SEED_DOCTOR_PASSWORD,
    adminPassword: process.env.SEED_ADMIN_PASSWORD,
    overwritePasswords,
  });
  console.log(`Doctor provisioning: ${result.doctor.action}; profile: ${result.doctor.profileAction}; status: ${result.doctor.accountStatus}`);
  console.log(`Admin provisioning: ${result.admin.action}; status: ${result.admin.accountStatus}`);
  console.log("No passwords or authentication tokens were displayed.");
} catch (error) {
  console.error(`Provisioning failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  await closeDatabase();
}
