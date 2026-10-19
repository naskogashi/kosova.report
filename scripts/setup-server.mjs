import {
  readFileSync,
  openSync,
  closeSync,
  mkdirSync,
  unlinkSync,
  writeFileSync,
  renameSync,
  chmodSync,
} from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { connect, dbConfig, ensureDatabasePassword } from "./runtime.mjs";
import {
  serverConfigPath,
  serverSettingNames,
} from "../src/lib/server-config.js";
import { bootstrapOwner } from "./bootstrap-owner.mjs";
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
  const config = dbConfig(),
    directory = path.join(homedir(), "kosova-backups");
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const backup = path.join(
      directory,
      `kosova-${new Date().toISOString().replace(/[:.]/g, "-")}.sql`,
    ),
    fd = openSync(backup, "wx", 0o600);
  let dump;
  try {
    dump = spawnSync(
      "mysqldump",
      [
        "--single-transaction",
        "--no-tablespaces",
        "--host",
        config.host,
        "--port",
        String(config.port),
        "--user",
        config.user,
        config.database,
      ],
      {
        env: { ...process.env, MYSQL_PWD: config.password },
        stdio: ["ignore", fd, "pipe"],
      },
    );
  } finally {
    closeSync(fd);
  }
  if (dump.status !== 0) {
    unlinkSync(backup);
    throw new Error(
      "Database backup failed; no migration was run. Check mysqldump and database permissions.",
    );
  }
  console.log(`Private database backup saved: ${backup}`);
  connection = await connect({ multipleStatements: true });
  for (const file of [
    "sql/004_existing_schema.sql",
    "sql/005_platform_management.sql",
  ]) {
    await connection.query(readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
    console.log(`Applied ${file}`);
  }
  for (const [key, value] of Object.entries({
    APP_URL: "https://kosova.report",
    MYSQL_HOST: config.host,
    MYSQL_PORT: String(config.port),
    MYSQL_USER: config.user,
    MYSQL_DATABASE: config.database,
    R2_BUCKET: "kosova-report-images",
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
