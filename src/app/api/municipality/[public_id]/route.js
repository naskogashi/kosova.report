import { database } from "../../../../lib/db";
import { digest, siteConfig } from "../../../../lib/admin-auth";
import {
  bearer,
  publicIdValid,
  privateHeaders,
  smallJSON,
} from "../../../../lib/tracking";
import {
  queueStatusEmails,
  deliverStatusEmails,
} from "../../../../lib/report-notifications";
export const dynamic = "force-dynamic";
const select =
  "SELECT r.id,r.public_id,r.category,r.description,r.status,r.created_at,r.resolved_at,r.lat,r.lng,d.notification_email,c.name AS city FROM reports r JOIN departments d ON d.id=r.department_id JOIN cities c ON c.id=r.city_id JOIN municipality_report_tokens t ON t.report_id=r.id AND t.department_id=r.department_id WHERE r.public_id=? AND t.token_hash=? AND t.expires_at>UTC_TIMESTAMP()";
export async function GET(request, props) {
  const params = await props.params;
  const token = bearer(request);
  if (!token || !publicIdValid(params.public_id))
    return Response.json(
      { error: "Report not found" },
      { status: 404, headers: privateHeaders },
    );
  try {
    const [rows] = await database().execute(select + " LIMIT 1", [
      params.public_id,
      digest(token),
    ]);
    if (!rows.length)
      return Response.json(
        { error: "Report not found" },
        { status: 404, headers: privateHeaders },
      );
    const { id, notification_email, ...report } = rows[0];
    return Response.json(report, { headers: privateHeaders });
  } catch {
    return Response.json(
      { error: "Report unavailable" },
      { status: 503, headers: privateHeaders },
    );
  }
}
export async function POST(request, props) {
  const params = await props.params;
  if (request.headers.get("origin") !== siteConfig().origin)
    return Response.json(
      { error: "Origin not allowed" },
      { status: 403, headers: privateHeaders },
    );
  const token = bearer(request);
  if (!token || !publicIdValid(params.public_id))
    return Response.json(
      { error: "Report not found" },
      { status: 404, headers: privateHeaders },
    );
  let connection, eventKey, status;
  try {
    connection = await database().getConnection();
    await connection.beginTransaction();
    const [rows] = await connection.execute(select + " LIMIT 1 FOR UPDATE", [
      params.public_id,
      digest(token),
    ]);
    const report = rows[0];
    if (!report) {
      await connection.rollback();
      return Response.json(
        { error: "Report not found" },
        { status: 404, headers: privateHeaders },
      );
    }
    const data = await smallJSON(request);
    status = data.status;
    if (
      !["In Progress", "Resolved"].includes(status) ||
      (report.status === "Resolved" && status !== "Resolved")
    ) {
      await connection.rollback();
      return Response.json(
        { error: "Invalid status transition" },
        { status: 400, headers: privateHeaders },
      );
    }
    if (report.status !== status) {
      await connection.execute(
        "UPDATE reports SET status=?,resolved_at=CASE WHEN ?='Resolved' THEN COALESCE(resolved_at,UTC_TIMESTAMP()) ELSE NULL END WHERE id=?",
        [status, status, report.id],
      );
      const [audit] = await connection.execute(
        "INSERT INTO report_audit_log (report_id,actor_email,previous_status,new_status,note) VALUES (?,?,?,?,?)",
        [
          report.id,
          report.notification_email,
          report.status,
          status,
          "Municipality updated progress through its private email link.",
        ],
      );
      eventKey = `audit:${audit.insertId}`;
      await queueStatusEmails(connection, report.id, eventKey);
    }
    await connection.commit();
  } catch (error) {
    if (connection) await connection.rollback();
    console.error("Municipality update failed", {
      code: error.code || "UPDATE_ERROR",
    });
    return Response.json(
      { error: "Update unavailable" },
      { status: 503, headers: privateHeaders },
    );
  } finally {
    connection?.release();
  }
  let pending = 0;
  if (eventKey) {
    try {
      pending = (await deliverStatusEmails(eventKey)).pending;
    } catch {
      pending = 1;
    }
  }
  return Response.json(
    { status, notification: pending ? "pending" : "sent" },
    { headers: privateHeaders },
  );
}
