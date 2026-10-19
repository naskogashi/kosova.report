import { GetObjectCommand } from "@aws-sdk/client-s3";
import { database } from "../../../../lib/db";
import { r2, bucketName } from "../../../../lib/r2";
import { branding } from "../../../../lib/branding";
import { readFile } from "node:fs/promises";
import path from "node:path";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
function imageResponse(body, mimeType, fallback = false) {
  return new Response(body, {
    headers: {
      "Content-Type": mimeType,
      "Cache-Control": fallback ? "public,max-age=60" : "public,max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
export async function GET(request, { params }) {
  const item = branding.find((asset) => asset.key === params.key);
  if (!item) return new Response("Not found", { status: 404 });
  try {
    const [rows] = await database().execute(
      "SELECT object_key,mime_type FROM branding_assets WHERE asset_key=?",
      [item.key],
    );
    if (rows.length) {
      const object = await r2().send(
        new GetObjectCommand({ Bucket: bucketName(), Key: rows[0].object_key }),
        { abortSignal: AbortSignal.timeout(4000) },
      );
      if (!/^image\/(png|jpeg|webp)$/.test(rows[0].mime_type))
        throw new Error("Unsupported branding type");
      const body = await object.Body.transformToByteArray();
      if (!body.length || body.length > 6 * 1024 * 1024)
        throw new Error("Invalid branding size");
      return imageResponse(body, rows[0].mime_type);
    }
  } catch {}
  // The whitelist above fixes the path. Return bytes rather than a redirect to
  // an internal proxy hostname or an unavailable public R2 custom domain.
  try {
    const body = await readFile(
      path.join(process.cwd(), "public", item.fallback),
    );
    return imageResponse(
      body,
      item.fallback.endsWith(".webp") ? "image/webp" : "image/png",
      true,
    );
  } catch {
    return new Response("Branding image unavailable", {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
