import { loadServerConfig } from "../src/lib/server-config.js";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import mysql from "mysql2/promise";
import { S3Client } from "@aws-sdk/client-s3";
const require = createRequire(import.meta.url),
  nextRequire = createRequire(require.resolve("next/package.json"));
nextRequire("@next/env").loadEnvConfig(process.cwd(), false, {
  info() {},
  error() {},
});
// Operator scripts may reuse this application's existing PM2 environment without logging it.
const names = [
  "APP_URL",
  "MYSQL_HOST",
  "MYSQL_PORT",
  "MYSQL_USER",
  "MYSQL_PASSWORD",
  "MYSQL_DATABASE",
  "R2_ACCOUNT_ID",
  "R2_BUCKET",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_IMAGE_BASE_URL",
  "R2_EVIDENCE_BUCKET",
  "R2_PUBLIC_BUCKET",
  "SMTP2GO_API_KEY",
  "SMTP_FROM",
];
if (!process.env.MYSQL_PASSWORD || !process.env.R2_ACCESS_KEY_ID) {
  try {
    const result = spawnSync("pm2", ["jlist"], {
      encoding: "utf8",
      maxBuffer: 8 * 1024 * 1024,
    });
    if (result.status === 0) {
      const app = JSON.parse(result.stdout).find(
        (item) => item.name === "kosova-report",
      );
      const env = { ...app?.pm2_env, ...app?.pm2_env?.env };
      for (const name of names)
        if (!process.env[name] && typeof env[name] === "string")
          process.env[name] = env[name];
    }
  } catch {}
}
loadServerConfig();
export function required(name) {
  if (!process.env[name]) throw new Error(`Missing server setting: ${name}`);
  return process.env[name];
}
export const dbConfig = () => ({
  host: process.env.MYSQL_HOST || "127.0.0.1",
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER || "kosova",
  password: required("MYSQL_PASSWORD"),
  database: process.env.MYSQL_DATABASE || "kosova",
  charset: "utf8mb4",
  timezone: "Z",
});
export const connect = (extra) =>
  mysql.createConnection({ ...dbConfig(), ...extra });
export const bucket = () => process.env.R2_BUCKET || "kosova-report-images";
export const evidenceBucket = () => process.env.R2_EVIDENCE_BUCKET || "kosova-evidence";
export const publicBucket = () => process.env.R2_PUBLIC_BUCKET || "kosova-public";
export const storage = (extra) =>
  new S3Client({
    ...extra,
    region: "auto",
    endpoint: `https://${required("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: required("R2_ACCESS_KEY_ID"),
      secretAccessKey: required("R2_SECRET_ACCESS_KEY"),
    },
  });
export const objectURL = (key) =>
  new URL(
    key,
    (
      process.env.R2_IMAGE_BASE_URL ||
      "https://images.kosova.report"
    ).replace(/\/$/, "") + "/",
  ).href;

export async function ensureDatabasePassword() {
  if (process.env.MYSQL_PASSWORD) return;
  if (!process.stdin.isTTY || !process.stdin.setRawMode)
    throw new Error(
      "MYSQL_PASSWORD is missing. Run setup in an interactive SSH terminal or configure the server environment.",
    );
  process.stdout.write("MySQL password for kosova (input hidden): ");
  const previous = Boolean(process.stdin.isRaw);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  try {
    process.env.MYSQL_PASSWORD = await new Promise((resolve, reject) => {
      let password = "";
      const handle = (data) => {
        for (const character of data.toString("utf8")) {
          if (character === "\r" || character === "\n") {
            process.stdin.removeListener("data", handle);
            resolve(password);
            return;
          }
          if (character === "\u0003") {
            process.stdin.removeListener("data", handle);
            reject(new Error("Setup cancelled"));
            return;
          }
          if (character === "\u007f" || character === "\b")
            password = password.slice(0, -1);
          else if (character === "\u0015") password = "";
          else password += character;
        }
      };
      process.stdin.on("data", handle);
    });
  } finally {
    process.stdin.setRawMode(previous);
    process.stdin.pause();
    process.stdout.write("\n");
  }
  if (!process.env.MYSQL_PASSWORD)
    throw new Error("A MySQL password is required.");
}
