import { checkDatabase } from "../config/database.js";

export async function getHealth(_request, response) {
  try {
    await checkDatabase();
    return response.status(200).json({ status: "ok", service: "dental-clinic-api", database: "connected", timestamp: new Date().toISOString() });
  } catch {
    return response.status(503).json({ status: "degraded", service: "dental-clinic-api", database: "unavailable", timestamp: new Date().toISOString() });
  }
}
