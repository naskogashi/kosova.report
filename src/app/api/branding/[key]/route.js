import { GetObjectCommand } from "@aws-sdk/client-s3";
import { database } from "../../../../lib/db";
import { r2, bucketName } from "../../../../lib/r2";
import { branding } from "../../../../lib/branding";
export const dynamic = "force-dynamic";
export async function GET(request, { params }) {
  const item = branding.find((asset) => asset.key === params.key);
  if (!item) return new Response("Not found", { status: 404 });
  try {
    const [rows] = await database().execute(
      "SELECT object_key,mime_type FROM branding_assets WHERE asset_key=?",
      [item.key],
    );
    if (rows.length) {
      const base = new URL(
        process.env.R2_IMAGE_BASE_URL || "https://images.kosova.report",
      );
      if (
        base.protocol === "https:" &&
        base.hostname === "images.kosova.report"
      ) {
        return Response.redirect(
          new URL(
            rows[0].object_key.split("/").map(encodeURIComponent).join("/"),
            base.href.replace(/\/$/, "") + "/",
          ),
          307,
        );
      }
      const object = await r2().send(
        new GetObjectCommand({ Bucket: bucketName(), Key: rows[0].object_key }),
      );
      return new Response(object.Body.transformToWebStream(), {
        headers: {
          "Content-Type": rows[0].mime_type,
          "Cache-Control": "public,max-age=3600",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }
  } catch {}
  return Response.redirect(new URL(item.fallback, request.url), 307);
}
