"use server";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { database } from "../../lib/db";
import {
  ADMIN_COOKIE,
  SESSION_SECONDS,
  adminConfig,
  issueSession,
  verifyPassword,
  loginBucket,
} from "../../lib/admin-auth";
import { requireAdmin } from "../../lib/admin-session";
import { categories } from "../../lib/report-options";
function assertOrigin() {
  const config = adminConfig();
  if (!config || headers().get("origin") !== config.origin)
    throw new Error("Request origin is not allowed.");
  return config;
}
function value(form, key, max) {
  const item = form.get(key);
  if (typeof item !== "string" || item.length > max)
    throw new Error("Invalid form data.");
  return item.trim();
}
export async function loginAction(previous, form) {
  const config = adminConfig();
  if (!config)
    return { error: "Admin sign-in is not configured on the server." };
  let success = false;
  try {
    assertOrigin();
    const email = value(form, "email", 254).toLowerCase(),
      password = form.get("password");
    if (typeof password !== "string" || Buffer.byteLength(password) > 1024)
      return { error: "Unable to sign in. Check your credentials." };
    const bucket = loginBucket(config);
    await database().execute(
      "INSERT INTO admin_login_limits (bucket,attempts,window_started) VALUES (?,1,UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE attempts=IF(window_started < UTC_TIMESTAMP()-INTERVAL 15 MINUTE,1,LEAST(attempts+1,1000000)), window_started=IF(window_started < UTC_TIMESTAMP()-INTERVAL 15 MINUTE,UTC_TIMESTAMP(),window_started)",
      [bucket],
    );
    const [limits] = await database().execute(
      "SELECT attempts FROM admin_login_limits WHERE bucket=?",
      [bucket],
    );
    if (limits[0].attempts > 5)
      return { error: "Too many sign-in attempts. Try again in 15 minutes." };
    const passwordValid = verifyPassword(password, config.passwordHash);
    if (!passwordValid || email !== config.email)
      return { error: "Unable to sign in. Check your credentials." };
    await database().execute("DELETE FROM admin_login_limits WHERE bucket=?", [
      bucket,
    ]);
    cookies().set(ADMIN_COOKIE, issueSession(config), {
      httpOnly: true,
      secure: config.secure,
      sameSite: "strict",
      path: "/",
      maxAge: SESSION_SECONDS,
    });
    success = true;
  } catch (error) {
    console.error("Admin login failed", { code: error.code || "AUTH_ERROR" });
    return {
      error:
        "Sign-in is unavailable. Check server configuration and database migrations.",
    };
  }
  if (success) redirect("/admin");
}
export async function logoutAction() {
  assertOrigin();
  cookies().set(ADMIN_COOKIE, "", {
    httpOnly: true,
    secure: adminConfig().secure,
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
  redirect("/admin/login");
}
export async function updateReportAction(form) {
  assertOrigin();
  const admin = requireAdmin();
  const id = value(form, "id", 10),
    status = value(form, "status", 20),
    note = value(form, "note", 5000);
  if (
    !/^[1-9]\d{0,9}$/.test(id) ||
    !["Pending", "In Progress", "Resolved"].includes(status)
  )
    throw new Error("Invalid report update.");
  const connection = await database().getConnection();
  let failed = false;
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute(
      "SELECT status FROM reports WHERE id=? FOR UPDATE",
      [id],
    );
    if (!rows.length) throw new Error("Report unavailable");
    await connection.execute(
      "UPDATE reports SET status=?,admin_note=?,resolved_at=CASE WHEN ?='Resolved' THEN COALESCE(resolved_at,UTC_TIMESTAMP()) ELSE NULL END WHERE id=?",
      [status, note, status, id],
    );
    await connection.execute(
      "INSERT INTO report_audit_log (report_id,actor_email,previous_status,new_status,note) VALUES (?,?,?,?,?)",
      [id, admin.email, rows[0].status, status, note],
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    console.error("Report admin update failed", {
      code: error.code || "UPDATE_ERROR",
    });
    failed = true;
  } finally {
    connection.release();
  }
  revalidatePath("/admin");
  redirect(
    `/admin?report=${encodeURIComponent(id)}&${failed ? "error=update" : "saved=report"}`,
  );
}
export async function saveDepartmentAction(form) {
  assertOrigin();
  requireAdmin();
  const id = value(form, "id", 10),
    cityId = value(form, "city_id", 10),
    name = value(form, "name", 255),
    email = value(form, "email", 255);
  if (
    (id && !/^[1-9]\d{0,9}$/.test(id)) ||
    !/^[1-9]\d{0,9}$/.test(cityId) ||
    !name ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    /[\r\n]/.test(email)
  )
    throw new Error("Invalid department.");
  let failed = false;
  try {
    const [cities] = await database().execute(
      "SELECT id FROM cities WHERE id=?",
      [cityId],
    );
    if (!cities.length) throw new Error("Municipality unavailable");
    if (id) {
      const [result] = await database().execute(
        "UPDATE departments SET name=?,notification_email=? WHERE id=? AND city_id=?",
        [name, email, id, cityId],
      );
      if (!result.affectedRows) throw new Error("Department unavailable");
    } else
      await database().execute(
        "INSERT INTO departments (city_id,name,notification_email) VALUES (?,?,?)",
        [cityId, name, email],
      );
  } catch (error) {
    console.error("Department update failed", {
      code: error.code || "UPDATE_ERROR",
    });
    failed = true;
  }
  revalidatePath("/admin");
  redirect(
    `/admin?${failed ? "error=department" : "saved=department"}#departments`,
  );
}
export async function saveRouteAction(form) {
  assertOrigin();
  requireAdmin();
  const cityId = value(form, "city_id", 10),
    departmentId = value(form, "department_id", 10),
    category = value(form, "category", 100),
    active = form.get("active") === "on";
  if (
    !/^[1-9]\d{0,9}$/.test(cityId) ||
    !/^[1-9]\d{0,9}$/.test(departmentId) ||
    !categories.includes(category)
  )
    throw new Error("Invalid routing assignment.");
  let failed = false;
  try {
    const [departments] = await database().execute(
      "SELECT id FROM departments WHERE id=? AND city_id=?",
      [departmentId, cityId],
    );
    if (!departments.length)
      throw new Error("Department must belong to the selected municipality");
    await database().execute(
      "INSERT INTO department_routes (city_id,category,department_id,active) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE department_id=VALUES(department_id),active=VALUES(active)",
      [cityId, category, departmentId, active],
    );
  } catch (error) {
    console.error("Routing update failed", {
      code: error.code || "UPDATE_ERROR",
    });
    failed = true;
  }
  revalidatePath("/admin");
  redirect(`/admin?${failed ? "error=route" : "saved=route"}#departments`);
}
