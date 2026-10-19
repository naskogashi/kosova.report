import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { randomBytes } from "node:crypto";
import { database } from "./db";
import {
  ADMIN_COOKIE,
  SESSION_SECONDS,
  digest,
  siteConfig,
} from "./admin-auth";
export async function currentAdmin() {
  const token = cookies().get(ADMIN_COOKIE)?.value;
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  try {
    const [rows] = await database().execute(
      "SELECT a.id,a.email,a.name,a.role,a.must_change_password FROM staff_sessions s JOIN staff_accounts a ON a.id=s.account_id WHERE s.token_hash=? AND s.expires_at>UTC_TIMESTAMP() AND a.active=1 LIMIT 1",
      [digest(token)],
    );
    return rows[0] || null;
  } catch {
    return null;
  }
}
export async function requireAdmin({ allowPasswordChange = false } = {}) {
  const account = await currentAdmin();
  if (!account) redirect("/admin/login");
  if (account.must_change_password && !allowPasswordChange)
    redirect("/admin/account");
  return account;
}
export async function requireOwner() {
  const account = await requireAdmin();
  if (account.role !== "owner") redirect("/admin");
  return account;
}
export async function createSessionRecord(
  accountId,
  temporary = false,
  connection = database(),
) {
  const token = randomBytes(32).toString("base64url"),
    seconds = temporary ? 1800 : SESSION_SECONDS;
  await connection.execute(
    "INSERT INTO staff_sessions (token_hash,account_id,expires_at) VALUES (?,?,DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? SECOND))",
    [digest(token), accountId, seconds],
  );
  return { token, seconds };
}
export function setSessionCookie({ token, seconds }) {
  cookies().set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: siteConfig().secure,
    sameSite: "strict",
    path: "/",
    maxAge: seconds,
  });
}
export async function startSession(accountId, temporary = false) {
  setSessionCookie(await createSessionRecord(accountId, temporary));
}
export async function endSession() {
  const token = cookies().get(ADMIN_COOKIE)?.value;
  if (token)
    await database().execute("DELETE FROM staff_sessions WHERE token_hash=?", [
      digest(token),
    ]);
  cookies().set(ADMIN_COOKIE, "", {
    httpOnly: true,
    secure: siteConfig().secure,
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
}
