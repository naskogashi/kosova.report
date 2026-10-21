import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SourceTextModule, SyntheticModule } from "node:vm";
import test from "node:test";
import { PDFDocument } from "pdf-lib";

const source = (file) => `data:text/javascript;base64,${Buffer.from(readFileSync(file, "utf8")).toString("base64")}`;
const mp4 = await import(source("src/lib/mp4.js"));

// A minimal MP4 built box by box: ftyp, moov (mvhd + one trak per track), mdat.
const box = (type, ...parts) => {
  const body = Buffer.concat(parts);
  const head = Buffer.alloc(8);
  head.writeUInt32BE(8 + body.length);
  head.write(type, 4, "latin1");
  return Buffer.concat([head, body]);
};
const u32 = (...values) => Buffer.concat(values.map((v) => { const b = Buffer.alloc(4); b.writeUInt32BE(v); return b; }));
// mvhd/mdhd version 0: version+flags, creation, modification, timescale, duration.
const header = (type, seconds) => box(type, u32(0, 0, 0, 1000, Math.round(seconds * 1000)), Buffer.alloc(type === "mvhd" ? 80 : 4));
const trak = (handler, codec, seconds) =>
  box(
    "trak",
    box(
      "mdia",
      header("mdhd", seconds),
      box("hdlr", u32(0, 0), Buffer.from(handler, "latin1"), Buffer.alloc(12)),
      box("minf", box("stbl", box("stsd", u32(0, 1), box(codec, Buffer.alloc(78))))),
    ),
  );
const movie = ({ seconds = 4, tracks = [["vide", "avc1"]], extra = [] } = {}) =>
  Buffer.concat([
    box("ftyp", Buffer.from("isom", "latin1"), u32(512)),
    box("moov", header("mvhd", seconds), ...tracks.map(([h, c]) => trak(h, c, seconds)), ...extra),
    box("mdat", Buffer.alloc(16)),
  ]);

test("MP4 inspection reads duration, tracks and recorded locations", () => {
  const info = mp4.inspectMp4(movie({ seconds: 4.5 }));
  assert.equal(info.duration, 4.5);
  assert.deepEqual(info.tracks, [{ handler: "vide", codec: "avc1", duration: 4.5 }]);
  assert.equal(info.location, false);
  const located = mp4.inspectMp4(movie({ extra: [box("udta", box("\xA9xyz", Buffer.from("+42.66+021.16/")))] }));
  assert.equal(located.location, true);
  const truncated = movie();
  truncated.writeUInt32BE(9999, 0);
  assert.throws(() => mp4.inspectMp4(truncated), /Malformed/);
  assert.throws(() => mp4.inspectMp4(Buffer.from("not a video at all")), /Malformed/);
});

// lib/attachments.js against scripted R2 and database.
async function attachments({ rows = [], objects = {}, affectedRows = 1 } = {}) {
  const queries = [],
    commands = [],
    signed = [];
  const db = {
    execute: async (sql, values) => {
      queries.push({ sql, values });
      if (sql.startsWith("SELECT id,kind")) return [rows];
      if (sql.startsWith("INSERT INTO report_images")) return [{ insertId: 70 + queries.length }];
      if (sql.startsWith("UPDATE attachments")) return [{ affectedRows }];
      return [{ insertId: 1 }];
    },
  };
  const command = (name) =>
    class {
      constructor(input) {
        this.name = name;
        this.input = input;
      }
    };
  const mocks = {
    "node:crypto": await import("node:crypto"),
    "@aws-sdk/client-s3": {
      CopyObjectCommand: command("copy"),
      DeleteObjectCommand: command("delete"),
      GetObjectCommand: command("get"),
      PutObjectCommand: command("put"),
    },
    "@aws-sdk/s3-request-presigner": {
      getSignedUrl: async (client, cmd, options) => {
        signed.push({ input: cmd.input, options });
        return `https://r2.example/${cmd.input.Key}?signed`;
      },
    },
    "./r2": {
      evidenceBucket: () => "kosova-evidence",
      r2: () => ({
        send: async (cmd) => {
          commands.push({ name: cmd.name, ...cmd.input });
          if (cmd.name !== "get") return {};
          const object = objects[cmd.input.Key];
          if (!object) throw Object.assign(new Error("missing"), { name: "NoSuchKey" });
          return { ContentType: object.type, Body: { transformToByteArray: async () => object.body } };
        },
      }),
    },
    "./mp4": mp4,
  };
  const module = new SourceTextModule(readFileSync("src/lib/attachments.js", "utf8"));
  await module.link(async (name) => {
    const values = mocks[name];
    assert.ok(values, `Unexpected import ${name}`);
    return new SyntheticModule(Object.keys(values), function () {
      for (const [key, value] of Object.entries(values)) this.setExport(key, value);
    });
  });
  await module.evaluate();
  return { lib: module.namespace, db, queries, commands, signed };
}

