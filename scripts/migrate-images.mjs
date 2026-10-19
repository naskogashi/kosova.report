import { createHash } from "node:crypto";
import { readFile, realpath } from "node:fs/promises";
import path from "node:path";
import {
  PutObjectCommand,
  HeadObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { connect, storage, bucket, objectURL, required } from "./runtime.mjs";
import { branding } from "../src/lib/branding.js";
const apply = process.argv.includes("--apply");
const root = await realpath(path.resolve("public"));
const allowed = new Set([
  new URL(process.env.APP_URL || "https://kosova.report").hostname,
  "wellmecs.com",
  "sbunker.org",
  ...(process.env.IMAGE_MIGRATION_ALLOWED_HOSTS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
]);
function typeOf(body) {
  if (body.subarray(0, 3).equals(Buffer.from([255, 216, 255])))
    return ["image/jpeg", "jpg"];
  if (
    body.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    return ["image/png", "png"];
  if (
    body.toString("ascii", 0, 4) === "RIFF" &&
    body.toString("ascii", 8, 12) === "WEBP"
  )
    return ["image/webp", "webp"];
  throw Error("Unsupported image signature");
}
async function source(url) {
  if (url.startsWith("/")) {
    const target = await realpath(
      path.resolve(
        root,
        "." +
          decodeURIComponent(new URL(url, "https://local.invalid").pathname),
      ),
    );
    if (!target.startsWith(root + path.sep))
      throw Error("Local image is outside public/");
    return readFile(target);
  }
  const base = new URL(objectURL("")),
    input = new URL(url);
  if (
    input.origin === base.origin &&
    input.pathname.startsWith(base.pathname)
  ) {
    const result = await storage().send(
      new GetObjectCommand({
        Bucket: bucket(),
        Key: decodeURIComponent(input.pathname.slice(base.pathname.length)),
      }),
    );
    return Buffer.from(await result.Body.transformToByteArray());
  }
  let current = input;
  for (let count = 0; count < 5; count++) {
    if (
      current.protocol !== "https:" ||
      !allowed.has(current.hostname) ||
      current.username ||
      current.password
    )
      throw Error("Image source host is not allowed");
    const response = await fetch(current, {
      redirect: "manual",
      signal: AbortSignal.timeout(20000),
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      current = new URL(response.headers.get("location"), current);
      await response.body?.cancel();
      continue;
    }
    if (!response.ok)
      throw Error(`Image source returned HTTP ${response.status}`);
    const reader = response.body.getReader(),
      parts = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 6 * 1024 * 1024) {
        await reader.cancel();
        throw Error("Image exceeds 6 MiB migration limit");
      }
      parts.push(value);
    }
    return Buffer.concat(parts);
  }
  throw Error("Too many redirects");
}
async function upload(body, prefix) {
  if (body.length > 6 * 1024 * 1024)
    throw Error("Image exceeds migration limit");
  const [mime, extension] = typeOf(body),
    sha = createHash("sha256").update(body).digest("hex"),
    key = `${prefix}-${sha.slice(0, 20)}.${extension}`;
  const client = storage();
  await client.send(
    new PutObjectCommand({
      Bucket: bucket(),
      Key: key,
      Body: body,
      ContentType: mime,
      Metadata: { sha256: sha },
    }),
  );
  const verified = await client.send(
    new HeadObjectCommand({ Bucket: bucket(), Key: key }),
  );
  if (
    verified.ContentLength !== body.length ||
    verified.Metadata?.sha256 !== sha
  )
    throw Error("R2 verification failed");
  return { key, mime };
}
let connection,
  failed = 0;
try {
  connection = await connect();
  const [images] = await connection.execute(
    "SELECT i.id,i.report_id,i.image_url FROM report_images i LEFT JOIN report_image_storage s ON s.report_image_id=i.id WHERE s.report_image_id IS NULL ORDER BY i.id",
  );
  console.log(
    `${apply ? "Migrating" : "Dry run:"} ${branding.length} branding assets and ${images.length} legacy report images to ${bucket()}.`,
  );
  for (const asset of branding) {
    if (!apply) {
      console.log(`Branding: ${asset.key}`);
      continue;
    }
    try {
      const body = await source(asset.fallback);
      const uploaded = await upload(body, `branding/${asset.key}`);
      await connection.execute(
        "INSERT INTO branding_assets (asset_key,object_key,mime_type) VALUES (?,?,?) ON DUPLICATE KEY UPDATE object_key=VALUES(object_key),mime_type=VALUES(mime_type)",
        [asset.key, uploaded.key, uploaded.mime],
      );
      console.log(`Branding migrated: ${asset.key}`);
    } catch (error) {
      failed++;
      console.error(`Branding ${asset.key}: ${error.message}`);
    }
  }
  for (const image of images) {
    if (!apply) {
      console.log(`Report image ID: ${image.id}`);
      continue;
    }
    let transaction = false;
    try {
      const body = await source(image.image_url);
      const uploaded = await upload(
          body,
          `reports/legacy/${image.report_id}/${image.id}`,
        ),
        url = objectURL(uploaded.key);
      if (url.length > 512) throw Error("URL exceeds existing database limit");
      await connection.beginTransaction();
      transaction = true;
      const [locked] = await connection.execute(
        "SELECT image_url FROM report_images WHERE id=? FOR UPDATE",
        [image.id],
      );
      if (locked[0]?.image_url !== image.image_url)
        throw Error("Image changed during migration; retry");
      await connection.execute(
        "UPDATE report_images SET image_url=? WHERE id=?",
        [url, image.id],
      );
      await connection.execute(
        "INSERT IGNORE INTO report_image_storage (report_image_id,object_key,mime_type,byte_size,sort_order) VALUES (?,?,?,?,0)",
        [image.id, uploaded.key, uploaded.mime, body.length],
      );
      await connection.commit();
      transaction = false;
      console.log(`Report image migrated: ${image.id}`);
    } catch (error) {
      if (transaction) await connection.rollback();
      failed++;
      console.error(`Report image ${image.id}: ${error.message}`);
    }
  }
  console.log(
    apply
      ? "Migration finished. Original files were retained; only verified R2 copies are referenced."
      : "No changes made. Repeat with --apply after checking the source hosts.",
  );
  if (failed) process.exitCode = 1;
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await connection?.end();
}
