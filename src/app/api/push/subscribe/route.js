import { database, required } from "../../../../lib/db";
import { publicIdValid, privateHeaders, smallJSON } from "../../../../lib/tracking";
import { clientAddress, withinLimit } from "../../../../lib/incidents";
import { followReport, pushConfigured, saveSubscription, validSubscription } from "../../../../lib/push";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// A device follows its own report. The private tracking key proves the report is theirs.
export async function POST(request) {
  try {
    if (request.headers.get("origin") !== new URL(required("APP_URL")).origin)
      return Response.json({ error: "Origin not allowed" }, { status: 403, headers: privateHeaders });
    if (!pushConfigured()) return Response.json({ error: "Push unavailable" }, { status: 404, headers: privateHeaders });
    const body = await smallJSON(request).catch(() => null);
    const locale = ["sq", "sr", "en"].includes(body?.locale) ? body.locale : "sq";
    if (
      !body ||
      !publicIdValid(body.publicId) ||
      !/^[0-9a-f-]{36}$/.test(body.trackingKey || "") ||
      !validSubscription(body.subscription)
    )
      return Response.json({ error: "Invalid request" }, { status: 400, headers: privateHeaders });
    const db = database();
    if (!(await withinLimit(db, `push:${clientAddress(request)}`, 20, 60)))
      return Response.json({ error: "Too many requests" }, { status: 429, headers: privateHeaders });
    const [reports] = await db.execute(
      "SELECT id FROM reports WHERE public_id=? AND tracking_key=? AND anonymized_at IS NULL LIMIT 1",
      [body.publicId, body.trackingKey],
    );
    if (!reports.length) return Response.json({ error: "Report not found" }, { status: 404, headers: privateHeaders });
    await followReport(db, await saveSubscription(db, body.subscription, locale), reports[0].id);
    return Response.json({ following: true }, { headers: privateHeaders });
  } catch (error) {
    console.error("Push subscription failed", { code: error.code || "PUSH_ERROR" });
    return Response.json({ error: "Push unavailable" }, { status: 503, headers: privateHeaders });
  }
}
