import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SourceTextModule, SyntheticModule } from "node:vm";
import test from "node:test";
const auth = await import(
  `data:text/javascript;base64,${Buffer.from(readFileSync("src/lib/admin-auth.js", "utf8").replace(/^\uFEFF/, "")).toString("base64")}`
);
async function load(file, mocks) {
  const module = new SourceTextModule(readFileSync(file, "utf8"));
  await module.link(async (name) => {
    const values = mocks[name];
    assert.ok(values, `Unexpected import ${name}`);
    return new SyntheticModule(Object.keys(values), function () {
      for (const [key, value] of Object.entries(values))
        this.setExport(key, value);
    });
  });
  await module.evaluate();
  return module.namespace;
}
const redirect = (url) => {
  throw Object.assign(Error("redirect"), { url });
};
const password = "One time staff password 2026!";
test("password hashing rejects short credentials and validates without storing plaintext", () => {
  const hash = auth.hashPassword(password);
  assert.ok(!hash.includes(password));
  assert.ok(auth.verifyPassword(password, hash));
  assert.ok(!auth.verifyPassword("incorrect", hash));
  assert.throws(() => auth.hashPassword("short"));
  assert.throws(() => auth.siteConfig({ APP_URL: "http://public.example" }));
});
async function actions({
  role = "owner",
  origin = "https://kosova.report",
  assigned = true,
  attempts = 1,
  anonymized = false,
} = {}) {
  const queries = [],
    sessions = [];
  let row = {
    id: 1,
    password_hash: auth.hashPassword(password),
    must_change_password: 1,
    temporary_expires_at: new Date(Date.now() + 86400000),
  };
  const execute = async (sql, values) => {
    queries.push({ sql, values });
    if (sql.startsWith("SELECT attempts")) return [[{ attempts }]];
    if (sql.startsWith("SELECT id,password_hash")) return [[row]];
    if (
      sql.startsWith(
        "UPDATE staff_accounts SET password_hash=?,temporary_expires_at=NULL",
      )
    ) {
      row = { ...row, password_hash: values[0], temporary_expires_at: null };
      return [{ affectedRows: 1 }];
    }
    if (sql.startsWith("SELECT status,anonymized_at FROM reports"))
      return [[{ status: "Pending", anonymized_at: anonymized ? new Date() : null }]];
    if (sql.startsWith("SELECT public_id FROM reports")) return [[{ public_id: "PR-2026-000007" }]];
    if (sql.startsWith("SELECT email FROM staff_accounts WHERE id=?")) return [[{ email: "Besa@kosova.report" }]];
    if (sql.startsWith("SELECT report_id FROM report_assignments"))
      return [assigned ? [{ report_id: 7 }] : []];
    if (sql.startsWith("SELECT id FROM departments")) return [[]];
    return [{ insertId: 10, affectedRows: 1 }];
  };
  const connection = {
    execute,
    beginTransaction: async () => queries.push({ sql: "BEGIN" }),
    commit: async () => queries.push({ sql: "COMMIT" }),
    rollback: async () => queries.push({ sql: "ROLLBACK" }),
    release() {},
  };
  const account = {
    id: 1,
    role,
    email: "owner@kosova.report",
    name: "Owner",
    must_change_password: 0,
  };
  const action = await load("src/app/admin/actions.js", {
    "next/headers": { headers: () => ({ get: () => origin }) },
    "next/navigation": { redirect },
    "next/cache": { revalidatePath() {} },
    "node:crypto": await import("node:crypto"),
    "../../lib/db": {
      database: () => ({ execute, getConnection: async () => connection }),
    },
    "../../lib/admin-auth": {
      ...auth,
      siteConfig: () => ({ origin: "https://kosova.report", secure: true }),
    },
    "../../lib/admin-session": {
      requireAdmin: async () => account,
      requireOwner: async () => {
        if (role !== "owner") redirect("/admin");
        return account;
      },
      createSessionRecord: async (accountId, temporary) => ({
        accountId,
        temporary,
      }),
      setSessionCookie: (record) =>
        sessions.push([record.accountId, record.temporary]),
      endSession: async () => {},
    },
    "../../lib/report-notifications": {
      queueStatusEmails: async () => queries.push({ sql: "QUEUE_EMAIL" }),
      deliverStatusEmails: async () => ({ pending: 0 }),
    },
    "../../lib/report-options": { categories: ["infrastructure"] },
    "../../lib/incidents": { syncIncidentStatus: async () => [] },
    "../../lib/account-deletion": {
      AccountDeletionError: class extends Error {},
      deleteAccount: async (db, id, by) => queries.push({ sql: "DELETE_ACCOUNT", values: [id, by.email] }),
    },
    "../../lib/report-deletion": {
      deleteReport: async (db, id, by) => queries.push({ sql: "DELETE_REPORT", values: [id, by.email] }),
    },
    "../../lib/push": { deliverPush: async () => queries.push({ sql: "DELIVER_PUSH" }) },
    "../../lib/report-status": {
      setReportStatus: async (connection, reportId, status) =>
        queries.push({ sql: "SET_STATUS", values: [reportId, status] }),
      closedError: () => new Error("Report is closed and anonymized"),
    },
  });
  return { action, queries, sessions };
}
const form = (values) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
};
test("one-time password permits one sign-in and forces replacement", async () => {
  const app = await actions();
  const credentials = form({ email: "owner@kosova.report", password });
  await assert.rejects(
    app.action.loginAction({}, credentials),
    (error) => error.url === "/admin",
  );
  assert.deepEqual(app.sessions, [[1, true]]);
  const second = await app.action.loginAction({}, credentials);
  assert.match(second.error, /Temporary passwords/);
  assert.equal(app.sessions.length, 1);
});
test("login throttling prevents issuing a session", async () => {
  const app = await actions({ attempts: 6 });
  const result = await app.action.loginAction(
    {},
    form({ email: "owner@kosova.report", password }),
  );
  assert.match(result.error, /Too many/);
  assert.equal(app.sessions.length, 0);
});
test("checker and cross-origin callers cannot update municipal status or routing", async () => {
  for (const options of [
    { role: "checker" },
    { origin: "https://other.example" },
  ]) {
    const app = await actions(options);
    await assert.rejects(
      app.action.updateReportAction(
        form({ id: "7", status: "Resolved", note: "Resolved" }),
      ),
    );
    assert.equal(app.queries.length, 0);
    await assert.rejects(app.action.saveDepartmentAction(new FormData()));
    assert.equal(app.queries.length, 0);
  }
});
test("owner status update commits audit and queues both progress emails atomically", async () => {
  const app = await actions();
  await assert.rejects(
    app.action.updateReportAction(
      form({ id: "7", status: "In Progress", note: "Municipality contacted" }),
    ),
    (error) => error.url?.includes("saved=report"),
  );
  assert.ok(app.queries.some((query) => query.sql.includes("FOR UPDATE")));
  assert.ok(
    app.queries.findIndex((query) => query.sql === "QUEUE_EMAIL") <
      app.queries.findIndex((query) => query.sql === "COMMIT"),
  );
  const audit = app.queries.find((query) =>
    query.sql.startsWith("INSERT INTO report_audit_log"),
  );
  assert.equal(audit.values[2], "Pending");
  assert.equal(audit.values[3], "In Progress");
  const change = app.queries.find((query) => query.sql === "SET_STATUS");
  assert.deepEqual(change.values, ["7", "In Progress"]);
  // Pushes go out after commit, never inside the transaction.
  assert.ok(app.queries.findIndex((query) => query.sql === "DELIVER_PUSH") > app.queries.findIndex((query) => query.sql === "COMMIT"));
});
test("an anonymized report takes no new note or status", async () => {
  const app = await actions({ anonymized: true });
  await assert.rejects(
    app.action.updateReportAction(
      form({ id: "7", status: "In Progress", note: "Reopened" }),
    ),
    (error) => error.url?.includes("error=update"),
  );
  assert.ok(app.queries.some((query) => query.sql === "ROLLBACK"));
  assert.ok(
    !app.queries.some(
      (query) =>
        query.sql === "SET_STATUS" ||
        query.sql.startsWith("UPDATE reports") ||
        query.sql.startsWith("INSERT INTO report_audit_log"),
    ),
  );
});
test("a checker cannot inspect/mark a report assigned to another checker", async () => {
  const app = await actions({ role: "checker", assigned: false });
  await assert.rejects(
    app.action.reviewReportAction(form({ report_id: "7", note: "Checked" })),
  );
  assert.ok(
    !app.queries.some((query) =>
      query.sql.startsWith("INSERT INTO report_reviews"),
    ),
  );
});
test("assigned checker saves one distinct review per report", async () => {
  const app = await actions({ role: "checker" });
  await assert.rejects(
    app.action.reviewReportAction(
      form({ report_id: "7", note: "Photo and location verified" }),
    ),
    (error) => error.url?.includes("saved=checked"),
  );
  assert.ok(
    app.queries.some(
      (query) =>
        query.sql.startsWith("INSERT INTO report_reviews") &&
        query.sql.includes("ON DUPLICATE KEY UPDATE"),
    ),
  );
});
test("checker account creation returns a temporary password only to the owner", async () => {
  const app = await actions();
  const result = await app.action.createCheckerAction(
    {},
    form({ name: "Reviewer", email: "reviewer@kosova.report" }),
  );
  assert.ok(result.password);
  const insert = app.queries.find((query) =>
    query.sql.startsWith("INSERT INTO staff_accounts"),
  );
  assert.ok(auth.verifyPassword(result.password, insert.values[2]));
  assert.ok(!insert.values.includes(result.password));
  const checker = await actions({ role: "checker" });
  await assert.rejects(checker.action.createCheckerAction({}, new FormData()));
});
test("sessions store only token hashes and reject expired/unknown cookies", async () => {
  let token,
    stored,
    valid = true;
  const sessions = await load("src/lib/admin-session.js", {
    "next/headers": {
      cookies: () => ({
        get: () => (token ? { value: token } : undefined),
        set: (name, value) => {
          token = value;
        },
      }),
    },
    "next/navigation": { redirect },
    "node:crypto": await import("node:crypto"),
    "./db": {
      database: () => ({
        execute: async (sql, values) => {
          if (sql.startsWith("INSERT")) {
            stored = values[0];
            return [{}];
          }
          return [
            valid
              ? [
                  {
                    id: 1,
                    email: "owner@example.com",
                    role: "owner",
                    must_change_password: 0,
                  },
                ]
              : [],
          ];
        },
      }),
    },
    "./admin-auth": { ...auth, siteConfig: () => ({ secure: true }) },
  });
  assert.equal(await sessions.currentAdmin(), null);
  await sessions.startSession(1);
  assert.equal(stored, auth.digest(token));
  assert.notEqual(stored, token);
  assert.equal((await sessions.currentAdmin()).id, 1);
  valid = false;
  assert.equal(await sessions.currentAdmin(), null);
});
test("database session forces unfinished staff to the account page", async () => {
  const token = "a".repeat(43);
  const sessions = await load("src/lib/admin-session.js", {
    "next/headers": { cookies: () => ({ get: () => ({ value: token }) }) },
    "next/navigation": { redirect },
    "node:crypto": await import("node:crypto"),
    "./db": {
      database: () => ({
        execute: async () => [
          [{ id: 1, role: "checker", must_change_password: 1 }],
        ],
      }),
    },
    "./admin-auth": auth,
  });
  await assert.rejects(
    sessions.requireAdmin(),
    (error) => error.url === "/admin/account",
  );
  assert.equal(
    (await sessions.requireAdmin({ allowPasswordChange: true })).id,
    1,
  );
});

