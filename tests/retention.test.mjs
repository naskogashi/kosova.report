import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SourceTextModule, SyntheticModule } from "node:vm";
import test from "node:test";

const source = (file) => `data:text/javascript;base64,${Buffer.from(readFileSync(file, "utf8")).toString("base64")}`;
const retention = await import(source("src/lib/retention.js"));

// lib/report-status.js with the real retention module, against a scripted database.
async function reportStatus({ anonymized = false } = {}) {
  const queries = [],
    pushed = [];
  const connection = {
    execute: async (sql, values = []) => {
      queries.push({ sql, values });
      if (sql.startsWith("UPDATE reports SET status")) return [{ affectedRows: anonymized ? 0 : 1 }];
      return [{ affectedRows: 0 }];
    },
  };
  const push = { queueFollowerPush: async (db, reportId, event) => pushed.push([reportId, event]) };
  const module = new SourceTextModule(readFileSync("src/lib/report-status.js", "utf8"));
  await module.link(async (name) => {
    const values = { "./retention": retention, "./push": push }[name];
    assert.ok(values, `Unexpected import ${name}`);
    return new SyntheticModule(Object.keys(values), function () {
      for (const [key, value] of Object.entries(values)) this.setExport(key, value);
    });
  });
  await module.evaluate();
  return { lib: module.namespace, connection, queries, pushed };
}

test("resolving a report starts the 30-day clock on its attachments", async () => {
  const app = await reportStatus();
  await app.lib.setReportStatus(app.connection, 7, "Resolved");
  assert.deepEqual(app.queries[0].values, ["Resolved", "Resolved", 7]);
  assert.match(app.queries[0].sql, /AND anonymized_at IS NULL/);
  const expiry = app.queries[1];
  assert.match(expiry.sql, /SET a\.state='expiring_pending',a\.expires_at=r\.resolved_at \+ INTERVAL 30 DAY/);
  assert.match(expiry.sql, /a\.state IN \('active','restoring'\)/);
  assert.deepEqual(expiry.values, [7]);
  // The citizen's own devices are told in the same transaction.
  assert.deepEqual(app.pushed, [[7, "Resolved"]]);
});

test("reopening a report stops the clock and brings moved files back", async () => {
  for (const status of ["Pending", "In Progress"]) {
    const app = await reportStatus();
    await app.lib.setReportStatus(app.connection, 7, status);
    const cancel = app.queries[1];
    assert.match(cancel.sql, /state=IF\(state='expiring','restoring','active'\),expires_at=NULL/);
    assert.match(cancel.sql, /state IN \('expiring_pending','expiring'\)/);
    assert.deepEqual(cancel.values, [7]);
  }
});

test("an anonymized report's status never changes", async () => {
  const app = await reportStatus({ anonymized: true });
  await assert.rejects(app.lib.setReportStatus(app.connection, 7, "In Progress"), (error) => error.status === 409);
  assert.equal(app.queries.length, 1);
  assert.deepEqual(app.pushed, []);
});

test("lifecycle rules: incoming/ after a day, expiring/ after 30 days, merged by ID", async () => {
  const { evidenceRules, publicRules, mergeRules } = await import("../scripts/lifecycle-rules.mjs");
  assert.deepEqual(
    evidenceRules.map((rule) => [rule.Filter.Prefix, rule.Expiration.Days]),
    [
      ["incoming/", 1],
      ["expiring/", 30],
    ],
  );
  assert.deepEqual(
    publicRules.map((rule) => rule.Filter.Prefix),
    ["expiring/"],
  );
  const multipart = { ID: "Default Multipart Abort Rule", Status: "Enabled", AbortIncompleteMultipartUpload: { DaysAfterInitiation: 7 } };
  const stale = { ...evidenceRules[1], Expiration: { Days: 90 } };
  const { rules: merged, warnings } = mergeRules([multipart, stale], evidenceRules);
  assert.deepEqual(
    merged.map((rule) => rule.ID),
    ["Default Multipart Abort Rule", "kosova-drop-unattached-uploads", "kosova-expire-resolved-evidence"],
  );
  assert.equal(merged.at(-1).Expiration.Days, 30);
  assert.deepEqual(warnings, []);
  const wipe = { ID: "old", Status: "Enabled", Filter: {}, Expiration: { Days: 10 } };
  assert.match(mergeRules([wipe], evidenceRules).warnings[0], /whole bucket/);
  assert.throws(() => mergeRules([], [{ ID: "bad", Filter: { Prefix: "" }, Expiration: { Days: 1 } }]), /folder prefix/);
});

