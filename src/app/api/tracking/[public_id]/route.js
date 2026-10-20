import { database } from "../../../../lib/db";
import {
  bearer,
  publicIdValid,
  privateHeaders,
} from "../../../../lib/tracking";
export const dynamic = "force-dynamic";
export async function GET(request, props) {
  const params = await props.params;
  const key = bearer(request);
  if (!key || !publicIdValid(params.public_id))
    return Response.json(
      { error: "Report not found" },
      { status: 404, headers: privateHeaders },
    );
  try {
    const [rows] = await database().execute(
      "SELECT r.public_id,r.category,r.description,r.status,r.created_at,r.resolved_at,c.name AS city,i.ref AS incident_ref,i.visibility AS incident_visibility,i.report_count,i.upvote_count FROM reports r JOIN cities c ON c.id=r.city_id LEFT JOIN incidents i ON i.id=r.incident_id AND i.merged_into IS NULL WHERE r.public_id=? AND r.tracking_key=? LIMIT 1",
      [params.public_id, key],
    );
    if (!rows.length)
      return Response.json(
        { error: "Report not found" },
        { status: 404, headers: privateHeaders },
      );
    // The public issue this report belongs to, when there is one people can see.
    const { incident_ref, incident_visibility, report_count, upvote_count, ...report } = rows[0];
    return Response.json(
      {
        ...report,
        incident:
          incident_ref && incident_visibility !== "hidden"
            ? { ref: incident_ref, report_count: Number(report_count), upvote_count: Number(upvote_count) }
            : null,
      },
      { headers: privateHeaders },
    );
  } catch {
    return Response.json(
      { error: "Report status unavailable" },
      { status: 503, headers: privateHeaders },
    );
  }
}
