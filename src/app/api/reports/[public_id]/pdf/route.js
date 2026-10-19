import { database } from "../../../../../lib/db";
import { createReportPDF } from "../../../../../lib/report-pdf";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request, props) {
  const params = await props.params;
  const publicId = params.public_id;
  const credential = request.headers
    .get("authorization")
    ?.match(/^Bearer ([A-Za-z0-9_-]{32,64})$/i)?.[1];
  const headers = {
    "Cache-Control": "private, no-store",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
  };
  if (
    !/^[A-Z0-9]{2,10}-\d{4}-\d{6,12}$/.test(publicId) ||
    !credential ||
    !/^[A-Za-z0-9_-]{32,64}$/.test(credential)
  )
    return Response.json(
      { error: "Report not found" },
      { status: 404, headers },
    );
  try {
    const [rows] = await database().execute(
      "SELECT r.public_id,r.category,r.is_anonymous,c.code AS city_code,r.lat AS latitude,r.lng AS longitude,r.description,r.created_at,c.name AS city_name,(SELECT COUNT(*) FROM report_images i WHERE i.report_id=r.id) AS image_count FROM reports r JOIN cities c ON c.id=r.city_id WHERE r.public_id=? AND r.tracking_key=? LIMIT 1",
      [publicId, credential],
    );
    if (!rows.length)
      return Response.json(
        { error: "Report not found" },
        { status: 404, headers },
      );
    // The PDF follows the language the person is using; the reports table has no language column.
    const language = new URL(request.url).searchParams.get("lang");
    return new Response(createReportPDF({ ...rows[0], language }), {
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
