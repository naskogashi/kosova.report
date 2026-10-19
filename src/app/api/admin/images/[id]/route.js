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
      "SELECT object_key,mime_type FROM report_images WHERE id=? LIMIT 1",
      [params.id],
    );
    const image = rows[0];
    if (
      !image ||
      !["image/jpeg", "image/png", "image/webp"].includes(image.mime_type)
    )
      return Response.json(
        { error: "Image not found" },
        { status: 404, headers },
      );
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
        Bucket: required("R2_BUCKET"),
        Key: image.object_key,
      }),
    );
    return new Response(object.Body.transformToWebStream(), {
      headers: {
        ...headers,
        "Content-Type": image.mime_type,
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
