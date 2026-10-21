import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SourceTextModule, SyntheticModule } from "node:vm";
import test from "node:test";
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
const mail = await load("src/lib/smtp2go.js", {
  "./db": {
    required: (name) =>
      ({ SMTP2GO_API_KEY: "test-key", SMTP_FROM: "reports@kosova.report" })[
        name
      ],
  },
});
const message = {
  to: "department@example.com",
  subject: "PR-2026-000001",
  html: '<img src="cid:photo-1"/>',
  text: "Civic report",
  messageId: "<test@kosova.report>",
  attachments: [
    {
      cid: "photo-1",
      content: Buffer.from("fixture"),
      contentType: "image/png",
    },
  ],
};
test("SMTP2Go uses API-key auth and base64 inline attachments", async () => {
  let sent;
  const id = await mail.sendDepartmentEmail(
    message,
    mail.emailConfiguration(),
    async (url, options) => {
      sent = { url, options };
      return Response.json({
        data: { succeeded: 1, failed: 0, email_id: "accepted-email" },
      });
    },
  );
  assert.equal(id, "accepted-email");
  assert.equal(sent.url, "https://api.smtp2go.com/v3/email/send");
  assert.equal(sent.options.headers["X-Smtp2go-Api-Key"], "test-key");
  const body = JSON.parse(sent.options.body);
  assert.deepEqual(body.to, ["department@example.com"]);
  assert.equal(body.sender, "Kosova Report <reports@kosova.report>");
  assert.equal(mail.senderWithName("Ekipi <info@kosova.report>"), "Ekipi <info@kosova.report>");
  assert.equal(body.inlines[0].filename, "photo-1");
  assert.equal(
    body.inlines[0].fileblob,
    Buffer.from("fixture").toString("base64"),
  );
  assert.equal(body.html_body, message.html);
  assert.equal(body.attachments, undefined);
  assert.ok(!JSON.stringify(body).includes("test-key"));
});
test("videos and PDFs travel as named attachments, photos stay inline", async () => {
  let body;
  await mail.sendDepartmentEmail(
    {
      ...message,
      attachments: [
        ...message.attachments,
        { filename: "video-1.mp4", content: Buffer.from("mp4"), contentType: "video/mp4" },
        { filename: "document-1.pdf", content: Buffer.from("%PDF"), contentType: "application/pdf" },
      ],
    },
    mail.emailConfiguration(),
    async (url, options) => {
      body = JSON.parse(options.body);
      return Response.json({ data: { succeeded: 1, failed: 0, email_id: "accepted-email" } });
    },
  );
  assert.deepEqual(body.inlines.map((file) => file.filename), ["photo-1"]);
  assert.deepEqual(
    body.attachments.map((file) => [file.filename, file.mimetype]),
    [
      ["video-1.mp4", "video/mp4"],
      ["document-1.pdf", "application/pdf"],
    ],
  );
  // Every file SMTP2Go receives has a name; one without makes it reject the whole email.
  for (const file of [...body.inlines, ...body.attachments]) assert.ok(file.filename);
});
test("SMTP2Go rejects HTTP errors and partial/failed acceptance", async () => {
  for (const response of [
    Response.json({ data: { error: "Unauthorized" } }, { status: 401 }),
    Response.json({ data: { succeeded: 0, failed: 1 } }),
  ])
    await assert.rejects(
      mail.sendDepartmentEmail(
        message,
        mail.emailConfiguration(),
        async () => response,
      ),
    );
});
test("public municipality options come from actual active database routes", async () => {
  const route = await load("src/app/api/report-options/route.js", {
    "../../../lib/municipality-names": {
      cleanCityName: (name) => name,
    },
    "../../../lib/db": {
      database: () => ({
        execute: async () => [
          [
            {
              code: "PR",
              name: "Prishtinë",
              category: "infrastructure",
              country: "Kosovo",
              latitude: 42.6629,
              longitude: 21.1655,
              zoom_level: 13,
            },
            {
              code: "PR",
              name: "Prishtinë",
              category: "environment",
              country: "Kosovo",
              latitude: 42.6629,
              longitude: 21.1655,
              zoom_level: 13,
            },
          ],
        ],
      }),
    },
    "../../../lib/report-options": {
      categories: ["infrastructure", "environment"],
    },
  });
  const response = await route.GET();
  assert.deepEqual(await response.json(), {
    cities: [
      {
        code: "PR",
        name: "Prishtinë",
        country: "Kosovo",
        latitude: 42.6629,
        longitude: 21.1655,
        zoom: 13,
        categories: ["infrastructure", "environment"],
      },
    ],
  });
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("enabled Prishtina remains visible when a category has no department route", async () => {
  const route = await load("src/app/api/report-options/route.js", {
    "../../../lib/municipality-names": {
      cleanCityName: (name) => name,
    },
    "../../../lib/db": {
      database: () => ({
        execute: async (sql) => {
          assert.ok(sql.includes("LEFT JOIN department_routes"));
          assert.ok(sql.includes("m.enabled=1"));
          return [
            [
              {
                code: "PR",
                name: "Prishtinë",
                country: "Kosovo",
                latitude: "42.6629",
                longitude: "21.1655",
                zoom_level: 13,
                category: null,
              },
            ],
          ];
        },
      }),
    },
    "../../../lib/report-options": {
      categories: ["infrastructure", "environment"],
    },
  });
  const response = await route.GET();
  const data = await response.json();
  assert.equal(data.cities.length, 1);
  assert.equal(data.cities[0].name, "Prishtinë");
  assert.deepEqual(data.cities[0].categories, []);
});
