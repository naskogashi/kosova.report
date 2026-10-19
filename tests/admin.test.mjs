import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { SourceTextModule, SyntheticModule } from "node:vm";
const auth = await import(
  `data:text/javascript;base64,${Buffer.from(readFileSync("src/lib/admin-auth.js", "utf8").replace(/^\uFEFF/, "")).toString("base64")}`
);
const password = "Test account password 2026!";
const passwordHash = auth.hashPassword(password);
const config = auth.adminConfig({
  ADMIN_EMAIL: "Staff@example.com",
  ADMIN_PASSWORD_HASH: passwordHash,
  ADMIN_SESSION_SECRET: "a".repeat(64),
  APP_URL: "https://kosova.report",
});
test("administrator access fails closed without configuration", () => {
  assert.equal(auth.adminConfig({}), null);
  assert.equal(
    auth.adminConfig({
      ADMIN_EMAIL: "x",
      ADMIN_PASSWORD_HASH: "plaintext",
      ADMIN_SESSION_SECRET: "short",
      APP_URL: "https://kosova.report",
    }),
    null,
  );
  assert.equal(auth.verifySession("anything", null), null);
});
test("scrypt validates correct passwords and rejects wrong or malformed values", () => {
  assert.equal(auth.verifyPassword(password, passwordHash), true);
  assert.equal(auth.verifyPassword("incorrect", passwordHash), false);
  assert.equal(auth.verifyPassword(password, "plaintext"), false);
  assert.throws(() => auth.hashPassword("short"));
});
test("sessions reject tampering and expire after eight hours", () => {
  const now = 1792400000000,
    token = auth.issueSession(config, now);
  assert.deepEqual(auth.verifySession(token, config, now + 1000), {
    email: "staff@example.com",
  });
  assert.equal(auth.verifySession(`${token}x`, config, now), null);
  assert.equal(
    auth.verifySession(token, config, now + auth.SESSION_SECONDS * 1000),
    null,
  );
});
test("password or signing-secret rotation invalidates sessions", () => {
  const token = auth.issueSession(config);
  assert.equal(
    auth.verifySession(token, { ...config, secret: "b".repeat(64) }),
    null,
  );
  assert.equal(
    auth.verifySession(token, {
      ...config,
      passwordHash: auth.hashPassword("A different password 2026!"),
    }),
    null,
  );
});
async function actions({
  attempts = 1,
  authorized = true,
  origin = config.origin,
} = {}) {
  const queries = [],
    cookieWrites = [];
  let checked = false;
  const execute = async (sql, values) => {
    queries.push({ sql, values });
    if (sql.startsWith("SELECT attempts")) return [[{ attempts }]];
    if (sql.startsWith("SELECT status")) return [[{ status: "Pending" }]];
    if (sql.startsWith("SELECT id FROM departments")) return [[]];
    return [{}];
  };
  const connection = {
    execute,
    beginTransaction: async () => queries.push({ sql: "BEGIN" }),
    commit: async () => queries.push({ sql: "COMMIT" }),
    rollback: async () => queries.push({ sql: "ROLLBACK" }),
    release() {},
  };
  const mocks = {
    "next/headers": {
      headers: () => ({ get: () => origin }),
      cookies: () => ({ set: (...args) => cookieWrites.push(args) }),
    },
    "next/navigation": {
      redirect: (url) => {
        throw Object.assign(Error("redirect"), { url });
      },
    },
    "next/cache": { revalidatePath: () => {} },
    "../../lib/db": {
      database: () => ({ execute, getConnection: async () => connection }),
    },
    "../../lib/admin-auth": { ...auth, adminConfig: () => config },
    "../../lib/admin-session": {
      requireAdmin: () => {
        checked = true;
        if (!authorized) throw Error("unauthorized");
        return { email: config.email };
      },
    },
    "../../lib/report-options": {
      categories: ["infrastructure"],
      cities: [{ code: "PR" }],
    },
  };
  const module = new SourceTextModule(
    readFileSync("src/app/admin/actions.js", "utf8"),
  );
  await module.link(async (name) => {
    const values = mocks[name];
    assert.ok(values, `Unknown import ${name}`);
    return new SyntheticModule(Object.keys(values), function () {
      for (const [key, value] of Object.entries(values))
        this.setExport(key, value);
    });
  });
  await module.evaluate();
  return {
    action: module.namespace,
    queries,
    cookieWrites,
    get checked() {
      return checked;
    },
  };
}
const loginForm = () => {
  const form = new FormData();
  form.set("email", config.email);
  form.set("password", password);
  return form;
};
test("login issues protected session cookie after checking database limit", async () => {
  const app = await actions();
  await assert.rejects(
    app.action.loginAction({}, loginForm()),
    (error) => error.url === "/admin",
  );
  assert.equal(app.cookieWrites.length, 1);
  const [name, token, options] = app.cookieWrites[0];
  assert.equal(name, auth.ADMIN_COOKIE);
  assert.equal(auth.verifySession(token, config).email, config.email);
  assert.equal(options.httpOnly, true);
  assert.equal(options.secure, true);
  assert.equal(options.sameSite, "strict");
});
test("login exceeding shared attempt limit cannot issue a cookie", async () => {
  const app = await actions({ attempts: 6 });
  const result = await app.action.loginAction({}, loginForm());
  assert.match(result.error, /Too many/);
  assert.equal(app.cookieWrites.length, 0);
});
test("cross-origin and unauthenticated report changes never reach database", async () => {
  for (const options of [
    { origin: "https://other.example" },
    { authorized: false },
  ]) {
    const app = await actions(options);
    await assert.rejects(app.action.updateReportAction(new FormData()));
    assert.equal(app.queries.length, 0);
  }
});
test("admin report update locks row and commits the audit record atomically", async () => {
  const app = await actions();
  const form = new FormData();
  form.set("id", "7");
  form.set("status", "Resolved");
  form.set("note", "Repair confirmed by department");
  await assert.rejects(app.action.updateReportAction(form), (error) =>
    error.url?.includes("saved=report"),
  );
  assert.ok(app.checked);
  assert.ok(app.queries.some((query) => query.sql.includes("FOR UPDATE")));
  const audit = app.queries.find((query) =>
    query.sql.startsWith("INSERT INTO report_audit_log"),
  );
  assert.equal(audit.values[1], config.email);
  assert.equal(audit.values[2], "Pending");
  assert.equal(audit.values[3], "Resolved");
  assert.equal(app.queries.at(-1).sql, "COMMIT");
});

test("routing cannot assign a department from a different municipality", async () => {
  const app = await actions();
  const form = new FormData();
  form.set("city_id", "1");
  form.set("department_id", "2");
  form.set("category", "infrastructure");
  form.set("active", "on");
  await assert.rejects(app.action.saveRouteAction(form), (error) =>
    error.url?.includes("error=route"),
  );
  assert.ok(
    !app.queries.some((query) =>
      query.sql.startsWith("INSERT INTO department_routes"),
    ),
  );
});
