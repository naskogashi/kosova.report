import { database } from "../../../../lib/db";
import { agenciesCSV, cachedPerformance } from "../../../../lib/performance";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// One row per agency: the scorecard as a spreadsheet, for journalists and researchers.
export async function GET(request) {
  try {
    const city = (new URL(request.url).searchParams.get("city") || "").toUpperCase();
    const data = await cachedPerformance(database(), /^[A-Z0-9]{2,10}$/.test(city) ? city : "");
    if (!data.city) return new Response("No municipality", { status: 404 });
    return new Response(`﻿${agenciesCSV(data)}`, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="kosova-report-performance-${data.city.code}-${data.updatedAt.slice(0, 10)}.csv"`,
        "Cache-Control": "public, max-age=60, s-maxage=300",
      },
    });
  } catch (error) {
    console.error("Performance CSV unavailable", { code: error.code || "PERFORMANCE_ERROR" });
    return new Response("Unavailable", { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
