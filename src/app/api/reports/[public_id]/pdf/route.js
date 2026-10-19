import { database } from "../../../../../lib/db";
import { createReportPDF } from "../../../../../lib/report-pdf";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request, { params }) {
  const publicId = params.public_id;
  const credential = request.headers
    .get("authorization")
    ?.match(/^Bearer ([0-9a-f-]{36})$/i)?.[1];
  const headers = {
    "Cache-Control": "private, no-store",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
  };
  if (
    !/^[A-Z]{2}-\d{4}-\d{6,12}$/.test(publicId) ||
    !credential ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      credential,
    )
  )
    return Response.json(
      { error: "Report not found" },
      { status: 404, headers },
    );
  try {
    const [rows] = await database().execute(
      "SELECT r.public_id,r.category,r.city_code,r.latitude,r.longitude,r.description,r.created_at,c.name AS city_name,(SELECT COUNT(*) FROM report_images i WHERE i.report_id=r.id) AS image_count FROM reports r LEFT JOIN cities c ON c.code=r.city_code WHERE r.public_id=? AND r.tracking_key=? LIMIT 1",
      [publicId, credential],
    );
    if (!rows.length)
      return Response.json(
        { error: "Report not found" },
        { status: 404, headers },
      );
    return new Response(createReportPDF(rows[0]), {
      headers: {
        ...headers,
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${publicId}.pdf"`,
      },
    });
  } catch (error) {
    console.error("Receipt generation failed", {
      code: error.code || "INTERNAL",
    });
    return Response.json(
      { error: "Unable to generate receipt" },
      { status: 503, headers },
    );
  }
}
