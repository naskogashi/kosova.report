import { database } from "../../../lib/db";
import { cachedPerformance } from "../../../lib/performance";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The dashboard's numbers as JSON, for anyone who wants to build on them.
export async function GET(request) {
  try {
    const city = (new URL(request.url).searchParams.get("city") || "").toUpperCase();
    const data = await cachedPerformance(database(), /^[A-Z0-9]{2,10}$/.test(city) ? city : "");
    if (!data.city) return Response.json({ error: "No municipality" }, { status: 404 });
    return Response.json(data, {
      headers: { "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=600", "Access-Control-Allow-Origin": "*" },
    });
  } catch (error) {
    console.error("Performance data unavailable", { code: error.code || "PERFORMANCE_ERROR" });
    return Response.json({ error: "Unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