test("migration 008 is applied and its CHECK constraints avoid cascading foreign keys", async () => {
  // Read, not imported: the migration runner loads server settings on import.
  const migrations = readFileSync("scripts/migrate-lib.mjs", "utf8")
    .match(/"sql\/[^"]+"/g)
    .map((name) => name.slice(1, -1));
  assert.ok(migrations.includes("sql/008_attachments_retention_alerts.sql"));
  assert.deepEqual(migrations.slice(-3), ["sql/009_report_deletions.sql", "sql/010_account_deletions.sql", "sql/011_report_approval.sql"]);
  // MySQL refuses a CHECK on a column whose foreign key has ON DELETE/ON UPDATE actions.
  const sql = readFileSync("sql/008_attachments_retention_alerts.sql", "utf8");
  for (const table of sql.split(/CREATE TABLE IF NOT EXISTS /).slice(1)) {
    const cascading = [...table.matchAll(/FOREIGN KEY\((\w+)\)[^\n]*\bON (DELETE|UPDATE)\b/g)].map((m) => m[1]);
    for (const [, check] of table.matchAll(/CHECK \(([^\n]+)\)\n/g))
      for (const column of cascading) assert.ok(!new RegExp(`\\b${column}\\b`).test(check), `${column} in CHECK`);
  }
});

// runRetention against a scripted database and storage.
function retentionFixture({ pending = [], restoring = [], reports = [], comments = [], failAnonymize = false, columns = [] } = {}) {
  const queries = [],
    storage = [],
    events = [];
  const db = {
    execute: async (sql, values = []) => {
      queries.push({ sql, values });
      if (sql.startsWith("SELECT id,object_key FROM attachments WHERE state='expiring_pending'")) return [pending];
      if (sql.startsWith("SELECT id,object_key FROM attachments WHERE state='restoring'")) return [restoring];
      if (sql.startsWith("SELECT r.id FROM reports r")) return [reports.map((id) => ({ id }))];
      if (sql.startsWith("SELECT column_name")) return [columns];
      if (sql.startsWith("SELECT object_key AS k"))
        return [[{ k: "evidence/" + "a".repeat(32) }, { k: "reports/old-upload/photo.jpg" }]];
      if (sql.startsWith("SELECT i.image_url"))
        return [[{ url: "https://images.kosova.report/reports/legacy/one.jpg" }, { url: "https://elsewhere.example/x.jpg" }]];
      if (sql.startsWith("SELECT m.id,m.object_key")) return [comments];
      if (sql.startsWith("UPDATE reports SET reporter_email") && failAnonymize) throw new Error("lock wait timeout");
      return [{ affectedRows: 1 }];
    },
    beginTransaction: async () => events.push("begin"),
    commit: async () => events.push("commit"),
    rollback: async () => events.push("rollback"),
  };
  const files = {
    copy: async (from, to) => storage.push(["copy", from, to]),
    remove: async (key) => storage.push(["remove", key]),
  };
  return {
    run: () => retention.runRetention({ db, storage: files, imageBase: "https://images.kosova.report/" }),
    queries,
    storage,
    events,
  };
}

