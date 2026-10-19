import { GetObjectCommand } from "@aws-sdk/client-s3";
import { database } from "../../../../lib/db";
import { r2, bucketName } from "../../../../lib/r2";
import { currentAdmin } from "../../../../lib/admin-session";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// News cover images, streamed from R2. Published posts are public; drafts only for signed-in staff.
export async function GET(request, props) {
  const params = await props.params;
  if (!/^[1-9]\d{0,9}$/.test(params.id)) return new Response("Not found", { status: 404 });
  try {
    const [rows] = await database().execute(
      "SELECT cover_key,cover_mime,status,published_at FROM news_posts WHERE id=? AND cover_key IS NOT NULL",
      [params.id],
    );
    const post = rows[0];
    if (!post) return new Response("Not found", { status: 404 });
    const visible = post.status === "published" && new Date(post.published_at) <= new Date();
    if (!visible && !(await currentAdmin())) return new Response("Not found", { status: 404 });
    if (!/^image\/(png|jpeg|webp)$/.test(post.cover_mime)) throw new Error("Unsupported type");
    const object = await r2().send(
      new GetObjectCommand({ Bucket: bucketName(), Key: post.cover_key }),
      { abortSignal: AbortSignal.timeout(5000) },
    );
    const body = await object.Body.transformToByteArray();
    return new Response(body, {
      headers: {
        "Content-Type": post.cover_mime,
        "Cache-Control": visible ? "public, max-age=3600" : "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Image unavailable", { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
