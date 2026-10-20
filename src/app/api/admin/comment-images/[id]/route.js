import { GetObjectCommand } from "@aws-sdk/client-s3";
import { database } from "../../../../../lib/db";
import { r2, bucketName } from "../../../../../lib/r2";
import { currentAdmin } from "../../../../../lib/admin-session";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Comment photos for moderators, including ones still waiting for review. Owners only.
export async function GET(request, props) {
  const { id } = await props.params;
  const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer" };
  const account = await currentAdmin();
  if (!account || account.must_change_password || account.role !== "owner")
    return Response.json({ error: "Authentication required" }, { status: 401, headers });
  if (!/^[1-9]\d{0,9}$/.test(id)) return Response.json({ error: "Image not found" }, { status: 404, headers });
  try {
    const [rows] = await database().execute("SELECT object_key,mime_type FROM incident_comment_images WHERE id=? LIMIT 1", [id]);
    const image = rows[0];
    if (!image || !/^image\/(png|jpeg|webp)$/.test(image.mime_type))
      return Response.json({ error: "Image not found" }, { status: 404, headers });
    const object = await r2().send(new GetObjectCommand({ Bucket: bucketName(), Key: image.object_key }));
    return new Response(object.Body.transformToWebStream(), { headers: { ...headers, "Content-Type": image.mime_type } });
  } catch (error) {
    console.error("Comment image unavailable", { code: error.code || "IMAGE_ERROR" });
    return Response.json({ error: "Image unavailable" }, { status: 503, headers });
  }
}