test("each upload is signed for one exact size and type under incoming/", async () => {
  const app = await attachments();
  const { ref, url } = await app.lib.signUpload(app.db, "video", 900_000);
  assert.ok(app.lib.validUploadRef(ref));
  assert.equal(url, `https://r2.example/incoming/${ref}?signed`);
  const [{ input, options }] = app.signed;
  assert.deepEqual(
    [input.Bucket, input.Key, input.ContentType, input.ContentLength],
    ["kosova-evidence", `incoming/${ref}`, "video/mp4", 900_000],
  );
  assert.deepEqual([...options.signableHeaders].sort(), ["content-length", "content-type"]);
  assert.equal(options.expiresIn, 600);
  assert.deepEqual(app.queries[0].values, ["video", "video/mp4", 900_000, `incoming/${ref}`]);
  for (const [kind, size] of [["video", 1_600_001], ["photo", 0], ["exe", 10], ["pdf", 1.5]])
    await assert.rejects(app.lib.signUpload(app.db, kind, size), (error) => error.status === 400);
});

const ref = (letter) => letter.repeat(32);
const row = (id, kind, body, letter) => ({
  id,
  kind,
  mime_type: { photo: "image/jpeg", video: "video/mp4", pdf: "application/pdf" }[kind],
  byte_size: body.length,
  object_key: `incoming/${ref(letter)}`,
});
const photo = Buffer.from([255, 216, 255, 224, 1, 2, 3]);
const pdf = Buffer.from("%PDF-1.7\n%%EOF");

test("uploads are checked by size, type and content before a report may use them", async () => {
  const video = movie();
  const rows = [row(1, "photo", photo, "a"), row(2, "video", video, "b"), row(3, "pdf", pdf, "c")];
  const objects = {
    [`incoming/${ref("a")}`]: { type: "image/jpeg", body: photo },
    [`incoming/${ref("b")}`]: { type: "video/mp4", body: video },
    [`incoming/${ref("c")}`]: { type: "application/pdf", body: pdf },
  };
  const app = await attachments({ rows, objects });
  const claimed = await app.lib.claimUploads(app.db, [ref("a"), ref("b"), ref("c")]);
  assert.deepEqual(claimed.map((u) => u.key), [`evidence/${ref("a")}`, `evidence/${ref("b")}`, `evidence/${ref("c")}`]);
  assert.match(app.queries[0].sql, /state='signed' AND created_at > UTC_TIMESTAMP\(\) - INTERVAL 1 DAY/);

  const copied = await app.lib.promoteUploads(claimed);
  assert.deepEqual(copied, claimed.map((u) => u.key));
  const copy = app.commands.find((c) => c.name === "copy");
  assert.equal(copy.CopySource, `kosova-evidence/incoming/${ref("a")}`);

  await app.lib.bindUploads(app.db, 7, claimed);
  const storage = app.queries.filter((q) => q.sql.startsWith("INSERT INTO report_image_storage"));
  assert.equal(storage.length, 1);
  assert.equal(storage[0].values[1], `evidence/${ref("a")}`);
  const bound = app.queries.filter((q) => q.sql.startsWith("UPDATE attachments"));
  assert.deepEqual(bound.map((q) => [q.values[0], q.values[2], q.values[3]]), [
    [7, `evidence/${ref("a")}`, 0],
    [7, `evidence/${ref("b")}`, 1],
    [7, `evidence/${ref("c")}`, 2],
  ]);
  assert.equal(bound[1].values[1], null);
});

