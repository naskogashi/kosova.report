import { GetObjectCommand } from "@aws-sdk/client-s3";
import { database } from "../../../../../../lib/db";
import { r2, bucketName } from "../../../../../../lib/r2";
import { validRef } from "../../../../../../lib/incident-matching";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Photos on a public incident page: report photos staff chose to publish (r<id>)
// and photos from approved comments (c<id>). Everything else stays private.
export async function GET(request, props) {
  const { ref, photo } = await props.params;
  const match = /^([rc])([1-9]\d{0,9})$/.exec(photo || "");
  if (!validRef(ref) || !match) return new Response("Not found", { status: 404 });
  try {
    const [rows] =
      match[1] === "r"
        ? await database().execute(
            "SELECT s.object_key,s.mime_type FROM incident_public_images p JOIN incidents i ON i.id=p.incident_id JOIN report_image_storage s ON s.report_image_id=p.report_image_id WHERE i.ref=? AND i.visibility='public' AND i.merged_into IS NULL AND p.report_image_id=? LIMIT 1",
            [ref, match[2]],
          )
        : await database().execute(
            "SELECT m.object_key,m.mime_type FROM incident_comment_images m JOIN incident_comments c ON c.id=m.comment_id JOIN incidents i ON i.id=c.incident_id WHERE i.ref=? AND i.visibility<>'hidden' AND i.merged_into IS NULL AND c.status='approved' AND m.id=? LIMIT 1",
            [ref, match[2]],
          );
    const image = rows[0];
    if (!image) return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
    if (!/^image\/(png|jpeg|webp)$/.test(image.mime_type)) throw new Error("Unsupported type");
    const object = await r2().send(new GetObjectCommand({ Bucket: bucketName(), Key: image.object_key }), {
      abortSignal: AbortSignal.timeout(5000),
    });
    return new Response(await object.Body.transformToByteArray(), {
      headers: {
        "Content-Type": image.mime_type,
        // Short, so a photo staff unpublish disappears soon.
        "Cache-Control": "public, max-age=300",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Image unavailable", { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
