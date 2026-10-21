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
import { syncIncidentStatus } from "../../../../lib/incidents";
import { setReportStatus } from "../../../../lib/report-status";
import { queueFollowerPush, deliverPush } from "../../../../lib/push";
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
    // The first time the department opens its link, the citizen hears that it was opened.
    try {
      const [opened] = await database().execute(
        "UPDATE reports SET first_opened_at=UTC_TIMESTAMP() WHERE id=? AND first_opened_at IS NULL",
        [id],
      );
      if (opened.affectedRows === 1) {
        await queueFollowerPush(database(), id, "opened", "opened");
        await deliverPush(database());
      }
    } catch {
      console.error("Opened notice pending", { reportId: id });
    }
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
  let connection, eventKey, status,
    shared = [];
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
      await setReportStatus(connection, report.id, status);
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
      // Other reports of the same problem move with it.
      shared = await syncIncidentStatus(connection, report.id, status, report.notification_email);
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
  for (const key of eventKey ? [eventKey, ...shared] : []) {
    try {
      pending += (await deliverStatusEmails(key)).pending;
    } catch {
      pending++;
    }
  }
  if (eventKey) {
    // The citizen's own devices hear about it at once.
    try {
      await deliverPush(database());
    } catch {
      console.error("Push delivery pending");
    }
  }
  return Response.json(
    { status, notification: pending ? "pending" : "sent" },
    { headers: privateHeaders },
  );
}
