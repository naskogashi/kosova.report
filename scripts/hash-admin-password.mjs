import { readFileSync } from "node:fs";
import { randomBytes, scryptSync } from "node:crypto";
if (process.stdin.isTTY) {
  console.error(
    "Pipe a password from stdin. See REPORTING_SETUP.md for a hidden-input command.",
  );
  process.exit(1);
}
const password = readFileSync(0, "utf8").replace(/\r?\n$/, "");
if (password.length < 14 || Buffer.byteLength(password) > 1024) {
  console.error(
    "Password must contain at least 14 characters and at most 1024 bytes.",
  );
  process.exit(1);
}
const salt = randomBytes(16).toString("hex");
console.log(`scrypt$${salt}$${scryptSync(password, salt, 64).toString("hex")}`);
