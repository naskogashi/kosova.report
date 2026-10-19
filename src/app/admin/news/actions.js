"use server";
import { randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { redirect, unstable_rethrow } from "next/navigation";
import { revalidatePath } from "next/cache";
import { DeleteObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { database } from "../../../lib/db";
import { r2, bucketName } from "../../../lib/r2";
import { requireOwner } from "../../../lib/admin-session";
import { siteConfig } from "../../../lib/admin-auth";
import { fromKosovoTime, imageType, newsKinds, newsLocales, slugify, slugValid } from "../../../lib/news";

async function assertOrigin() {
  if ((await headers()).get("origin") !== siteConfig().origin) throw new Error("Request origin not allowed");
}
const text = (form, key, max) => {
  const value = form.get(key);
  return typeof value === "string" ? value.trim().slice(0, max) : "";
};
const back = (id, query) => redirect(`/admin/news/${id || "new"}?${query}`);

// Creates or updates a post. Albanian title is required; other languages are optional.
export async function saveNewsAction(form) {
  await assertOrigin();
  const account = await requireOwner();
  const id = text(form, "id", 10);
  if (id && !/^[1-9]\d{0,9}$/.test(id)) throw new Error("Invalid post");
  const kind = newsKinds.includes(form.get("kind")) ? form.get("kind") : "update";
  const status = form.get("status") === "published" ? "published" : "draft";
  const fields = {};
  for (const l of newsLocales) {
    fields[`title_${l}`] = text(form, `title_${l}`, 200);
    fields[`summary_${l}`] = text(form, `summary_${l}`, 400);
    fields[`body_${l}`] = text(form, `body_${l}`, 60000);
    fields[`cover_alt_${l}`] = text(form, `cover_alt_${l}`, 200);
  }
  if (!fields.title_sq) back(id, "error=title");
  const slug = text(form, "slug", 120) || slugify(fields.title_sq);
  if (!slugValid(slug)) back(id, "error=slug");
  const when = text(form, "published_at", 20);
  const publishedAt = when ? fromKosovoTime(when) : status === "published" ? new Date() : null;
  if (when && !publishedAt) back(id, "error=date");

  // Cover image: checked by its bytes, stored in R2 like report photos.
  let cover = null;
  const file = form.get("cover");
  if (file && typeof file === "object" && file.size > 0) {
    if (file.size > 5 * 1024 * 1024) back(id, "error=cover");
    const body = Buffer.from(await file.arrayBuffer());
    const type = imageType(body);
    if (!type) back(id, "error=cover");
    cover = { key: `news/${randomUUID()}.${type[1]}`, mime: type[0], body };
  }
  const removeCover = form.get("remove_cover") === "1";

  let previousKey = null;
  let savedId = id;
  try {
    if (id) {
      const [rows] = await database().execute("SELECT cover_key FROM news_posts WHERE id=?", [id]);
      if (!rows.length) back(id, "error=missing");
      previousKey = rows[0].cover_key;
    }
    if (cover)
      await r2().send(
        new PutObjectCommand({ Bucket: bucketName(), Key: cover.key, Body: cover.body, ContentType: cover.mime }),
      );
    const values = [
      slug,
      kind,
      status,
      ...newsLocales.flatMap((l) => [fields[`title_${l}`], fields[`summary_${l}`], fields[`body_${l}`], fields[`cover_alt_${l}`]]),
      publishedAt,
    ];
    const names = ["slug", "kind", "status", ...newsLocales.flatMap((l) => [`title_${l}`, `summary_${l}`, `body_${l}`, `cover_alt_${l}`]), "published_at"];
    const coverChange = cover || removeCover;
    if (coverChange) {
      names.push("cover_key", "cover_mime");
      values.push(cover?.key || null, cover?.mime || null);
    }
    if (id) {
      await database().execute(
        `UPDATE news_posts SET ${names.map((n) => `${n}=?`).join(",")} WHERE id=?`,
        [...values, id],
      );
    } else {
      const [result] = await database().execute(
        `INSERT INTO news_posts (${[...names, "author_id"].join(",")}) VALUES (${[...names, "author_id"].map(() => "?").join(",")})`,
        [...values, account.id],
      );
      savedId = String(result.insertId);
    }
    if (coverChange && previousKey)
      await r2()
        .send(new DeleteObjectCommand({ Bucket: bucketName(), Key: previousKey }))
        .catch(() => {});
  } catch (error) {
    unstable_rethrow(error);
    if (cover)
      await r2()
        .send(new DeleteObjectCommand({ Bucket: bucketName(), Key: cover.key }))
        .catch(() => {});
    back(id, error?.code === "ER_DUP_ENTRY" ? "error=slug-taken" : error?.code === "ER_NO_SUCH_TABLE" ? "error=setup" : "error=save");
  }
  revalidatePath("/", "layout");
  redirect(`/admin/news/${savedId}?saved=1`);
}

export async function deleteNewsAction(form) {
  await assertOrigin();
  await requireOwner();
  const id = text(form, "id", 10);
  if (!/^[1-9]\d{0,9}$/.test(id) || form.get("confirm") !== "1") back(id, "error=confirm");
  try {
    const [rows] = await database().execute("SELECT cover_key FROM news_posts WHERE id=?", [id]);
    await database().execute("DELETE FROM news_posts WHERE id=?", [id]);
    if (rows[0]?.cover_key)
      await r2()
        .send(new DeleteObjectCommand({ Bucket: bucketName(), Key: rows[0].cover_key }))
        .catch(() => {});
  } catch {
    back(id, "error=save");
  }
  revalidatePath("/", "layout");
  redirect("/admin/news?deleted=1");
}
