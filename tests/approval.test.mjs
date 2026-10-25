import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SourceTextModule, SyntheticModule } from "node:vm";
import test from "node:test";

const jpeg = Buffer.from([255, 216, 255, 224, 0, 16]);
async function approval({
  reviewState = "pending",
  sentAt = null,
  assigned = true,
  smtpFails = false,
  reportCount = 1,
  anonymized = false,
} = {}) {
  const events = [],
    queries = [],
    downloads = [];
  let mail;
  const execute = async (sql, values) => {
    queries.push({ sql, values });
    if (sql.startsWith("SELECT report_id FROM report_assignments")) return [assigned ? [{ report_id: 7 }] : []];
    if (sql.startsWith("SELECT review_state,anonymized_at FROM reports"))
      return [[{ review_state: reviewState, anonymized_at: anonymized ? new Date() : null }]];
    if (sql.startsWith("SELECT r.id,r.public_id"))
      return [
        [
          {
            id: 7,
            public_id: "PR-2026-000042",
            category: "infrastructure",
            status: "Pending",
            description: "<script>alert(1)</script> Damaged road",
            lat: "42.66",
            lng: "21.16",
            department_id: 3,
            is_anonymous: 1,
            reporter_email: null,
            city_code: "PR",
            notification_email: "department@kosova.report",
            ref: "0123456789",
            report_count: reportCount,
            sent_at: sentAt,
          },
        ],
      ];
    if (sql.startsWith("SELECT r.id,n.sent_at")) return [[{ id: 7, sent_at: sentAt }]];
    if (sql.startsWith("SELECT s.object_key"))
      return [[{ object_key: "evidence/" + "a".repeat(32), mime_type: "image/jpeg", byte_size: 6 }]];
    if (sql.startsWith("SELECT kind,mime_type"))
      return [[{ kind: "video", mime_type: "video/mp4", byte_size: 8, object_key: "evidence/" + "b".repeat(32) }]];
    return [{}];
  };
  const connection = {
    execute,
    beginTransaction: async () => events.push("begin"),
    commit: async () => events.push("commit"),
    rollback: async () => events.push("rollback"),
    release: () => events.push("release"),
  };
  class GetObjectCommand {
    constructor(input) {
      this.input = input;
    }
  }
  const mocks = {
    "@aws-sdk/client-s3": { GetObjectCommand },
    "./db": {
      database: () => ({ execute, getConnection: async () => connection }),
      required: () => "https://kosova.report",
    },
    "./r2": {
      r2: () => ({
        send: async (command) => {
          downloads.push(command.input);
          const body = command.input.Key.includes("a") ? jpeg : Buffer.alloc(8);
          return { Body: { transformToByteArray: async () => new Uint8Array(body) } };
        },
      }),
      bucketFor: () => "kosova-evidence",
    },
    "./smtp2go": {
      sendDepartmentEmail: async (message) => {
        mail = message;
        events.push("send");
        if (smtpFails) throw Error("API rejected notification");
      },
    },
    "./report-notifications": {
      departmentLink: async () => "https://kosova.report/municipality/PR-2026-000042#key=private-department-token",
      escapeHTML: (value) =>
        String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]),
      stageFooter: () => "",
    },
  };
  const module = new SourceTextModule(readFileSync("src/lib/report-approval.js", "utf8"));
  await module.link(async (name) => {
    const values = mocks[name];
    assert.ok(values, `Unexpected import ${name}`);
    return new SyntheticModule(Object.keys(values), function () {
      for (const [key, value] of Object.entries(values)) this.setExport(key, value);
    });
  });
  await module.evaluate();
  return {
    lib: module.namespace,
    events,
    queries,
    downloads,
    get mail() {
      return mail;
    },
  };
}
const owner = { id: 1, role: "owner" },
  checker = { id: 2, role: "checker" };