test("resolved files move to expiring/ and reopened ones come back to evidence/", async () => {
  const ref = "q".repeat(32);
  const app = retentionFixture({
    pending: [{ id: 1, object_key: `evidence/${ref}` }],
    restoring: [{ id: 2, object_key: `expiring/${ref}` }],
  });
  const result = await app.run();
  assert.deepEqual(app.storage, [
    ["copy", `evidence/${ref}`, `expiring/${ref}`],
    ["remove", `evidence/${ref}`],
    ["copy", `expiring/${ref}`, `evidence/${ref}`],
    ["remove", `expiring/${ref}`],
  ]);
  assert.equal(result.moved, 1);
  assert.equal(result.restored, 1);
  // The photo row the staff gallery reads follows the file.
  assert.ok(app.queries.some((q) => q.sql.startsWith("UPDATE report_image_storage") && q.values[0] === `expiring/${ref}`));
});

test("day 30 deletes every file first, then anonymizes the report in one transaction", async () => {
  const app = retentionFixture({ reports: [7], columns: [{ name: "reporter_phone", nullable: "NO", type: "varchar" }] });
  const result = await app.run();
  assert.equal(result.anonymized, 1);
  const due = app.queries.find((q) => q.sql.startsWith("SELECT r.id FROM reports r"));
  assert.match(due.sql, /r\.status='Resolved' AND r\.resolved_at <= UTC_TIMESTAMP\(\) - INTERVAL 30 DAY/);
  assert.match(due.sql, /r\.resolved_at >= s\.started_at OR s\.backfill_approved_at IS NOT NULL/);
  assert.deepEqual(app.storage, [
    ["remove", "evidence/" + "a".repeat(32)],
    ["remove", "reports/old-upload/photo.jpg"],
    ["remove", "reports/legacy/one.jpg"],
  ]);
  const anonymize = app.queries.find((q) => q.sql.startsWith("UPDATE reports SET reporter_email"));
  for (const part of ["reporter_email=NULL", "description=''", "admin_note=NULL", "tracking_key=UUID()", "anonymized_at=UTC_TIMESTAMP()", "reporter_phone=''"])
    assert.ok(anonymize.sql.includes(part), part);
  const statements = app.queries.map((q) => q.sql);
  for (const prefix of [
    "UPDATE report_audit_log SET note=''",
    "UPDATE report_reviews SET note=''",
    "DELETE FROM report_notifications",
    "DELETE FROM report_status_notifications",
    "DELETE FROM municipality_report_tokens",
    "DELETE FROM push_outbox",
    "DELETE FROM push_report_follows",
    "UPDATE attachments SET state='deleted',object_key=NULL",
    "DELETE FROM report_images",
    "DELETE s FROM push_subscriptions",
  ])
    assert.ok(statements.some((sql) => sql.startsWith(prefix)), prefix);
  assert.deepEqual(app.events, ["begin", "commit"]);
});

test("a failed anonymization rolls back and the report is tried again on the next run", async () => {
  const app = retentionFixture({ reports: [7], failAnonymize: true });
  const result = await app.run();
  assert.equal(result.anonymized, 0);
  assert.equal(result.failed, 1);
  assert.deepEqual(app.events, ["begin", "rollback"]);
});

test("comment photos go 30 days after their issue is resolved; abandoned uploads are forgotten", async () => {
  const app = retentionFixture({ comments: [{ id: 3, object_key: "comments/9/photo.jpg" }] });
  const result = await app.run();
  assert.equal(result.comments, 1);
  assert.deepEqual(app.storage, [["remove", "comments/9/photo.jpg"]]);
  const photos = app.queries.find((q) => q.sql.startsWith("SELECT m.id,m.object_key"));
  assert.match(photos.sql, /i\.status='Resolved' AND i\.resolved_at <= UTC_TIMESTAMP\(\) - INTERVAL 30 DAY/);
  assert.ok(app.queries.some((q) => q.sql.startsWith("DELETE FROM incident_comment_images") && q.values[0] === 3));
  assert.ok(app.queries.some((q) => q.sql.startsWith("DELETE FROM attachments WHERE state='signed'")));
});
