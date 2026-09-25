import "dotenv/config";
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { closeDatabase, db } from "../src/config/database.js";

const directory = fileURLToPath(new URL("../database/migrations/", import.meta.url));

try {
  await db.execute(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(100) PRIMARY KEY,
    checksum CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB`);
  const files = (await readdir(directory)).filter((name) => name.endsWith(".sql")).sort();
  for (const file of files) {
    const sql = await readFile(path.join(directory, file), "utf8");
    const checksum = createHash("sha256").update(sql).digest("hex");
    const [[applied]] = await db.execute("SELECT checksum FROM schema_migrations WHERE version = ?", [file]);
    if (applied) {
      if (applied.checksum !== checksum) throw new Error(`Applied migration checksum changed: ${file}`);
      console.log(`Migration already applied: ${file}`);
      continue;
    }
    const statements = sql.split(/;\s*(?:\r?\n|$)/).map((value) => value.trim()).filter(Boolean);
    for (const statement of statements) await db.query(statement);
    await db.execute("INSERT INTO schema_migrations (version, checksum) VALUES (?, ?)", [file, checksum]);
    console.log(`Migration applied: ${file}`);
  }
} catch (error) {
  console.error(`Migration failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  await closeDatabase();
}
