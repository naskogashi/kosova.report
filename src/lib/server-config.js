import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
export const serverConfigPath = () =>
  path.join(homedir(), ".config", "kosova-report", "runtime.json");
export const serverSettingNames = [
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
  "VAPID_PUBLIC_KEY",
  "VAPID_PRIVATE_KEY",
  "VAPID_SUBJECT",
  "PUSH_SEAL_KEY",
  "SMTP2GO_API_KEY",
  "SMTP_FROM",
  "PRIVACY_CONTACT_EMAIL",
];
export function loadServerConfig() {
  try {
    const settings = JSON.parse(readFileSync(serverConfigPath(), "utf8"));
    for (const name of serverSettingNames)
      if (!process.env[name] && typeof settings[name] === "string")
        process.env[name] = settings[name];
  } catch {}
}
