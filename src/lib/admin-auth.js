import {
  createHash,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
export const ADMIN_COOKIE = "kosova_staff";
export const SESSION_SECONDS = 8 * 60 * 60;
export function siteConfig(env = process.env) {
  const url = new URL(env.APP_URL || "https://kosova.report");
  if (
    url.protocol !== "https:" &&
    !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
  )
    throw new Error("HTTPS is required");
  return { origin: url.origin, secure: url.protocol === "https:" };
}
export function hashPassword(password) {
  if (
    typeof password !== "string" ||
    password.length < 14 ||
    Buffer.byteLength(password) > 1024
  )
    throw new Error("Use at least 14 characters, at most 1024 bytes.");
  const salt = randomBytes(16).toString("hex");
  return `scrypt$${salt}$${scryptSync(password, salt, 64).toString("hex")}`;
}
export function verifyPassword(password, hash) {
  if (
    typeof password !== "string" ||
    Buffer.byteLength(password) > 1024 ||
    !/^scrypt\$[0-9a-f]{32}\$[0-9a-f]{128}$/.test(hash || "")
  )
    return false;
  const [, salt, value] = hash.split("$");
  return timingSafeEqual(
    scryptSync(password, salt, 64),
    Buffer.from(value, "hex"),
  );
}
export const digest = (token) =>
  createHash("sha256").update(token).digest("hex");
export const randomPassword = () => randomBytes(24).toString("base64url");
