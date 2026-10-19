import { readFileSync, openSync, closeSync, mkdirSync, unlinkSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { connect, dbConfig } from "./runtime.mjs";

// Repeatable migrations for the existing production database, in order.
export const migrations = [
  "sql/004_existing_schema.sql",
  "sql/005_platform_management.sql",
  "sql/006_news.sql",
];

// Backs the database up with mysqldump, then applies every migration.
// Nothing is migrated if the backup fails. Returns an open connection.
export async function backupAndMigrate() {
  const config = dbConfig(),
    directory = path.join(homedir(), "kosova-backups");
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const backup = path.join(directory, `kosova-${new Date().toISOString().replace(/[:.]/g, "-")}.sql`),
    fd = openSync(backup, "wx", 0o600);
  let dump;
  try {
    dump = spawnSync(
      "mysqldump",
      ["--single-transaction", "--no-tablespaces", "--host", config.host, "--port", String(config.port), "--user", config.user, config.database],
      { env: { ...process.env, MYSQL_PWD: config.password }, stdio: ["ignore", fd, "pipe"] },
    );
  } finally {
    closeSync(fd);
  }
  if (dump.status !== 0) {
    unlinkSync(backup);
    const detail = String(dump.error?.message || dump.stderr || "Unknown mysqldump failure")
      .split(config.password)
      .join("[redacted]")
      .trim()
      .slice(0, 2000);
    throw new Error(`Database backup failed; no migration was run. ${detail}`);
  }
  console.log(`Private database backup saved: ${backup}`);
  const connection = await connect({ multipleStatements: true });
  for (const file of migrations) {
    await connection.query(readFileSync(file, "utf8").replace(/^﻿/, ""));
    console.log(`Applied ${file}`);
  }
  return connection;
}
