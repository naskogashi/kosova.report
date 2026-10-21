import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { SourceTextModule, SyntheticModule } from "node:vm";
import test from "node:test";

const env = {
  APP_URL: "https://kosova.report",
  R2_BUCKET: "test",
  R2_ACCOUNT_ID: "test",
  R2_ACCESS_KEY_ID: "test",
  R2_SECRET_ACCESS_KEY: "test",
  R2_IMAGE_BASE_URL: "https://images.kosova.report",
  SMTP_USER: "test",
  SMTP_PASSWORD: "test",
  SMTP_FROM: "reports@kosova.report",
};
async function loadRoute(
  file,
  {
    smtpFails = false,
    insertFails = false,
    existingSequence = 0,
    counterSequence = 41,
    routeMissing = false,
    groupingFails = false,
    uploads = [],
    bindFails = false,
  } = {},
) {
  const events = [],
    queries = [],
    objectCommands = [],
    attached = [],
    removed = [];
  let mail;
  const execute = async (sql, values) => {
    queries.push({ sql, values });
    if (sql.startsWith("SELECT c.id,UPPER(c.code) AS code FROM cities"))
      return [[{ id: 1, code: "PR" }]];
    if (sql.startsWith("SELECT d.id,d.notification"))
      return [
        routeMissing
          ? []
          : [{ id: 1, notification_email: "department@kosova.report" }],
      ];
    if (sql.startsWith("SELECT sequence_value"))
      return [[{ sequence_value: counterSequence }]];
    if (sql.startsWith("SELECT COALESCE(MAX"))
      return [[{ last_sequence: existingSequence }]];
    if (sql.startsWith("INSERT INTO report_images") && insertFails)
      throw Error("insert failed");
    if (sql.startsWith("SELECT r.public_id")) return [[]];
    if (sql.startsWith("INSERT INTO reports")) return [{ insertId: 7 }];
    if (sql.startsWith("INSERT INTO report_images")) return [{ insertId: 21 }];
    return [{}];
  };
  const connection = {
    execute,
    beginTransaction: async () => events.push("begin"),
    commit: async () => events.push("commit"),
    rollback: async () => events.push("rollback"),
    release: () => events.push("release"),
  };
  class PutObjectCommand {
    constructor(input) {
      this.input = input;
    }
  }
  class DeleteObjectCommand {
    constructor(input) {
      this.input = input;
    }
  }
  class S3Client {
    async send(command) {
      objectCommands.push(command.input);
      events.push(command instanceof PutObjectCommand ? "upload" : "delete");
    }
  }
  const mocks = {
    "node:crypto": { randomUUID },
    "../../../../lib/db": {
      database: () => ({ getConnection: async () => connection, execute }),
      required: (key) => env[key],
    },
    "../../../../../lib/db": { database: () => ({ execute }) },
    "../../../../../lib/report-pdf": {
      createReportPDF: () => Buffer.from("%PDF"),
    },
    "@aws-sdk/client-s3": { S3Client, PutObjectCommand, DeleteObjectCommand },
    "../../../../lib/smtp2go": {
      emailConfiguration: () => ({
        apiKey: "test",
        sender: "reports@kosova.report",
      }),
      sendDepartmentEmail: async (value) => {
        mail = value;
        events.push("send");
        if (smtpFails) throw Error("API rejected notification");
      },
    },
    "../../../../lib/report-notifications": {
      departmentLink: async () =>
        "https://kosova.report/municipality/PR-2026-000042#key=private-department-token",
      queueStatusEmails: async () => {},
      deliverStatusEmails: async () => ({ pending: 0 }),
      stageFooter: () => "",
    },
    "../../../../lib/report-options": {
      categories: ["infrastructure"],
      cities: [{ code: "PR" }],
    },
    "../../../../lib/city-boundary": { pinInsideCity: async () => true },
    "../../../../lib/incidents": {
      attachReport: async (connection, values) => {
        attached.push(values);
        if (groupingFails) throw Object.assign(Error("missing table"), { code: "ER_NO_SUCH_TABLE" });
        return values.chosenRef
          ? { id: 3, ref: values.chosenRef, joined: true, report_count: 4, status: "In Progress" }
          : { id: 5, ref: "0123456789", joined: false, report_count: 1, status: "Pending" };
      },
    },
    "../../../../lib/incident-matching": { validRef: (value) => /^[0-9a-f]{10}$/.test(value || "") },
    "../../../../lib/attachments": {
      claimUploads: async (connection, refs) => {
        if (!refs.length) return [];
        events.push("claim");
        return uploads;
      },
      promoteUploads: async (claimed) => {
        if (claimed.length) events.push("promote");
        return claimed.map((upload) => upload.key);
      },
      bindUploads: async (connection, reportId, claimed) => {
        if (bindFails) throw Error("bind failed");
        if (claimed.length) events.push("bind");
      },
      deleteKeys: async (keys) => {
        if (!keys.length) return;
        removed.push(...keys);
        events.push("drop");
      },
    },
  };
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
  return {
    route: module.namespace,
    events,
    queries,
    objectCommands,
    attached,
    removed,
    get mail() {
      return mail;
    },
  };
}
function request({
  count = 1,
  fakeImage = false,
  anonymous = "true",
  origin = "https://kosova.report",
  extra = {},
} = {}) {
  const form = new FormData();
  for (const [key, value] of Object.entries({
    city: "PR",
    category: "infrastructure",
    description: "<script>alert(1)</script> Damaged road",
    latitude: "42.66",
    longitude: "21.16",
    language: "sq",
    anonymous,
    email: "citizen@example.com",
    ...extra,
  }))
    form.set(key, value);
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
    "base64",
  );
  for (let i = 0; i < count; i++)
    form.append(
      "images",
      new Blob([fakeImage ? "not an image" : png], { type: "image/png" }),
      `photo${i}.png`,
    );
  return new Request("https://kosova.report/api/reports/submit", {
    method: "POST",
    body: form,
    headers: { origin },
  });
}
const submitFile = "src/app/api/reports/submit/route.js";
test("submission stores relational URLs, commits before SMTP, escapes HTML and discards anonymous contact", async () => {
  const app = await loadRoute(submitFile);
  const response = await app.route.POST(request());
  const data = await response.json();
  assert.equal(response.status, 201);
  assert.match(data.public_id, /^PR-\d{4}-000042$/);
  assert.match(data.tracking_key, /^[0-9a-f-]{36}$/);
  assert.equal(data.notification, "sent");
  assert.equal(app.objectCommands[0].Bucket, "kosova-report-images");
  const report = app.queries.find((q) =>
    q.sql.startsWith("INSERT INTO reports"),
  );
  assert.equal(report.values[9], null);
  const image = app.queries.find((q) =>
    q.sql.startsWith("INSERT INTO report_images"),
  );
  assert.match(
    image.values[1],
    /^https:\/\/images\.kosova\.report\/reports\//,
  );
  assert.ok(app.events.indexOf("commit") < app.events.indexOf("send"));
  assert.equal(app.mail.attachments.length, 1);
  assert.ok(app.mail.html.includes("cid:image-0@kosova.report"));
  assert.ok(!app.mail.html.includes("<script>"));
  assert.ok(!app.mail.html.includes(data.tracking_key));
});
test("contact reports preserve email", async () => {
  const app = await loadRoute(submitFile);
  assert.equal(
    (await app.route.POST(request({ anonymous: "false" }))).status,
    201,
  );
  assert.equal(
    app.queries.find((q) => q.sql.startsWith("INSERT INTO reports")).values[9],
    "citizen@example.com",
  );
});
test("image insert failure rolls back and removes R2 upload without sending mail", async () => {
  const app = await loadRoute(submitFile, { insertFails: true });
  assert.equal((await app.route.POST(request())).status, 500);
  assert.ok(app.events.includes("rollback"));
  assert.ok(app.events.includes("delete"));
  assert.ok(!app.events.includes("commit"));
  assert.ok(!app.events.includes("send"));
});
test("SMTP2Go API failure returns saved receipt and retains notification for retry", async () => {
  const app = await loadRoute(submitFile, { smtpFails: true });
  const response = await app.route.POST(request());
  assert.equal(response.status, 201);
  assert.equal((await response.json()).notification, "pending");
  assert.ok(!app.events.includes("delete"));
});
test("rejects spoofed MIME, excess images and cross-origin requests before uploads", async () => {
  for (const options of [
    { fakeImage: true },
    { count: 11 },
    { origin: "https://evil.example" },
  ]) {
    const app = await loadRoute(submitFile);
    const response = await app.route.POST(request(options));
    assert.equal(response.status, options.origin ? 403 : 400);
    assert.equal(app.events.length, 0);
  }
});
test("PDF requires private credential and does not query DB for missing token", async () => {
  const app = await loadRoute("src/app/api/reports/[public_id]/pdf/route.js");
  const response = await app.route.GET(
    new Request("https://kosova.report/api/reports/PR-2026-000001/pdf"),
    { params: { public_id: "PR-2026-000001" } },
  );
  assert.equal(response.status, 404);
  assert.equal(app.queries.length, 0);
});

