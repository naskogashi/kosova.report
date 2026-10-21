import { database } from "../../../../lib/db";
import { privateHeaders, smallJSON } from "../../../../lib/tracking";
import { pushConfigured, renewSubscription, validSubscription } from "../../../../lib/push";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Called by the service worker when the browser replaces a subscription. There is no page origin
// to check here; the old endpoint together with its auth secret identifies the device.
export async function POST(request) {
  try {
    if (!pushConfigured()) return Response.json({ error: "Push unavailable" }, { status: 404, headers: privateHeaders });
    const body = await smallJSON(request).catch(() => null);
    if (!validSubscription(body?.subscription) || !validSubscription(body?.old))
      return Response.json({ error: "Invalid request" }, { status: 400, headers: privateHeaders });
    const renewed = await renewSubscription(database(), body.old, body.subscription);
    return Response.json({ renewed }, { status: renewed ? 200 : 404, headers: privateHeaders });
  } catch (error) {
    console.error("Push renewal failed", { code: error.code || "PUSH_ERROR" });
    return Response.json({ error: "Push unavailable" }, { status: 503, headers: privateHeaders });
  }
}
