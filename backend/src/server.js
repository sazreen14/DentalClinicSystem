import app from "./app.js";
import { checkDatabase, closeDatabase } from "./config/database.js";
import { env } from "./config/env.js";

const server = app.listen(env.port, async () => {
  console.log(`Dental Clinic API listening on port ${env.port}`);
  try {
    await checkDatabase();
    console.log("MySQL connection verified");
  } catch {
    console.warn("MySQL is unavailable; /api/health will report degraded status");
  }
});

async function shutdown(signal) {
  console.log(`${signal} received; shutting down`);
  server.close(async () => {
    try { await closeDatabase(); } catch { /* Pool may not have initialized. */ }
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("unhandledRejection", (error) => { console.error("Unhandled promise rejection", error); shutdown("unhandledRejection"); });
process.on("uncaughtException", (error) => { console.error("Uncaught exception", error); shutdown("uncaughtException"); });
