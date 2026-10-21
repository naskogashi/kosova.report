import { mkdirSync, writeFileSync, renameSync, chmodSync } from "node:fs";
import path from "node:path";
import { dbConfig, ensureDatabasePassword } from "./runtime.mjs";
import {
  serverConfigPath,
  serverSettingNames,
} from "../src/lib/server-config.js";
import { bootstrapOwner } from "./bootstrap-owner.mjs";
import { backupAndMigrate } from "./migrate-lib.mjs";
const args = process.argv.slice(2),
  email = args[args.indexOf("--email") + 1];
if (!args.includes("--email") || !email) {
  console.error(
    "Usage: npm run setup:server -- --email your-admin-email [--reset-owner]",
  );
  process.exit(1);
}
let connection;
try {
  await ensureDatabasePassword();
  const config = dbConfig();
  connection = await backupAndMigrate();
  for (const [key, value] of Object.entries({
    APP_URL: "https://kosova.report",
    MYSQL_HOST: config.host,
    MYSQL_PORT: String(config.port),
    MYSQL_USER: config.user,
    MYSQL_DATABASE: config.database,
    R2_BUCKET: "kosova-report-images",
    R2_EVIDENCE_BUCKET: "kosova-evidence",
    R2_PUBLIC_BUCKET: "kosova-public",
    R2_IMAGE_BASE_URL: "https://images.kosova.report",
    R2_ACCOUNT_ID: "c268c9a22ef16f948948c241da7a9592",
  }))
    if (!process.env[key]) process.env[key] = value;
  const configFile = serverConfigPath(),
    configDirectory = path.dirname(configFile);
  mkdirSync(configDirectory, { recursive: true, mode: 0o700 });
  chmodSync(configDirectory, 0o700);
  const settings = Object.fromEntries(
    serverSettingNames
      .filter(
        (name) => typeof process.env[name] === "string" && process.env[name],
      )
      .map((name) => [name, process.env[name]]),
  );
  const temporary = configFile + "." + process.pid + ".tmp";
  writeFileSync(temporary, JSON.stringify(settings, null, 2), {
    mode: 0o600,
    flag: "wx",
  });
  renameSync(temporary, configFile);
  chmodSync(configFile, 0o600);
  console.log(`Private runtime settings saved: ${configFile}`);
  const account = await bootstrapOwner(connection, email, {
    reset: args.includes("--reset-owner"),
  });
  if (account.existing)
    console.log(
      `Owner already exists: ${account.email}. Use --reset-owner only if you need a replacement one-time password.`,
    );
  else
    console.log(
      `\nAdmin login: ${account.email}\nONE-TIME PASSWORD: ${account.password}\nValid for 24 hours, one sign-in only. Replace it immediately at /admin/account.\n`,
    );
  console.log("Restart the app: pm2 restart kosova-report --update-env");
  console.log(
    "Move current branding/report images: npm run migrate:images -- --apply",
  );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await connection?.end();
}
