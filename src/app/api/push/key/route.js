import { pushConfigured } from "../../../../lib/push";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The public VAPID key browsers subscribe with. 404 while push isn't set up, so the page hides it.
export function GET() {
  if (!pushConfigured()) return Response.json({ error: "Push unavailable" }, { status: 404 });
  return Response.json({ publicKey: process.env.VAPID_PUBLIC_KEY }, { headers: { "Cache-Control": "public, max-age=3600" } });
}