test("uploads that are unknown, unfinished, oversized or not what they claim are refused", async () => {
  const rejects = async (options, refs, status) => {
    const app = await attachments(options);
    await assert.rejects(app.lib.claimUploads(app.db, refs), (error) => error.status === status);
  };
  await rejects({ rows: [] }, [ref("a")], 410);
  await rejects({}, ["../etc/passwd"], 400);
  await rejects({}, [ref("a"), ref("a")], 400);
  await rejects({ rows: [row(1, "video", movie(), "a"), row(2, "video", movie(), "b")] }, [ref("a"), ref("b")], 400);
  await rejects({ rows: [row(1, "photo", photo, "a")], objects: {} }, [ref("a")], 410);
  const fakes = [
    ["photo", Buffer.from("GIF89a....")],
    ["pdf", Buffer.from("<html></html>")],
    ["video", movie({ seconds: 6 })],
    ["video", movie({ tracks: [["vide", "avc1"], ["soun", "mp4a"]] })],
    ["video", movie({ tracks: [["vide", "hvc1"]] })],
    ["video", movie({ extra: [box("udta", box("loci", Buffer.alloc(12)))] })],
  ];
  for (const [kind, body] of fakes) {
    const item = row(1, kind, body, "a");
    await rejects({ rows: [item], objects: { [item.object_key]: { type: item.mime_type, body } } }, [ref("a")], 422);
  }
  const short = row(1, "photo", photo, "a");
  await rejects({ rows: [{ ...short, byte_size: 99 }], objects: { [short.object_key]: { type: "image/jpeg", body: photo } } }, [ref("a")], 422);
});

test("an upload can belong to one report only", async () => {
  const app = await attachments({ affectedRows: 0 });
  await assert.rejects(
    app.lib.bindUploads(app.db, 7, [{ id: 1, kind: "pdf", key: `evidence/${ref("a")}`, mime_type: "application/pdf", byte_size: 9 }]),
    (error) => error.status === 409,
  );
});

test("PDFs lose their author, dates, file ID, scripts and embedded files on the device", async () => {
  const { prepareDocument } = await import("../src/lib/documents.js");
  const original = await PDFDocument.create();
  original.addPage();
  original.setTitle("Complaint by Arben K.");
  original.setAuthor("Arben K.");
  original.setCreator("Word");
  original.catalog.set(original.context.obj("OpenAction"), original.context.obj({ S: "JavaScript", JS: "app.alert(1)" }));
  const bytes = await original.save();
  assert.equal((await PDFDocument.load(bytes)).getAuthor(), "Arben K.");
  const cleaned = await prepareDocument(new File([bytes], "Ankesa_Arben.pdf", { type: "application/pdf" }));
  assert.equal(cleaned.type, "application/pdf");
  assert.ok(!cleaned.name.includes("Arben"));
  const out = Buffer.from(await cleaned.arrayBuffer());
  for (const text of ["/Author", "/Title", "/Creator", "/Producer", "/CreationDate", "/OpenAction", "app.alert", "/ID"])
    assert.ok(!out.includes(text), text);
  const reloaded = await PDFDocument.load(out, { updateMetadata: false });
  assert.equal(reloaded.getPageCount(), 1);
  assert.equal(reloaded.getAuthor(), undefined);
  assert.equal(reloaded.getTitle(), undefined);
  await assert.rejects(prepareDocument(new File(["hello"], "notes.txt", { type: "text/plain" })), /type/);
});
