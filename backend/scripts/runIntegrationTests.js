import { readdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import "../test/helpers/requireTestDatabase.js";

// Each file owns its database pool, HTTP server and cleanup hooks.
// Running every file without isolation merges those hooks into a single suite.
const files = (await readdir(new URL("../test/", import.meta.url))).filter(name => name.endsWith(".test.js")).sort();
let failed = false;
for (const file of files) {
  const result = spawnSync(process.execPath, ["--import", "./test/helpers/requireTestDatabase.js", "--test", "--experimental-test-isolation=none", "--test-force-exit", `test/${file}`], { stdio: "inherit", env: process.env });
  if (result.error) console.error(result.error.message);
  if (result.status !== 0) failed = true;
}
process.exitCode = failed ? 1 : 0;
