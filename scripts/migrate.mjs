import { ensureDatabasePassword } from "./runtime.mjs";
import { backupAndMigrate } from "./migrate-lib.mjs";

// Database migrations only: backup first, then every repeatable migration.
// Staff accounts, passwords and runtime settings are left untouched.
let connection;
try {
  await ensureDatabasePassword();
  connection = await backupAndMigrate();
  console.log("Migrations applied. Restart the app: pm2 restart kosova-report");
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await connection?.end();
}
