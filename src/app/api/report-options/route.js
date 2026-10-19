import { database } from "../../../lib/db";
import { categories } from "../../../lib/report-options";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const [rows] = await database().execute(
      "SELECT UPPER(c.code) AS code,c.name,routing.category FROM cities c JOIN department_routes routing ON routing.city_id=c.id JOIN departments d ON d.id=routing.department_id AND d.city_id=c.id WHERE routing.active=1 ORDER BY c.name",
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
