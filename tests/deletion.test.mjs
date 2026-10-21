import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SourceTextModule, SyntheticModule } from "node:vm";
import test from "node:test";

// lib/report-deletion.js against a scripted database and R2.
async function deletion({ report = { id: 7, public_id: "PR-2026-000007", category: "infrastructure", city_id: 1, created_at: "2026-10-01T08:00:00Z", incident_id: 4 }, failDelete = false } = {}) {
  const steps = [];
  const execute = async (sql, values = []) => {
    steps.push({ sql, values });
    if (sql.startsWith("SELECT id,public_id")) return [report ? [report] : []];
    if (sql.startsWith("SELECT id FROM reports WHERE id=? FOR UPDATE")) return [[{ id: 7 }]];
    if (sql.startsWith("DELETE FROM reports") && failDelete) throw Object.assign(new Error("fk"), { code: "ER_ROW_IS_REFERENCED_2" });
    return [{ affectedRows: 1 }];
  };
  const connection = {
    execute,
    beginTransaction: async () => steps.push({ sql: "BEGIN" }),
    commit: async () => steps.push({ sql: "COMMIT" }),
    rollback: async () => steps.push({ sql: "ROLLBACK" }),
    release() {},
  };
  const mocks = {
    "@aws-sdk/client-s3": {
      DeleteObjectCommand: class {
        constructor(input) {
          this.input = input;
        }
      },
    },
    "./r2": {
      bucketFor: (key) => (key.startsWith("evidence/") ? "kosova-evidence" : "kosova-report-images"),
      r2: () => ({ send: async (command) => steps.push({ sql: "R2_DELETE", values: [command.input.Bucket, command.input.Key] }) }),
    },
    "./retention": { reportKeys: async () => ["evidence/" + "a".repeat(32), "reports/old/photo.jpg"] },
    "./incidents": {
      recount: async (conn, incidentId) => steps.push({ sql: "RECOUNT", values: [incidentId] }),
      logIncident: async (conn, incidentId, actor, action, detail) => steps.push({ sql: "LOG_INCIDENT", values: [incidentId, actor, action, detail] }),
    },
  };
  const module = new SourceTextModule(readFileSync("src/lib/report-deletion.js", "utf8"));
  await module.link(async (name) => {
    const values = mocks[name];
    assert.ok(values, `Unexpected import ${name}`);
    return new SyntheticModule(Object.keys(values), function () {
      for (const [key, value] of Object.entries(values)) this.setExport(key, value);
    });
  });
  await module.evaluate();
  return { lib: module.namespace, db: { execute, getConnection: async () => connection }, steps };
}
const owner = { id: 3, name: "Arta Owner", email: "owner@kosova.report" };

test("deleting removes the files first, then the report in one transaction, and logs who and when", async () => {
  const app = await deletion();
  assert.equal(await app.lib.deleteReport(app.db, 7, owner), "PR-2026-000007");
  const order = app.steps.map((step) => step.sql.split(" WHERE ")[0].split(" (")[0]);
  assert.deepEqual(order, [
    "SELECT id,public_id,category,city_id,created_at,incident_id FROM reports",
    "R2_DELETE",
    "R2_DELETE",
    "BEGIN",
    "SELECT id FROM reports",
    "INSERT INTO report_deletions",
    "UPDATE attachments SET report_image_id=NULL",
    "DELETE FROM attachments",
    "DELETE FROM report_images",
    "UPDATE incidents SET seed_report_id=NULL",
    "DELETE FROM reports",
    "RECOUNT",
    "UPDATE incidents SET visibility='hidden'",
    "LOG_INCIDENT",
    "COMMIT",
  ]);
  assert.deepEqual(app.steps[1].values, ["kosova-evidence", "evidence/" + "a".repeat(32)]);
  assert.deepEqual(app.steps[2].values, ["kosova-report-images", "reports/old/photo.jpg"]);
  const log = app.steps.find((step) => step.sql.startsWith("INSERT INTO report_deletions"));
  assert.deepEqual(log.values, ["PR-2026-000007", "infrastructure", 1, "2026-10-01T08:00:00Z", 3, "Arta Owner", "owner@kosova.report"]);
  assert.match(app.steps.find((step) => step.sql.startsWith("UPDATE incidents SET visibility")).sql, /report_count=0/);
});

test("a failed deletion rolls back, so the report and its log line stay consistent", async () => {
  const app = await deletion({ failDelete: true });
  await assert.rejects(app.lib.deleteReport(app.db, 7, owner));
  assert.equal(app.steps.at(-1).sql, "ROLLBACK");
  assert.ok(!app.steps.some((step) => step.sql === "COMMIT"));
});

test("an unknown report deletes nothing", async () => {
  const app = await deletion({ report: null });
  await assert.rejects(app.lib.deleteReport(app.db, 7, owner), (error) => error.status === 404);
  assert.equal(app.steps.length, 1);
});

// lib/account-deletion.js against a scripted database.
async function accounts({ target = { id: 9, name: "Besa Checker", email: "besa@kosova.report", role: "checker" }, otherOwners = 1 } = {}) {
  const steps = [];
  const connection = {
    execute: async (sql, values = []) => {
      steps.push({ sql, values });
      if (sql.startsWith("SELECT id,name,email,role FROM staff_accounts")) return [target ? [target] : []];
      if (sql.startsWith("SELECT COUNT(*) AS total")) return [[{ total: otherOwners }]];
      return [{ affectedRows: 1 }];
    },
    beginTransaction: async () => steps.push({ sql: "BEGIN" }),
    commit: async () => steps.push({ sql: "COMMIT" }),
    rollback: async () => steps.push({ sql: "ROLLBACK" }),
    release() {},
  };
  const module = new SourceTextModule(readFileSync("src/lib/account-deletion.js", "utf8"));
  await module.link(async () => assert.fail("account-deletion.js imports nothing"));
  await module.evaluate();
  return { lib: module.namespace, db: { getConnection: async () => connection }, steps };
}

test("deleting an account logs who and when, drops its assignments and checks, and ends its sessions", async () => {
  const app = await accounts();
  await app.lib.deleteAccount(app.db, 9, owner);
  const order = app.steps.map((step) => step.sql.split(" WHERE ")[0].split(" (")[0]);
  assert.deepEqual(order, [
    "BEGIN",
    "SELECT id,name,email,role FROM staff_accounts",
    "INSERT INTO account_deletions",
    "DELETE FROM report_assignments",
    "DELETE FROM report_reviews",
    "UPDATE public_alert_events SET account_id=NULL",
    "DELETE FROM staff_accounts",
    "COMMIT",
  ]);
  assert.deepEqual(app.steps[2].values, ["Besa Checker", "besa@kosova.report", "checker", 3, "Arta Owner", "owner@kosova.report"]);
});

test("nobody deletes their own account, and the last admin always stays", async () => {
  const self = await accounts();
  await assert.rejects(self.lib.deleteAccount(self.db, 3, owner), (error) => error.message === "self");
  assert.equal(self.steps.length, 0);
  const last = await accounts({ target: { id: 4, name: "Other", email: "o@kosova.report", role: "owner" }, otherOwners: 0 });
  await assert.rejects(last.lib.deleteAccount(last.db, 4, owner), (error) => error.message === "last_owner");
  assert.equal(last.steps.at(-1).sql, "ROLLBACK");
  assert.ok(!last.steps.some((step) => step.sql.startsWith("DELETE FROM staff_accounts")));
});