test("existing official IDs seed a missing or stale counter", async () => {
  const app = await loadRoute(submitFile, {
    existingSequence: 89,
    counterSequence: 0,
  });
  const response = await app.route.POST(request());
  assert.equal(response.status, 201);
  assert.match((await response.json()).public_id, /-000090$/);
  const counter = app.queries.find((query) =>
    query.sql.startsWith("UPDATE report_counters"),
  );
  assert.equal(counter.values[0], "90");
});
test("unconfigured department routing rejects before R2 upload", async () => {
  const app = await loadRoute(submitFile, { routeMissing: true });
  assert.equal((await app.route.POST(request())).status, 503);
  assert.ok(!app.events.includes("upload"));
});
test("image metadata references the real integer auto-increment IDs", async () => {
  const app = await loadRoute(submitFile);
  assert.equal((await app.route.POST(request())).status, 201);
  const image = app.queries.find((query) =>
    query.sql.startsWith("INSERT INTO report_images"),
  );
  assert.equal(image.values[0], 7);
  const metadata = app.queries.find((query) =>
    query.sql.startsWith("INSERT INTO report_image_storage"),
  );
  assert.equal(metadata.values[0], 21);
  assert.ok(
    !app.queries
      .find((query) => query.sql.startsWith("INSERT INTO reports"))
      .sql.includes("city_code"),
  );
});

