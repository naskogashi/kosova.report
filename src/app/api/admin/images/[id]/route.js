import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { database, required } from "../../../../../lib/db";
import { currentAdmin } from "../../../../../lib/admin-session";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request, { params }) {
  const headers = {
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
  };
  if (!currentAdmin())
    return Response.json(
      { error: "Authentication required" },
      { status: 401, headers },
    );
  if (!/^[1-9]\d{0,19}$/.test(params.id))
    return Response.json(
      { error: "Image not found" },
      { status: 404, headers },
    );
  try {
    const [rows] = await database().execute(
      "SELECT i.image_url,storage.object_key,storage.mime_type FROM report_images i LEFT JOIN report_image_storage storage ON storage.report_image_id=i.id WHERE i.id=? LIMIT 1",
      [params.id],
    );
    const image = rows[0];
    if (!image)
      return Response.json(
        { error: "Image not found" },
        { status: 404, headers },
      );
    let key = image.object_key;
    if (!key) {
      // Legacy URLs may only resolve to keys inside our configured R2 host/base.
      const base = new URL(
          (
            process.env.R2_IMAGE_BASE_URL ||
            `https://${required("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com/${process.env.R2_BUCKET || "kosova-report-images"}`
          ).replace(/\/$/, "") + "/",
        ),
        url = new URL(image.image_url);
      if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname))
        return Response.json(
          { error: "Legacy image is not in the configured R2 store" },
          { status: 404, headers },
        );
      key = decodeURIComponent(url.pathname.slice(base.pathname.length));
      if (!key || key.split("/").some((part) => part === ".." || part === "."))
        return Response.json(
          { error: "Image unavailable" },
          { status: 404, headers },
        );
    }
    const s3 = new S3Client({
      region: "auto",
      endpoint: `https://${required("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: required("R2_ACCESS_KEY_ID"),
        secretAccessKey: required("R2_SECRET_ACCESS_KEY"),
      },
    });
    const object = await s3.send(
      new GetObjectCommand({
        Bucket: process.env.R2_BUCKET || "kosova-report-images",
        Key: key,
      }),
    );
    const mimeType = image.mime_type || object.ContentType;
    if (!["image/jpeg", "image/png", "image/webp"].includes(mimeType))
      return Response.json(
        { error: "Unsupported image type" },
        { status: 415, headers },
      );
    return new Response(object.Body.transformToWebStream(), {
      headers: {
        ...headers,
        "Content-Type": mimeType,
        "Content-Disposition": "inline",
      },
    });
  } catch (error) {
    console.error("Admin image unavailable", {
      code: error.code || "IMAGE_ERROR",
    });
    return Response.json(
      { error: "Image unavailable" },
      { status: 503, headers },
    );
  }
}
