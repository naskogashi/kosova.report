import {
  createHash,
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
export const ADMIN_COOKIE = "kosova_admin";
export const SESSION_SECONDS = 8 * 60 * 60;
function equal(a, b) {
  const left = Buffer.from(a),
    right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
export function adminConfig(env = process.env) {
  const {
    ADMIN_EMAIL: email,
    ADMIN_PASSWORD_HASH: passwordHash,
    ADMIN_SESSION_SECRET: secret,
    APP_URL: appURL,
  } = env;
  if (
    !email ||
    !/^scrypt\$[0-9a-f]{32}\$[0-9a-f]{128}$/.test(passwordHash || "") ||
    !secret ||
    secret.length < 32 ||
    !appURL
  )
    return null;
  try {
    const origin = new URL(appURL);
    if (!["http:", "https:"].includes(origin.protocol)) return null;
    if (
      origin.protocol !== "https:" &&
      !["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname)
    )
      return null;
    return {
      email: email.toLowerCase(),
      passwordHash,
      secret,
      origin: origin.origin,
      secure: origin.protocol === "https:",
    };
  } catch {
    return null;
  }
}
export function hashPassword(password) {
  if (
    typeof password !== "string" ||
    password.length < 14 ||
    Buffer.byteLength(password) > 1024
  )
    throw new Error("Use a password between 14 characters and 1024 bytes.");
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
  const [, salt, expected] = hash.split("$");
  return equal(scryptSync(password, salt, 64).toString("hex"), expected);
}
const fingerprint = (config) =>
  createHash("sha256").update(config.passwordHash).digest("hex");
export function issueSession(config, now = Date.now()) {
  const payload = Buffer.from(
    JSON.stringify({
      email: config.email,
      expires: Math.floor(now / 1000) + SESSION_SECONDS,
      version: fingerprint(config),
      nonce: randomBytes(16).toString("hex"),
    }),
  ).toString("base64url");
  return `${payload}.${createHmac("sha256", config.secret).update(payload).digest("base64url")}`;
}
export function verifySession(token, config, now = Date.now()) {
  if (!config || typeof token !== "string" || token.length > 2048) return null;
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra) return null;
  const expected = createHmac("sha256", config.secret)
    .update(payload)
    .digest("base64url");
  if (!equal(signature, expected)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (
      data.email !== config.email ||
      data.version !== fingerprint(config) ||
      !Number.isInteger(data.expires) ||
      data.expires <= Math.floor(now / 1000) ||
      data.expires > Math.floor(now / 1000) + SESSION_SECONDS
    )
      return null;
    return { email: data.email };
  } catch {
    return null;
  }
}
export function loginBucket(config) {
  return createHmac("sha256", config.secret)
    .update(`admin-login:${config.email}`)
    .digest("hex");
}