test("a new report starts its own issue and the receipt names it", async () => {
  const app = await loadRoute(submitFile);
  const response = await app.route.POST(request());
  assert.equal(response.status, 201);
  const data = await response.json();
  assert.deepEqual(data.incident, { ref: "0123456789", joined: false, report_count: 1 });
  assert.equal(app.attached[0].reportId, 7);
  assert.deepEqual(app.attached[0].point, [42.66, 21.16]);
  assert.ok(app.events.indexOf("commit") > -1);
});
test("a report the citizen says is the same problem joins that issue and the department is told", async () => {
  const app = await loadRoute(submitFile);
  const response = await app.route.POST(
    request({ extra: { incident: "abcdef0123", declined: "1111111111,2222222222", accuracy: "35" } }),
  );
  assert.equal(response.status, 201);
  assert.equal((await response.json()).incident.joined, true);
  assert.equal(app.attached[0].chosenRef, "abcdef0123");
  assert.deepEqual(app.attached[0].declinedRefs, ["1111111111", "2222222222"]);
  assert.equal(app.attached[0].accuracy, 35);
  assert.match(app.mail.subject, /reported 4 times/);
  assert.ok(app.mail.html.includes("Reported 4 times"));
});
test("malformed issue references are rejected before any upload", async () => {
  for (const extra of [{ incident: "../../etc" }, { declined: "1,2,3,4,5,6" }]) {
    const app = await loadRoute(submitFile);
    assert.equal((await app.route.POST(request({ extra }))).status, 400);
    assert.ok(!app.events.includes("upload"));
  }
});
test("a grouping failure still saves and sends the report", async () => {
  const app = await loadRoute(submitFile, { groupingFails: true });
  const response = await app.route.POST(request());
  assert.equal(response.status, 201);
  assert.equal((await response.json()).incident, null);
  assert.ok(app.events.includes("commit"));
  assert.ok(app.events.includes("send"));
});

const jpeg = Buffer.from([255, 216, 255, 224, 0, 16]);
const directUploads = [
  { id: 1, kind: "photo", mime_type: "image/jpeg", byte_size: 6, object_key: "incoming/" + "a".repeat(32), key: "evidence/" + "a".repeat(32), body: jpeg },
  { id: 2, kind: "video", mime_type: "video/mp4", byte_size: 8, object_key: "incoming/" + "b".repeat(32), key: "evidence/" + "b".repeat(32), body: Buffer.alloc(8) },
];
const refs = { attachments: `${"a".repeat(32)},${"b".repeat(32)}` };
test("direct uploads are checked and copied before the transaction, linked inside it and sent to the department", async () => {
  const app = await loadRoute(submitFile, { uploads: directUploads });
  const response = await app.route.POST(request({ count: 0, extra: refs }));
  assert.equal(response.status, 201);
  const order = ["claim", "promote", "begin", "bind", "commit", "send"].map((event) => app.events.indexOf(event));
  assert.deepEqual([...order].sort((a, b) => a - b), order);
  assert.ok(!order.includes(-1));
  // Nothing goes to the original bucket.
  assert.ok(!app.events.includes("upload"));
  assert.deepEqual(
    app.mail.attachments.map((file) => [file.filename, file.contentType, Boolean(file.cid)]),
    [
      ["photo-1.jpg", "image/jpeg", true],
      ["video-1.mp4", "video/mp4", false],
    ],
  );
  assert.ok(app.mail.html.includes("1 of 1 photos attached"));
  assert.ok(app.mail.html.includes("Video and documents attached: 1"));
  // The incoming/ copies are dropped once the report is saved.
  assert.deepEqual(app.removed, directUploads.map((upload) => upload.object_key));
});
test("a report that fails after copying removes the evidence copies and sends nothing", async () => {
  const app = await loadRoute(submitFile, { uploads: directUploads, bindFails: true });
  assert.equal((await app.route.POST(request({ count: 0, extra: refs }))).status, 500);
  assert.ok(app.events.includes("rollback"));
  assert.deepEqual(app.removed, directUploads.map((upload) => upload.key));
  assert.ok(!app.events.includes("send"));
});
test("photos inside the report and upload references cannot be mixed", async () => {
  const app = await loadRoute(submitFile, { uploads: directUploads });
  assert.equal((await app.route.POST(request({ count: 1, extra: refs }))).status, 400);
  assert.equal(app.events.length, 0);
});
