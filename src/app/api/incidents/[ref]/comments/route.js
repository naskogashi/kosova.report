import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { DeleteObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { database } from "../../../../../lib/db";
import { siteConfig } from "../../../../../lib/admin-auth";
import { r2, bucketName } from "../../../../../lib/r2";
import { imageType } from "../../../../../lib/news";
import { VOTER_COOKIE, clientAddress, voterHash, withinLimit } from "../../../../../lib/incidents";
import { validRef } from "../../../../../lib/incident-matching";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY = 16 * 1024 * 1024;
const MAX_PHOTOS = 3;
const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
const fail = (error, status = 400) => Response.json({ error }, { status, headers });

// A citizen comment, with up to three photos. It waits for staff approval before anyone sees it.
export async function POST(request, props) {
  const { ref } = await props.params;
  if (request.headers.get("origin") !== siteConfig().origin) return fail("Origin not allowed", 403);
  if (!validRef(ref)) return fail("Not found", 404);
  if (!request.headers.get("content-type")?.startsWith("multipart/form-data")) return fail("Expected multipart form data", 415);
  const reader = request.body?.getReader();
  if (!reader) return fail("Empty request");
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BODY) {
      await reader.cancel();
      return fail("Request too large", 413);
    }
    chunks.push(value);
  }
  let form;
  try {
    form = await new Request(request.url, {
      method: "POST",
      headers: { "content-type": request.headers.get("content-type") },
      body: Buffer.concat(chunks),
    }).formData();
  } catch {
    return fail("Invalid multipart body");
  }
  const field = (key) => {
    const value = form.get(key);
    return typeof value === "string" ? value.trim() : "";
  };
  const body = field("body"),
    name = field("name"),
    language = field("language");
  // The hidden "website" field is left empty by people and filled in by bots.
  if (field("website")) return Response.json({ status: "pending" }, { status: 202, headers });
  if (body.length < 2 || body.length > 1000 || name.length > 60 || !["sq", "sr", "en"].includes(language))
    return fail("Invalid comment");
  const files = form.getAll("images");
  if (files.length > MAX_PHOTOS) return fail("Too many photos");
  const photos = [];
  for (const file of files) {
    if (typeof file === "string" || !file.size || file.size > 5 * 1024 * 1024) return fail("Invalid photo");
    const data = Buffer.from(await file.arrayBuffer()),
      type = imageType(data);
    if (!type || type[0] !== file.type) return fail("Invalid photo");
    photos.push({ data, type });
  }

  const db = database();
  const voter = voterHash((await cookies()).get(VOTER_COOKIE)?.value);
  let connection;
  const uploaded = [];
  try {
    if (
      !(await withinLimit(db, `comment:${clientAddress(request)}`, 10, 60)) ||
      (voter && !(await withinLimit(db, `comment-voter:${voter}`, 5, 60)))
    )
      return fail("Too many requests", 429);
    const [rows] = await db.execute(
      "SELECT id FROM incidents WHERE ref=? AND merged_into IS NULL AND visibility<>'hidden' LIMIT 1",
      [ref],
    );
    if (!rows.length) return fail("Not found", 404);
    const folder = randomUUID();
    for (const photo of photos) {
      const key = `comments/${folder}/${randomUUID()}.${photo.type[1]}`;
      uploaded.push(key);
      await r2().send(new PutObjectCommand({ Bucket: bucketName(), Key: key, Body: photo.data, ContentType: photo.type[0] }));
    }
    connection = await db.getConnection();
    await connection.beginTransaction();
    const [comment] = await connection.execute(
      "INSERT INTO incident_comments (incident_id,author_name,body,language,voter_hash) VALUES (?,?,?,?,?)",
      [rows[0].id, name, body, language, voter],
    );
    for (let i = 0; i < photos.length; i++)
      await connection.execute(
        "INSERT INTO incident_comment_images (comment_id,object_key,mime_type,byte_size,sort_order) VALUES (?,?,?,?,?)",
        [comment.insertId, uploaded[i], photos[i].type[0], photos[i].data.length, i],
      );
    await connection.commit();
    uploaded.length = 0;
    return Response.json({ status: "pending" }, { status: 202, headers });
  } catch (error) {
    if (connection) await connection.rollback().catch(() => {});
    await Promise.allSettled(uploaded.map((Key) => r2().send(new DeleteObjectCommand({ Bucket: bucketName(), Key }))));
    console.error("Comment failed", { code: error.code || "COMMENT_ERROR" });
    return fail("Unavailable", 503);
  } finally {
    connection?.release();
  }
}
