import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SourceTextModule, SyntheticModule } from "node:vm";
import test from "node:test";

const source = (file) => `data:text/javascript;base64,${Buffer.from(readFileSync(file, "utf8")).toString("base64")}`;
const retention = await import(source("src/lib/retention.js"));

// lib/report-status.js with the real retention module, against a scripted database.
async function reportStatus({ anonymized = false } = {}) {
  const queries = [];
  const connection = {
    execute: async (sql, values = []) => {
      queries.push({ sql, values });
      if (sql.startsWith("UPDATE reports SET status")) return [{ affectedRows: anonymized ? 0 : 1 }];
      return [{ affectedRows: 0 }];
    },
  };
  const module = new SourceTextModule(readFileSync("src/lib/report-status.js", "utf8"));
  await module.link(async (name) => {
    assert.equal(name, "./retention");
    return new SyntheticModule(Object.keys(retention), function () {
      for (const [key, value] of Object.entries(retention)) this.setExport(key, value);
    });
  });
  await module.evaluate();
  return { lib: module.namespace, connection, queries };
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
  assert.equal(migrations.at(-1), "sql/008_attachments_retention_alerts.sql");
  // MySQL refuses a CHECK on a column whose foreign key has ON DELETE/ON UPDATE actions.
  const sql = readFileSync("sql/008_attachments_retention_alerts.sql", "utf8");
  for (const table of sql.split(/CREATE TABLE IF NOT EXISTS /).slice(1)) {
    const cascading = [...table.matchAll(/FOREIGN KEY\((\w+)\)[^\n]*\bON (DELETE|UPDATE)\b/g)].map((m) => m[1]);
    for (const [, check] of table.matchAll(/CHECK \(([^\n]+)\)\n/g))
      for (const column of cascading) assert.ok(!new RegExp(`\\b${column}\\b`).test(check), `${column} in CHECK`);
  }
});
