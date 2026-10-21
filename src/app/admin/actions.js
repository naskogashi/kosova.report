"use server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createHash } from "node:crypto";
import { database } from "../../lib/db";
import {
  siteConfig,
  hashPassword,
  verifyPassword,
  randomPassword,
} from "../../lib/admin-auth";
import {
  requireAdmin,
  requireOwner,
  createSessionRecord,
  setSessionCookie,
  endSession,
} from "../../lib/admin-session";
import {
  queueStatusEmails,
  deliverStatusEmails,
} from "../../lib/report-notifications";
import { categories } from "../../lib/report-options";
import { syncIncidentStatus } from "../../lib/incidents";
import { setReportStatus, closedError } from "../../lib/report-status";
import { deliverPush } from "../../lib/push";
async function assertOrigin() {
  if ((await headers()).get("origin") !== siteConfig().origin)
    throw new Error("Request origin not allowed");
}
function value(form, key, max) {
  const item = form.get(key);
  if (typeof item !== "string" || item.length > max)
    throw new Error("Invalid form data");
  return item.trim();
}
const validId = (value) => /^[1-9]\d{0,9}$/.test(String(value));
export async function loginAction(previous, form) {
  let signedIn = false;
  try {
    await assertOrigin();
    const email = value(form, "email", 254).toLowerCase(),
      password = form.get("password");
    if (typeof password !== "string" || Buffer.byteLength(password) > 1024)
      return { error: "Check your email and password." };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return { error: "Check your email and password." };
    const globalBucket = createHash("sha256")
      .update("staff-login-global")
      .digest("hex");
    await database().execute(
      "INSERT INTO admin_login_limits (bucket,attempts,window_started) VALUES (?,1,UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE attempts=IF(window_started<UTC_TIMESTAMP()-INTERVAL 15 MINUTE,1,LEAST(attempts+1,1000000)),window_started=IF(window_started<UTC_TIMESTAMP()-INTERVAL 15 MINUTE,UTC_TIMESTAMP(),window_started)",
      [globalBucket],
    );
    const [globalLimit] = await database().execute(
      "SELECT attempts FROM admin_login_limits WHERE bucket=?",
      [globalBucket],
    );
    if (globalLimit[0].attempts > 100)
      return { error: "Too many attempts. Try again in 15 minutes." };
    const bucket = createHash("sha256")
      .update("staff-login:" + email)
      .digest("hex");
    await database().execute(
      "INSERT INTO admin_login_limits (bucket,attempts,window_started) VALUES (?,1,UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE attempts=IF(window_started<UTC_TIMESTAMP()-INTERVAL 15 MINUTE,1,LEAST(attempts+1,1000000)),window_started=IF(window_started<UTC_TIMESTAMP()-INTERVAL 15 MINUTE,UTC_TIMESTAMP(),window_started)",
      [bucket],
    );
    const [limit] = await database().execute(
      "SELECT attempts FROM admin_login_limits WHERE bucket=?",
      [bucket],
    );
    if (limit[0].attempts > 5)
      return { error: "Too many attempts. Try again in 15 minutes." };
    const connection = await database().getConnection();
    let account, newSession;
    try {
      await connection.beginTransaction();
      const [rows] = await connection.execute(
        "SELECT id,password_hash,must_change_password,temporary_expires_at FROM staff_accounts WHERE email=? AND active=1 FOR UPDATE",
        [email],
      );
      account = rows[0];
      if (
        !account ||
        !verifyPassword(password, account.password_hash) ||
        (account.must_change_password &&
          (!account.temporary_expires_at ||
            new Date(account.temporary_expires_at) <= new Date()))
      ) {
        await connection.rollback();
        return {
          error:
            "Check your email/password. Temporary passwords expire and work once.",
        };
      }
      if (account.must_change_password)
        await connection.execute(
          "UPDATE staff_accounts SET password_hash=?,temporary_expires_at=NULL WHERE id=?",
          [hashPassword(randomPassword()), account.id],
        );
      newSession = await createSessionRecord(
        account.id,
        Boolean(account.must_change_password),
        connection,
      );
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
    await database().execute("DELETE FROM admin_login_limits WHERE bucket=?", [
      bucket,
    ]);
    await setSessionCookie(newSession);
    signedIn = true;
  } catch (error) {
    console.error("Staff sign-in unavailable", {
      code: error.code || "AUTH_ERROR",
    });
    return {
      error:
        "Sign-in is unavailable. The server administrator must run the platform setup command first.",
    };
  }
  if (signedIn) redirect("/admin");
}
export async function logoutAction() {
  await assertOrigin();
  await endSession();
  redirect("/admin/login");
}
export async function updateAccountAction(previous, form) {
  let newSession;
  await assertOrigin();
  const account = await requireAdmin({ allowPasswordChange: true });
  try {
    const name = value(form, "name", 120),
      email = value(form, "email", 254).toLowerCase(),
      current = form.get("current_password"),
      password = form.get("new_password"),
      confirm = form.get("confirm_password");
    if (
      !name ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      password !== confirm
    )
      return {
        error: "Provide a name, valid email and matching new passwords.",
      };
    const passwordHash = hashPassword(password);
    const connection = await database().getConnection();
    try {
      await connection.beginTransaction();
      const [rows] = await connection.execute(
        "SELECT password_hash,must_change_password FROM staff_accounts WHERE id=? AND active=1 FOR UPDATE",
        [account.id],
      );
      if (
        !rows.length ||
        (!rows[0].must_change_password &&
          !verifyPassword(current, rows[0].password_hash))
      )
        throw new Error("Current password is incorrect");
      await connection.execute(
        "UPDATE staff_accounts SET name=?,email=?,password_hash=?,must_change_password=0,temporary_expires_at=NULL WHERE id=?",
        [name, email, passwordHash, account.id],
      );
      await connection.execute(
        "DELETE FROM staff_sessions WHERE account_id=?",
        [account.id],
      );
      newSession = await createSessionRecord(account.id, false, connection);
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
    await setSessionCookie(newSession);
  } catch (error) {
    return {
      error:
        error.code === "ER_DUP_ENTRY"
          ? "That email is already used."
          : "Could not update your account. Check the current password and use at least 14 characters for the new password.",
    };
  }
  redirect("/admin");
}
// Name and email, confirmed with the current password. Sessions stay signed in.
export async function updateProfileAction(previous, form) {
  await assertOrigin();
  const account = await requireAdmin();
  const name = value(form, "name", 120),
    email = value(form, "email", 254).toLowerCase(),
    current = form.get("current_password");
  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return { error: "Provide a name and a valid email.", at: Date.now() };
  try {
    const [rows] = await database().execute(
      "SELECT password_hash FROM staff_accounts WHERE id=? AND active=1",
      [account.id],
    );
    if (!rows.length || typeof current !== "string" || !verifyPassword(current, rows[0].password_hash))
      return { error: "Current password is incorrect.", at: Date.now() };
    await database().execute("UPDATE staff_accounts SET name=?,email=? WHERE id=?", [name, email, account.id]);
  } catch (error) {
    return {
      error: error.code === "ER_DUP_ENTRY" ? "That email is already used." : "Could not save your details.",
      at: Date.now(),
    };
  }
  revalidatePath("/admin/account");
  return { saved: "Details saved.", at: Date.now() };
}

// New password, confirmed with the current one. Signs out every other session.
export async function changePasswordAction(previous, form) {
  let newSession;
  await assertOrigin();
  const account = await requireAdmin();
  const current = form.get("current_password"),
    password = form.get("new_password"),
    confirm = form.get("confirm_password");
  if (typeof password !== "string" || password.length < 14 || password.length > 1024)
    return { error: "Use at least 14 characters for the new password.", at: Date.now() };
  if (password !== confirm) return { error: "The new passwords don't match.", at: Date.now() };
  const connection = await database().getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute(
      "SELECT password_hash FROM staff_accounts WHERE id=? AND active=1 FOR UPDATE",
      [account.id],
    );
    if (!rows.length || typeof current !== "string" || !verifyPassword(current, rows[0].password_hash)) {
      await connection.rollback();
      return { error: "Current password is incorrect.", at: Date.now() };
    }
    await connection.execute(
      "UPDATE staff_accounts SET password_hash=?,must_change_password=0,temporary_expires_at=NULL WHERE id=?",
      [hashPassword(password), account.id],
    );
    await connection.execute("DELETE FROM staff_sessions WHERE account_id=?", [account.id]);
    newSession = await createSessionRecord(account.id, false, connection);
    await connection.commit();
  } catch {
    await connection.rollback().catch(() => {});
    return { error: "Could not change the password. Try again.", at: Date.now() };
  } finally {
    connection.release();
  }
  await setSessionCookie(newSession);
  return { saved: "Password changed. Other devices were signed out.", at: Date.now() };
}

export async function createCheckerAction(previous, form) {
  await assertOrigin();
  await requireOwner();
  try {
    const name = value(form, "name", 120),
      email = value(form, "email", 254).toLowerCase(),
      // Owners can create report checkers or other admins (owners).
      role = form.get("role") === "owner" ? "owner" : "checker";
    if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return { error: "A name and valid email are required." };
    const password = randomPassword();
    await database().execute(
      "INSERT INTO staff_accounts (name,email,password_hash,role,must_change_password,temporary_expires_at) VALUES (?,?,?,?,1,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 24 HOUR))",
      [name, email, hashPassword(password), role],
    );
    revalidatePath("/admin/settings");
    return { email, password, role };
  } catch {
    return {
      error: "Could not create the account. That email may already be in use.",
    };
  }
}
export async function resetCheckerAction(previous, form) {
  await assertOrigin();
  await requireOwner();
  const id = value(form, "id", 10);
  if (!validId(id)) return { error: "Invalid checker" };
  try {
    const password = randomPassword();
    const [result] = await database().execute(
      "UPDATE staff_accounts SET password_hash=?,must_change_password=1,temporary_expires_at=DATE_ADD(UTC_TIMESTAMP(),INTERVAL 24 HOUR) WHERE id=? AND role='checker'",
      [hashPassword(password), id],
    );
    if (!result.affectedRows) throw Error();
    await database().execute("DELETE FROM staff_sessions WHERE account_id=?", [
      id,
    ]);
    return { password };
  } catch {
    return { error: "Could not reset checker." };
  }
}
export async function toggleCheckerAction(form) {
  await assertOrigin();
  await requireOwner();
  const id = value(form, "id", 10);
  if (!validId(id)) throw Error("Invalid checker");
  await database().execute(
    "UPDATE staff_accounts SET active=? WHERE id=? AND role='checker'",
    [form.get("active") === "on", id],
  );
  await database().execute("DELETE FROM staff_sessions WHERE account_id=?", [
    id,
  ]);
  revalidatePath("/admin/settings");
}
export async function updateReportAction(form) {
  await assertOrigin();
  const account = await requireOwner();
  const id = value(form, "id", 10),
    status = value(form, "status", 20),
    note = value(form, "note", 5000);
  if (!validId(id) || !["Pending", "In Progress", "Resolved"].includes(status))
    throw Error("Invalid update");
  const connection = await database().getConnection();
  let failed = false,
    eventKey,
    shared = [];
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute(
      "SELECT status,anonymized_at FROM reports WHERE id=? FOR UPDATE",
      [id],
    );
    if (!rows.length) throw Error("Report unavailable");
    // An anonymized report keeps only statistics; no new notes or statuses.
    if (rows[0].anonymized_at) throw closedError();
    await connection.execute("UPDATE reports SET admin_note=? WHERE id=?", [
      note,
      id,
    ]);
    if (rows[0].status !== status)
      await setReportStatus(connection, id, status);
    const [audit] = await connection.execute(
      "INSERT INTO report_audit_log (report_id,actor_email,previous_status,new_status,note) VALUES (?,?,?,?,?)",
      [id, account.email, rows[0].status, status, note],
    );
    if (rows[0].status !== status) {
      eventKey = `audit:${audit.insertId}`;
      await queueStatusEmails(connection, id, eventKey);
      // Other reports of the same problem move with it.
      shared = await syncIncidentStatus(connection, id, status, account.email);
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    failed = true;
    console.error("Report update failed", {
      code: error.code || "UPDATE_ERROR",
    });
  } finally {
    connection.release();
  }
  let pending = 0;
  for (const key of eventKey && !failed ? [eventKey, ...shared] : []) {
    try {
      pending += (await deliverStatusEmails(key)).pending;
    } catch {
      pending++;
    }
  }
  if (eventKey && !failed) {
    // The citizen's own devices hear about it at once.
    try {
      await deliverPush(database());
    } catch {
      console.error("Push delivery pending");
    }
  }
  revalidatePath("/admin");
  redirect(
    `/admin?report=${id}&${failed ? "error=update" : pending ? "saved=email_pending" : "saved=report"}`,
  );
}
export async function assignCheckerAction(form) {
  await assertOrigin();
  await requireOwner();
  const reportId = value(form, "report_id", 10),
    accountId = value(form, "account_id", 10);
  if (!validId(reportId) || !validId(accountId))
    throw Error("Invalid assignment");
  const [users] = await database().execute(
    "SELECT id FROM staff_accounts WHERE id=? AND role='checker' AND active=1 AND must_change_password=0",
    [accountId],
  );
  if (!users.length)
    throw Error("Checker must be active and finish first sign-in");
  await database().execute(
    "INSERT INTO report_assignments (report_id,account_id) VALUES (?,?) ON DUPLICATE KEY UPDATE account_id=VALUES(account_id),assigned_at=CURRENT_TIMESTAMP",
    [reportId, accountId],
  );
  revalidatePath("/admin");
  redirect(`/admin?report=${reportId}&saved=assignment`);
}
export async function reviewReportAction(form) {
  await assertOrigin();
  const account = await requireAdmin();
  const reportId = value(form, "report_id", 10),
    note = value(form, "note", 5000);
  if (!validId(reportId)) throw Error("Invalid report");
  if (account.role !== "owner") {
    const [assignments] = await database().execute(
      "SELECT report_id FROM report_assignments WHERE report_id=? AND account_id=?",
      [reportId, account.id],
    );
    if (!assignments.length) throw Error("Report not assigned to this checker");
  }
  await database().execute(
    "INSERT INTO report_reviews (report_id,account_id,note) VALUES (?,?,?) ON DUPLICATE KEY UPDATE note=VALUES(note),checked_at=CURRENT_TIMESTAMP",
    [reportId, account.id, note],
  );
  revalidatePath("/admin");
  redirect(`/admin?report=${reportId}&saved=checked`);
}
export async function saveDepartmentAction(form) {
  await assertOrigin();
  await requireOwner();
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
  revalidatePath("/admin/settings");
  redirect(
    `/admin/settings?${failed ? "error=department" : "saved=department"}#departments`,
  );
}
const routeSaveError =
  "Could not save the assignment. The department must belong to the selected municipality.";
const emailValid = (email) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && !/[\r\n]/.test(email);
// Owners see the database's own reason when a save fails, so a schema
// difference on the server shows up instead of a silent failure.
const databaseReason = (error) =>
  error?.code ? `${error.code}${error.sqlMessage ? `: ${error.sqlMessage}` : ""}`.slice(0, 300) : undefined;

// Adds or edits one department of a municipality. Returns a state for useActionState.
export async function saveDepartmentInlineAction(previous, form) {
  await assertOrigin();
  await requireOwner();
  const id = value(form, "id", 10),
    cityId = value(form, "city_id", 10),
    name = value(form, "name", 255),
    email = value(form, "email", 255).toLowerCase();
  if ((id && !validId(id)) || !validId(cityId))
    return { error: "Could not save the department.", at: Date.now() };
  if (!name) return { error: "Write the department's name.", at: Date.now() };
  if (!emailValid(email))
    return { error: "Write a valid email address for the department.", at: Date.now() };
  try {
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
    console.error("Department update failed", { code: error.code || "UPDATE_ERROR" });
    return { error: "Could not save the department.", detail: databaseReason(error), at: Date.now() };
  }
  revalidatePath("/admin/settings");
  return { saved: id ? "Department saved." : "Department added.", at: Date.now() };
}

// Routes one category of a municipality to a department. With department_id "new"
// it first creates that department (name + email), in the same transaction.
export async function saveRouteAction(previous, form) {
  await assertOrigin();
  await requireOwner();
  const cityId = value(form, "city_id", 10),
    departmentChoice = value(form, "department_id", 10),
    category = value(form, "category", 100),
    active = form.get("active") === "on";
  const creating = departmentChoice === "new";
  const newName = value(form, "new_name", 255),
    newEmail = value(form, "new_email", 255).toLowerCase();
  if (!validId(cityId) || !categories.includes(category) || (!creating && !validId(departmentChoice)))
    return { error: "Choose a department for this category.", at: Date.now() };
  if (creating && !newName) return { error: "Write the new department's name.", at: Date.now() };
  if (creating && !emailValid(newEmail))
    return { error: "Write a valid email address for the new department.", at: Date.now() };
  const connection = await database().getConnection();
  try {
    await connection.beginTransaction();
    let departmentId = departmentChoice;
    if (creating) {
      const [inserted] = await connection.execute(
        "INSERT INTO departments (city_id,name,notification_email) VALUES (?,?,?)",
        [cityId, newName, newEmail],
      );
      departmentId = inserted.insertId;
    } else {
      const [departments] = await connection.execute(
        "SELECT id FROM departments WHERE id=? AND city_id=?",
        [departmentId, cityId],
      );
      if (!departments.length) throw new Error("Department must belong to the selected municipality");
    }
    await connection.execute(
      "INSERT INTO department_routes (city_id,category,department_id,active) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE department_id=VALUES(department_id),active=VALUES(active)",
      [cityId, category, departmentId, active],
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback().catch(() => {});
    console.error("Routing update failed", { code: error.code || "UPDATE_ERROR" });
    return { error: routeSaveError, detail: databaseReason(error), at: Date.now() };
  } finally {
    connection.release();
  }
  revalidatePath("/admin/settings");
  return { saved: "Assignment saved.", at: Date.now() };
}
export async function deleteRouteAction(previous, form) {
  await assertOrigin();
  await requireOwner();
  const cityId = value(form, "city_id", 10),
    category = value(form, "category", 100);
  if (!validId(cityId) || !categories.includes(category))
    return { error: "Could not delete the assignment.", at: Date.now() };
  try {
    await database().execute(
      "DELETE FROM department_routes WHERE city_id=? AND category=?",
      [cityId, category],
    );
  } catch (error) {
    console.error("Routing delete failed", {
      code: error.code || "DELETE_ERROR",
    });
    return { error: "Could not delete the assignment.", at: Date.now() };
  }
  revalidatePath("/admin/settings");
  return { saved: "Assignment deleted.", at: Date.now() };
}
export async function saveCountryAction(form) {
  await assertOrigin();
  await requireOwner();
  const id = value(form, "id", 10),
    name = value(form, "name", 100),
    code = value(form, "code", 10).toUpperCase();
  if (!name || !/^[A-Z0-9]{2,10}$/.test(code) || (id && !validId(id)))
    throw Error("Invalid country");
  try {
    if (id)
      await database().execute(
        "UPDATE countries SET name=?,code=? WHERE id=?",
        [name, code, id],
      );
    else
      await database().execute(
        "INSERT INTO countries (name,code) VALUES (?,?)",
        [name, code],
      );
  } catch {
    redirect("/admin/settings?error=country#geography");
  }
  revalidatePath("/admin/settings");
  redirect("/admin/settings?saved=country#geography");
}
export async function saveCityAction(form) {
  await assertOrigin();
  await requireOwner();
  const id = value(form, "id", 10),
    countryId = value(form, "country_id", 10),
    name = value(form, "name", 100),
    code = value(form, "code", 10).toUpperCase(),
    latitude = Number(value(form, "latitude", 30)),
    longitude = Number(value(form, "longitude", 30)),
    zoom = Number(value(form, "zoom", 2)),
    enabled = form.get("enabled") === "on";
  if (
    (id && !validId(id)) ||
    !validId(countryId) ||
    !name ||
    !/^[A-Z0-9]{2,10}$/.test(code) ||
    !Number.isFinite(latitude) ||
    latitude < -90 ||
    latitude > 90 ||
    !Number.isFinite(longitude) ||
    longitude < -180 ||
    longitude > 180 ||
    !Number.isInteger(zoom) ||
    zoom < 3 ||
    zoom > 18
  )
    throw Error("Invalid city settings");
  const connection = await database().getConnection();
  let failed = false;
  try {
    await connection.beginTransaction();
    let cityId = id;
    if (id) {
      const [old] = await connection.execute(
        "SELECT code FROM cities WHERE id=? FOR UPDATE",
        [id],
      );
      if (!old.length) throw Error("City unavailable");
      if (old[0].code.toUpperCase() !== code) {
        const [reports] = await connection.execute(
          "SELECT id FROM reports WHERE city_id=? LIMIT 1",
          [id],
        );
        if (reports.length)
          throw Error("City prefix cannot change after reports exist");
      }
      await connection.execute(
        "UPDATE cities SET country_id=?,name=?,code=? WHERE id=?",
        [countryId, name, code, id],
      );
    } else {
      const [created] = await connection.execute(
        "INSERT INTO cities (country_id,name,code) VALUES (?,?,?)",
        [countryId, name, code],
      );
      cityId = created.insertId;
    }
    await connection.execute(
      "INSERT INTO municipality_settings (city_id,enabled,latitude,longitude,zoom_level) VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE enabled=VALUES(enabled),latitude=VALUES(latitude),longitude=VALUES(longitude),zoom_level=VALUES(zoom_level)",
      [cityId, enabled, latitude, longitude, zoom],
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    failed = true;
  } finally {
    connection.release();
  }
  revalidatePath("/admin/settings");
  redirect(`/admin/settings?${failed ? "error=city" : "saved=city"}#geography`);
}
