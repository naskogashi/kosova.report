import { database, required } from "../../../../lib/db";
import { signUpload } from "../../../../lib/attachments";
import { clientAddress, withinLimit } from "../../../../lib/incidents";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };

// One signed upload for one prepared file. The browser then PUTs the file straight to R2;
// this server never handles the bytes.
export async function POST(request) {
  try {
    const appOrigin = new URL(required("APP_URL")).origin;
    if (request.headers.get("origin") && request.headers.get("origin") !== appOrigin)
      return Response.json({ error: "Origin not allowed" }, { status: 403, headers });
    const body = await request.json().catch(() => null);
    if (!body || typeof body.kind !== "string")
      return Response.json({ error: "Invalid upload" }, { status: 400, headers });
    const db = database();
    // A full report is at most 13 files; this leaves room for retries.
    if (!(await withinLimit(db, `upload:${clientAddress(request)}`, 60, 60)))
      return Response.json({ error: "Too many uploads, try again later" }, { status: 429, headers });
    const { ref, url } = await signUpload(db, body.kind, body.size);
    return Response.json({ ref, url }, { headers });
  } catch (error) {
    if (!error.status) console.error("Upload signing failed", { code: error.code || "SIGN_ERROR" });
    return Response.json(
      { error: error.status ? error.message : "Upload unavailable" },
      { status: error.status || 503, headers },
    );
  }
}
