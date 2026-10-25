import { database } from "../../../lib/db";
import { publicSummary } from "../../../lib/incidents";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The public transparency map: every issue people may see, in each municipality on the platform.
// It follows the issue pages' rules: places are approximate unless staff published the issue,
// hidden issues never appear, nor issues no staff member has approved a report of yet, and
// nothing about the people who reported is included. Issues show up 6 hours after the first
// report, so a pin can't be matched to someone seen taking a photo. Cached for a few minutes,
// which is "live" enough and keeps the database calm.
const DELAY_HOURS = 6;

export async function GET() {
  try {
    const db = database();
    const [cities] = await db.execute(
      "SELECT c.id,UPPER(c.code) AS code,c.name,m.latitude,m.longitude,m.zoom_level FROM cities c JOIN municipality_settings m ON m.city_id=c.id WHERE m.enabled=1 ORDER BY c.name",
    );
    const [rows] = await db.execute(
      `SELECT i.ref,i.city_id,i.category,i.status,i.visibility,i.lat,i.lng,i.report_count,i.upvote_count,i.comment_count,i.public_summary,i.first_reported_at,i.last_reported_at,i.resolved_at FROM incidents i JOIN municipality_settings m ON m.city_id=i.city_id AND m.enabled=1 WHERE i.visibility<>'hidden' AND i.merged_into IS NULL AND EXISTS(SELECT 1 FROM reports r WHERE r.incident_id=i.id AND r.review_state='approved') AND i.report_count>0 AND i.first_reported_at <= UTC_TIMESTAMP() - INTERVAL ${DELAY_HOURS} HOUR ORDER BY i.last_reported_at DESC LIMIT 3000`,
    );
    // How many newer issues are still waiting, so an empty map doesn't look broken.
    const [[waiting]] = await db.execute(
      `SELECT COUNT(*) AS total FROM incidents i JOIN municipality_settings m ON m.city_id=i.city_id AND m.enabled=1 WHERE i.visibility<>'hidden' AND i.merged_into IS NULL AND EXISTS(SELECT 1 FROM reports r WHERE r.incident_id=i.id AND r.review_state='approved') AND i.report_count>0 AND i.first_reported_at > UTC_TIMESTAMP() - INTERVAL ${DELAY_HOURS} HOUR`,
    );
    const codes = new Map(cities.map((city) => [String(city.id), city.code]));
    return Response.json(
      {
        delayHours: DELAY_HOURS,
        waiting: Number(waiting?.total || 0),
        cities: cities.map((city) => ({
          code: city.code,
          name: city.name,
          center: [Number(city.latitude), Number(city.longitude)],
          zoom: Number(city.zoom_level) || 13,
        })),
        incidents: rows.map((row) => {
          const issue = publicSummary(row);
          return {
            ref: issue.ref,
            city: codes.get(String(row.city_id)),
            category: issue.category,
            status: issue.status,
            point: issue.point,
            exact: issue.exact,
            report_count: issue.report_count,
            upvote_count: issue.upvote_count,
            first_reported_at: issue.first_reported_at,
            last_reported_at: issue.last_reported_at,
            resolved_at: issue.resolved_at,
          };
        }),
      },
      { headers: { "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=600" } },
    );
  } catch (error) {
    console.error("Transparency map unavailable", { code: error.code || "MAP_ERROR" });
    return Response.json({ error: "Map unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
