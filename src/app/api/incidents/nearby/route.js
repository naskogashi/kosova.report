import { database } from "../../../../lib/db";
import { findCandidates, publicSummary } from "../../../../lib/incidents";
import { categories } from "../../../../lib/report-options";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };

// Already-reported problems near a pin, for the "Is this the same problem?" step of the report flow.
// Hidden incidents never appear; listed ones only with an approximate pin.
export async function GET(request) {
  const query = new URL(request.url).searchParams;
  const city = query.get("city") || "",
    category = query.get("category") || "",
    latitude = Number(query.get("lat")),
    longitude = Number(query.get("lng")),
    accuracy = Number(query.get("accuracy")) || undefined;
  if (
    !/^[A-Z0-9]{2,10}$/.test(city) ||
    !categories.includes(category) ||
    !query.get("lat") ||
    !query.get("lng") ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    Math.abs(latitude) > 90 ||
    Math.abs(longitude) > 180
  )
    return Response.json({ error: "Invalid search" }, { status: 400, headers });
  try {
    const db = database();
    const [cities] = await db.execute(
      "SELECT c.id FROM cities c JOIN municipality_settings m ON m.city_id=c.id WHERE c.code=? AND m.enabled=1 LIMIT 1",
      [city],
    );
    if (!cities.length) return Response.json({ incidents: [] }, { headers });
    const point = [latitude, longitude];
    const found = await findCandidates(db, { cityId: cities[0].id, category, point, accuracy });
    return Response.json(
      { incidents: found.map((row) => ({ ...publicSummary(row, point), same_category: row.sameCategory })) },
      { headers },
    );
  } catch (error) {
    console.error("Nearby incidents unavailable", { code: error.code || "NEARBY_ERROR" });
    return Response.json({ error: "Unavailable" }, { status: 503, headers });
  }
}