test("approving a report saves who approved it, then emails the department its photos and files", async () => {
  const app = await approval();
  assert.deepEqual(await app.lib.approveReport(owner, "7"), { sent: true });
  const approved = app.queries.find((q) => q.sql.startsWith("UPDATE reports SET review_state='approved'"));
  assert.deepEqual(approved.values, [1, "7"]);
  assert.ok(app.queries.some((q) => q.sql.startsWith("INSERT INTO report_notifications") && q.sql.includes("ON DUPLICATE KEY UPDATE")));
  // The approval is committed before anything is sent.
  assert.ok(app.events.indexOf("commit") < app.events.indexOf("send"));
  assert.equal(app.mail.to, "department@kosova.report");
  assert.deepEqual(
    app.mail.attachments.map((file) => [file.filename, file.contentType, Boolean(file.cid), file.content.length]),
    [
      ["photo-1.jpg", "image/jpeg", true, 6],
      ["video-1.mp4", "video/mp4", false, 8],
    ],
  );
  assert.ok(app.mail.html.includes("cid:image-0@kosova.report"));
  assert.ok(app.mail.html.includes("1 of 1 photos attached"));
  assert.ok(app.mail.html.includes("Video and documents attached: 1"));
  assert.ok(!app.mail.html.includes("<script>"));
  assert.ok(app.mail.html.includes("#key=private-department-token"));
  assert.ok(app.queries.some((q) => q.sql.startsWith("UPDATE report_notifications SET sent_at")));
});

test("a report already sent is not emailed twice", async () => {
  const app = await approval({ reviewState: "approved", sentAt: new Date() });
  assert.deepEqual(await app.lib.approveReport(owner, "7"), { sent: true });
  assert.ok(!app.events.includes("send"));
  assert.ok(!app.queries.some((q) => q.sql.startsWith("UPDATE reports")));
});

test("a checker approves or rejects only the reports assigned to them", async () => {
  for (const decide of ["approveReport", "rejectReport"]) {
    const app = await approval({ assigned: false });
    await assert.rejects(app.lib[decide](checker, "7"), (error) => error.code === "not_assigned");
    assert.ok(!app.events.includes("begin"));
  }
  const app = await approval();
  assert.deepEqual(await app.lib.approveReport(checker, "7"), { sent: true });
  // Owners need no assignment.
  const ownerApp = await approval({ assigned: false });
  await ownerApp.lib.approveReport(owner, "7");
  assert.ok(!ownerApp.queries.some((q) => q.sql.startsWith("SELECT report_id FROM report_assignments")));
});

test("a failed send keeps the approval, and pressing again retries the email", async () => {
  const app = await approval({ smtpFails: true });
  assert.deepEqual(await app.lib.approveReport(owner, "7"), { sent: false });
  assert.ok(app.events.includes("commit"));
  assert.ok(!app.queries.some((q) => q.sql.startsWith("UPDATE report_notifications SET sent_at")));
  const retry = await approval({ reviewState: "approved" });
  assert.deepEqual(await retry.lib.approveReport(owner, "7"), { sent: true });
  // Already approved: who approved it first is kept.
  assert.ok(!retry.queries.some((q) => q.sql.startsWith("UPDATE reports")));
});

test("an anonymized report cannot be approved", async () => {
  const app = await approval({ anonymized: true });
  await assert.rejects(app.lib.approveReport(owner, "7"), (error) => error.code === "closed");
  assert.ok(app.events.includes("rollback"));
  assert.ok(!app.events.includes("send"));
});

test("a report joining an earlier one tells the department how many times it was reported", async () => {
  const app = await approval({ reportCount: 4 });
  await app.lib.approveReport(owner, "7");
  assert.match(app.mail.subject, /reported 4 times/);
  assert.ok(app.mail.html.includes("Reported 4 times"));
});

test("rejecting keeps the department out of it, but a report already sent cannot be rejected", async () => {
  const app = await approval();
  await app.lib.rejectReport(checker, "7");
  assert.deepEqual(
    app.queries.find((q) => q.sql.startsWith("UPDATE reports SET review_state='rejected'")).values,
    [2, "7"],
  );
  assert.ok(app.queries.some((q) => q.sql.startsWith("DELETE FROM report_notifications") && q.sql.includes("sent_at IS NULL")));
  assert.ok(!app.events.includes("send"));
  const sent = await approval({ sentAt: new Date() });
  await assert.rejects(sent.lib.rejectReport(owner, "7"), (error) => error.code === "already_sent");
  assert.ok(sent.events.includes("rollback"));
  assert.ok(!sent.queries.some((q) => q.sql.startsWith("UPDATE reports")));
});
