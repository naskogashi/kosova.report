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
  } = {},
) {
  const events = [],
    queries = [],
    objectCommands = [];
  let mail;
  const execute = async (sql, values) => {
    queries.push({ sql, values });
    if (sql.startsWith("SELECT id,UPPER(code) AS code FROM cities"))
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
    "../../../../lib/report-options": {
      categories: ["infrastructure"],
      cities: [{ code: "PR" }],
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
    /^https:\/\/test.r2.cloudflarestorage.com\/kosova-report-images\/reports\//,
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
