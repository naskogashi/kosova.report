import { database, required } from "../../../../lib/db";
import { privateHeaders, smallJSON } from "../../../../lib/tracking";
import { removeSubscription } from "../../../../lib/push";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Turns notifications off on this device: the subscription and every report it followed go.
export async function POST(request) {
  try {
    if (request.headers.get("origin") !== new URL(required("APP_URL")).origin)
      return Response.json({ error: "Origin not allowed" }, { status: 403, headers: privateHeaders });
    const body = await smallJSON(request).catch(() => null);
    if (typeof body?.endpoint !== "string" || body.endpoint.length > 1000)
      return Response.json({ error: "Invalid request" }, { status: 400, headers: privateHeaders });
    await removeSubscription(database(), body.endpoint);
    return Response.json({ following: false }, { headers: privateHeaders });
  } catch (error) {
    console.error("Push unsubscribe failed", { code: error.code || "PUSH_ERROR" });
    return Response.json({ error: "Push unavailable" }, { status: 503, headers: privateHeaders });
  }
}
