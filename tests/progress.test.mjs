import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SourceTextModule, SyntheticModule } from "node:vm";
import { createHash } from "node:crypto";
import test from "node:test";
const digest = (value) => createHash("sha256").update(value).digest("hex");
async function load(file, mocks) {
  const module = new SourceTextModule(readFileSync(file, "utf8"));
  await module.link(async (name) => {
    const values = mocks[name];
    assert.ok(values, `Unknown import ${name}`);
    return new SyntheticModule(Object.keys(values), function () {
      for (const [key, value] of Object.entries(values))
        this.setExport(key, value);
    });
  });
  await module.evaluate();
  return module.namespace;
}
const tracking = await import(
  `data:text/javascript;base64,${Buffer.from(readFileSync("src/lib/tracking.js", "utf8")).toString("base64")}`
);
const auth = await import(
  `data:text/javascript;base64,${Buffer.from(readFileSync("src/lib/admin-auth.js", "utf8")).toString("base64")}`
);
async function notificationFixture(anonymous = false) {
  const queries = [],
    mail = [];
  const report = {
    id: 7,
    public_id: "PR-2026-000001",
    tracking_key: "citizen-private-key-12345678901234567890",
    status: "In Progress",
    department_id: 3,
    is_anonymous: anonymous,
    reporter_email: "citizen@example.com",
    notification_email: "municipality@example.com",
  };
  const execute = async (sql, values) => {
    queries.push({ sql, values });
    if (sql.startsWith("SELECT r.id")) return [[report]];
    return [{}];
  };
  const helper = await load("src/lib/report-notifications.js", {
    "node:crypto": await import("node:crypto"),
    "./admin-auth": {
      digest,
      siteConfig: () => ({ origin: "https://kosova.report" }),
    },
    "./db": { database: () => ({ execute }) },
    "./smtp2go": { sendDepartmentEmail: async (message) => mail.push(message) },
  });
  return { helper, report, queries, mail, connection: { execute } };
}
test("citizen and municipal email links carry separate scoped credentials", async () => {
  const app = await notificationFixture();
  await app.helper.queueStatusEmails(app.connection, 7, "audit:1");
  const notifications = app.queries.filter((query) =>
    query.sql.startsWith("INSERT IGNORE INTO report_status_notifications"),
  );
  assert.equal(notifications.length, 2);
  const department = notifications.find(
      (query) => query.values[1] === "department",
    ),
    citizen = notifications.find((query) => query.values[1] === "reporter");
  assert.ok(department.values[5].includes("/municipality/PR-2026-000001#key="));
  assert.ok(!department.values[5].includes(app.report.tracking_key));
  assert.ok(citizen.values[5].includes("/track/PR-2026-000001#key="));
  assert.ok(citizen.values[5].includes(app.report.tracking_key));
  const token = department.values[5].match(/#key=([A-Za-z0-9_-]+)/)[1];
  const stored = app.queries.find((query) =>
    query.sql.startsWith("INSERT INTO municipality_report_tokens"),
  );
  assert.equal(stored.values[0], digest(token));
  assert.notEqual(stored.values[0], token);
});
test("anonymous reports do not queue citizen email", async () => {
  const app = await notificationFixture(true);
  await app.helper.queueStatusEmails(app.connection, 7, "audit:1");
  assert.equal(
    app.queries.filter((query) =>
      query.sql.startsWith("INSERT IGNORE INTO report_status_notifications"),
    ).length,
    1,
  );
  assert.ok(
    !app.queries.some((query) => query.values?.includes("citizen@example.com")),
  );
});
async function municipality({ found = true, initial = "Pending" } = {}) {
  const queries = [];
  let state = initial,
    queued = 0;
  const execute = async (sql, values) => {
    queries.push({ sql, values });
    if (sql.startsWith("SELECT r.id"))
      return [
        found
          ? [
              {
                id: 7,
                public_id: "PR-2026-000001",
                department_id: 3,
                status: state,
                notification_email: "municipality@example.com",
              },
            ]
          : [],
      ];
    if (sql.startsWith("UPDATE reports")) state = values[0];
    return [{ insertId: 11 }];
  };
  const connection = {
    execute,
    beginTransaction: async () => {},
    commit: async () => {},
    rollback: async () => {},
    release() {},
  };
  const route = await load("src/app/api/municipality/[public_id]/route.js", {
    "../../../../lib/db": {
      database: () => ({ execute, getConnection: async () => connection }),
    },
    "../../../../lib/admin-auth": {
      digest,
      siteConfig: () => ({ origin: "https://kosova.report" }),
    },
    "../../../../lib/tracking": tracking,
    "../../../../lib/report-notifications": {
      queueStatusEmails: async () => queued++,
      deliverStatusEmails: async () => ({ pending: 0 }),
    },
  });
  return {
    route,
    queries,
    get state() {
      return state;
    },
    get queued() {
      return queued;
    },
  };
}
const params = { public_id: "PR-2026-000001" };
const request = (status, origin = "https://kosova.report") =>
  new Request("https://kosova.report/api/municipality/PR-2026-000001", {
    method: "POST",
    headers: {
      origin,
      Authorization: `Bearer ${"x".repeat(43)}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ status }),
  });
test("municipality acknowledgement is idempotent and queues notifications after a real transition", async () => {
  const app = await municipality();
  assert.equal(
    (await app.route.POST(request("In Progress"), { params })).status,
    200,
  );
  assert.equal(app.state, "In Progress");
  assert.equal(
    (await app.route.POST(request("In Progress"), { params })).status,
    200,
  );
  assert.equal(app.queued, 1);
  assert.ok(
    app.queries.some((query) =>
      query.sql.includes("t.expires_at>UTC_TIMESTAMP()"),
    ),
  );
});
test("expired/unknown municipal links and cross-origin changes cannot mutate reports", async () => {
  const app = await municipality({ found: false });
  assert.equal(
    (await app.route.POST(request("Resolved"), { params })).status,
    404,
  );
  assert.equal(app.state, "Pending");
  assert.equal(app.queued, 0);
  const blocked = await municipality();
  assert.equal(
    (
      await blocked.route.POST(request("Resolved", "https://other.example"), {
        params,
      })
    ).status,
    403,
  );
  assert.equal(blocked.queries.length, 0);
});
test("municipality cannot reopen a resolved report", async () => {
  const app = await municipality({ initial: "Resolved" });
  assert.equal(
    (await app.route.POST(request("In Progress"), { params })).status,
    400,
  );
  assert.equal(app.state, "Resolved");
  assert.equal(app.queued, 0);
});
test("one-time owner bootstrap stores a hash and does not overwrite an existing owner", async () => {
  let existing = false,
    hash;
  const queries = [];
  const connection = {
    beginTransaction: async () => {},
    commit: async () => {},
    rollback: async () => {},
    execute: async (sql, values) => {
      queries.push({ sql, values });
      if (sql.startsWith("SELECT id,email"))
        return [existing ? [{ id: 1, email: "owner@example.com" }] : []];
      if (sql.startsWith("INSERT INTO staff_accounts")) {
        hash = values[2];
        existing = true;
      }
      return [{ insertId: 1 }];
    },
  };
  const bootstrap = await load("scripts/bootstrap-owner.mjs", {
    "../src/lib/admin-auth.js": auth,
  });
  const created = await bootstrap.bootstrapOwner(
    connection,
    "owner@example.com",
  );
  assert.ok(auth.verifyPassword(created.password, hash));
  assert.ok(!queries.some((query) => query.values?.includes(created.password)));
  const again = await bootstrap.bootstrapOwner(connection, "owner@example.com");
  assert.equal(again.existing, true);
  assert.equal(again.password, undefined);
});
test("read-only citizen endpoint never exposes contact details or a mutation handler", async () => {
  const route = await load("src/app/api/tracking/[public_id]/route.js", {
    "../../../../lib/db": {
      database: () => ({
        execute: async () => [
          [
            {
              public_id: "PR-2026-000001",
              status: "In Progress",
              city: "Prishtinë",
            },
          ],
        ],
      }),
    },
    "../../../../lib/tracking": tracking,
  });
  const response = await route.GET(
    new Request("https://kosova.report/api/tracking/PR-2026-000001", {
      headers: { Authorization: `Bearer ${"z".repeat(43)}` },
    }),
    { params },
  );
  assert.equal(response.status, 200);
  assert.equal(route.POST, undefined);
  const result = await response.json();
  assert.equal(result.reporter_email, undefined);
  assert.equal(result.status, "In Progress");
});
