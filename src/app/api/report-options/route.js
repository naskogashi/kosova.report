import { database } from "../../../lib/db";
import { categories } from "../../../lib/report-options";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const [rows] = await database().execute(
      "SELECT UPPER(c.code) AS code,c.name,country.name AS country,m.latitude,m.longitude,m.zoom_level,routing.category FROM cities c JOIN countries country ON country.id=c.country_id JOIN municipality_settings m ON m.city_id=c.id AND m.enabled=1 JOIN department_routes routing ON routing.city_id=c.id JOIN departments d ON d.id=routing.department_id AND d.city_id=c.id WHERE routing.active=1 ORDER BY c.name",
    );
    const municipalities = new Map();
    for (const row of rows) {
      if (
        !/^[A-Z0-9]{2,10}$/.test(row.code) ||
        !categories.includes(row.category)
      )
        continue;
      if (!municipalities.has(row.code))
        municipalities.set(row.code, {
          code: row.code,
          name: row.name,
          categories: [],
          country: row.country,
          latitude: Number(row.latitude),
          longitude: Number(row.longitude),
          zoom: Number(row.zoom_level),
        });
      municipalities.get(row.code).categories.push(row.category);
    }
    return Response.json(
      { cities: [...municipalities.values()] },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Public reporting options unavailable", {
      code: error.code || "DATABASE_ERROR",
    });
    return Response.json(
      { error: "Reporting options unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
