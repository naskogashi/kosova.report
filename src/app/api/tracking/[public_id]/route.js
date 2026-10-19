import { database } from "../../../../lib/db";
import {
  bearer,
  publicIdValid,
  privateHeaders,
} from "../../../../lib/tracking";
export const dynamic = "force-dynamic";
export async function GET(request, { params }) {
  const key = bearer(request);
  if (!key || !publicIdValid(params.public_id))
    return Response.json(
      { error: "Report not found" },
      { status: 404, headers: privateHeaders },
    );
  try {
    const [rows] = await database().execute(
      "SELECT r.public_id,r.category,r.description,r.status,r.created_at,r.resolved_at,c.name AS city FROM reports r JOIN cities c ON c.id=r.city_id WHERE r.public_id=? AND r.tracking_key=? LIMIT 1",
      [params.public_id, key],
    );
    if (!rows.length)
      return Response.json(
        { error: "Report not found" },
        { status: 404, headers: privateHeaders },
      );
    return Response.json(rows[0], { headers: privateHeaders });
  } catch {
    return Response.json(
      { error: "Report status unavailable" },
      { status: 503, headers: privateHeaders },
    );
  }
}