test("only an owner who types the report number deletes it, and the log knows who", async () => {
  const app = await actions();
  await assert.rejects(
    app.action.deleteReportAction(form({ id: "7", confirm: "pr-2026-000007" })),
    (error) => error.url === "/admin?saved=deleted",
  );
  assert.deepEqual(app.queries.find((query) => query.sql === "DELETE_REPORT").values, ["7", "owner@kosova.report"]);

  const wrong = await actions();
  await assert.rejects(
    wrong.action.deleteReportAction(form({ id: "7", confirm: "PR-2026-000008" })),
    (error) => error.url === "/admin?report=7&error=delete_confirm",
  );
  assert.ok(!wrong.queries.some((query) => query.sql === "DELETE_REPORT"));

  for (const options of [{ role: "checker" }, { origin: "https://other.example" }]) {
    const denied = await actions(options);
    await assert.rejects(denied.action.deleteReportAction(form({ id: "7", confirm: "PR-2026-000007" })));
    assert.ok(!denied.queries.some((query) => query.sql === "DELETE_REPORT"));
  }
});

test("only an owner who types the account's email deletes it", async () => {
  const app = await actions();
  await assert.rejects(
    app.action.deleteAccountAction(form({ id: "9", confirm: "besa@kosova.report" })),
    (error) => error.url === "/admin/settings?saved=account_deleted#checkers",
  );
  assert.deepEqual(app.queries.find((query) => query.sql === "DELETE_ACCOUNT").values, ["9", "owner@kosova.report"]);
  const wrong = await actions();
  await assert.rejects(
    wrong.action.deleteAccountAction(form({ id: "9", confirm: "someone@kosova.report" })),
    (error) => error.url === "/admin/settings?error=account_confirm#checkers",
  );
  assert.ok(!wrong.queries.some((query) => query.sql === "DELETE_ACCOUNT"));
  const checker = await actions({ role: "checker" });
  await assert.rejects(checker.action.deleteAccountAction(form({ id: "9", confirm: "besa@kosova.report" })));
  assert.ok(!checker.queries.some((query) => query.sql === "DELETE_ACCOUNT"));
});
