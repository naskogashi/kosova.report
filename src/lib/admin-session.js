import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE, adminConfig, verifySession } from "./admin-auth";
export function currentAdmin() {
  return verifySession(cookies().get(ADMIN_COOKIE)?.value, adminConfig());
}
export function requireAdmin() {
  const admin = currentAdmin();
  if (!admin) redirect("/admin/login");
  return admin;
}
