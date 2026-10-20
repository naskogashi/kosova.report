import { cookies } from "next/headers";
import { database } from "../../../../lib/db";
import { VOTER_COOKIE, publicIncident, voterHash } from "../../../../lib/incidents";
import { validRef } from "../../../../lib/incident-matching";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };

// One incident as the public sees it, with approved comments and whether this browser gave a thumbs-up.
export async function GET(request, props) {
  const { ref } = await props.params;
  if (!validRef(ref)) return Response.json({ error: "Not found" }, { status: 404, headers });
  try {
    const voter = voterHash((await cookies()).get(VOTER_COOKIE)?.value);
    const incident = await publicIncident(database(), ref, voter);
    if (!incident) return Response.json({ error: "Not found" }, { status: 404, headers });
    return Response.json(incident, { headers });
  } catch (error) {
    console.error("Incident unavailable", { code: error.code || "INCIDENT_ERROR" });
    return Response.json({ error: "Unavailable" }, { status: 503, headers });
  }
}
