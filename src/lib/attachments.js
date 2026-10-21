import { randomBytes } from "node:crypto";
import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { r2, evidenceBucket } from "./r2";
import { inspectMp4 } from "./mp4";

// Citizen files go from the phone straight to the private evidence bucket. The server signs one
// upload per file for its exact size and type under incoming/, then, when the report is sent,
// checks each file, copies it to evidence/ and links it to the report. Files that never become
// part of a report are deleted by the bucket's 1-day lifecycle rule on incoming/.
export const KINDS = {
  photo: { type: "image/jpeg", max: 5 * 1024 * 1024, count: 10, extension: "jpg" },
  video: { type: "video/mp4", max: 1_600_000, count: 1, extension: "mp4" },
  pdf: { type: "application/pdf", max: 5 * 1024 * 1024, count: 2, extension: "pdf" },
};
export const MAX_SECONDS = 5.1;
export const validUploadRef = (value) => /^[A-Za-z0-9_-]{32}$/.test(value || "");

const invalid = (message, status = 400) => Object.assign(new Error(message), { status });

export async function signUpload(db, kind, size) {
  const limits = KINDS[kind];
  if (!limits || !Number.isInteger(size) || size < 1 || size > limits.max) throw invalid("Invalid upload");
  const ref = randomBytes(24).toString("base64url");
  const key = `incoming/${ref}`;
  const url = await getSignedUrl(
    r2(),
    new PutObjectCommand({ Bucket: evidenceBucket(), Key: key, ContentType: limits.type, ContentLength: size }),
    { expiresIn: 600, signableHeaders: new Set(["content-type", "content-length"]) },
  );
  await db.execute(
    "INSERT INTO attachments (kind,mime_type,byte_size,object_key,state) VALUES (?,?,?,?,'signed')",
    [kind, limits.type, size, key],
  );
  return { ref, url };
}

async function readObject(key) {
  const object = await r2().send(new GetObjectCommand({ Bucket: evidenceBucket(), Key: key }));
  return {
    type: object.ContentType,
    body: Buffer.from(await object.Body.transformToByteArray()),
  };
}

// What the file must look like, beyond its signed size and type.
export function checkContent(kind, body) {
  if (kind === "photo") return body.subarray(0, 3).equals(Buffer.from([255, 216, 255]));
  if (kind === "pdf") return body.subarray(0, 5).toString("latin1") === "%PDF-";
  try {
    const video = inspectMp4(body);
    const [track] = video.tracks;
    return (
      video.tracks.length === 1 &&
      track.handler === "vide" &&
      track.codec === "avc1" &&
      video.duration <= MAX_SECONDS &&
      !video.location
    );
  } catch {
    return false;
  }
}

// Loads and checks the uploads a report names. Throws a 4xx error the citizen can act on.
export async function claimUploads(db, refs) {
  if (new Set(refs).size !== refs.length || !refs.every(validUploadRef)) throw invalid("Invalid attachments");
  if (!refs.length) return [];
  const [rows] = await db.execute(
    `SELECT id,kind,mime_type,byte_size,object_key FROM attachments WHERE object_key IN (${refs.map(() => "?").join(",")}) AND state='signed' AND created_at > UTC_TIMESTAMP() - INTERVAL 1 DAY`,
    refs.map((ref) => `incoming/${ref}`),
  );
  if (rows.length !== refs.length) throw invalid("Attachment expired or unknown, please add it again", 410);
  for (const [kind, { count }] of Object.entries(KINDS))
    if (rows.filter((row) => row.kind === kind).length > count) throw invalid("Too many attachments");
  const byKey = new Map(rows.map((row) => [row.object_key, row]));
  const claimed = [];
  for (const ref of refs) {
    const row = byKey.get(`incoming/${ref}`);
    let object;
    try {
      object = await readObject(row.object_key);
    } catch (error) {
      if (error.name === "NoSuchKey") throw invalid("Attachment upload did not finish, please add it again", 410);
      throw error;
    }
    if (object.body.length !== Number(row.byte_size) || object.type !== row.mime_type || !checkContent(row.kind, object.body))
      throw invalid(row.kind === "video" ? "Video must be at most 5 seconds, without sound" : "Attachment not accepted", 422);
    claimed.push({ ...row, ref, body: object.body, key: `evidence/${ref}` });
  }
  return claimed;
}

// Before the report transaction: copy into evidence/. Returns the keys to remove if it rolls back.
export async function promoteUploads(claimed) {
  const copied = [];
  for (const upload of claimed) {
    await r2().send(
      new CopyObjectCommand({
        Bucket: evidenceBucket(),
        CopySource: `${evidenceBucket()}/${upload.object_key}`,
        Key: upload.key,
      }),
    );
    copied.push(upload.key);
  }
  return copied;
}

// Inside the report transaction. Photos are also listed in report_images so the staff gallery,
// the department email and public issue photos work as before.
export async function bindUploads(connection, reportId, claimed) {
  let photoOrder = 0;
  for (const [order, upload] of claimed.entries()) {
    let imageId = null;
    if (upload.kind === "photo") {
      const [image] = await connection.execute("INSERT INTO report_images (report_id,image_url) VALUES (?,'')", [reportId]);
      imageId = image.insertId;
      await connection.execute(
        "INSERT INTO report_image_storage (report_image_id,object_key,mime_type,byte_size,sort_order) VALUES (?,?,?,?,?)",
        [imageId, upload.key, upload.mime_type, upload.byte_size, photoOrder++],
      );
    }
    const [bound] = await connection.execute(
      "UPDATE attachments SET report_id=?,report_image_id=?,object_key=?,state='active',sort_order=?,attached_at=UTC_TIMESTAMP() WHERE id=? AND state='signed'",
      [reportId, imageId, upload.key, order, upload.id],
    );
    // Two reports racing for the same upload: only the first one gets it.
    if (bound.affectedRows !== 1) throw invalid("Attachment already used", 409);
  }
}

export async function deleteKeys(keys) {
  await Promise.allSettled(
    keys.map((Key) => r2().send(new DeleteObjectCommand({ Bucket: evidenceBucket(), Key }))),
  );
}
