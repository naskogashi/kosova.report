import { randomBytes } from "node:crypto";
import { digest, siteConfig } from "./admin-auth";
import { database } from "./db";
import { sendDepartmentEmail } from "./smtp2go";
export const escapeHTML = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export async function departmentLink(connection, report) {
  const token = randomBytes(32).toString("base64url");
  await connection.execute(
    "INSERT INTO municipality_report_tokens (token_hash,report_id,department_id,expires_at) VALUES (?,?,?,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 90 DAY))",
    [digest(token), report.id, report.department_id],
  );
  return `${siteConfig().origin}/municipality/${encodeURIComponent(report.public_id)}#key=${token}`;
}
export const citizenLink = (report) =>
  `${siteConfig().origin}/track/${encodeURIComponent(report.public_id)}#key=${encodeURIComponent(report.tracking_key)}`;
export async function queueStatusEmails(
  connection,
  reportId,
  eventKey,
  audiences = ["department", "reporter"],
) {
  const [rows] = await connection.execute(
    "SELECT r.id,r.public_id,r.tracking_key,r.status,r.department_id,r.is_anonymous,r.reporter_email,d.notification_email FROM reports r JOIN departments d ON d.id=r.department_id WHERE r.id=?",
    [reportId],
  );
  const report = rows[0];
  if (!report) throw new Error("Report not found");
  for (const audience of audiences) {
    if (
      audience === "reporter" &&
      (report.is_anonymous || !report.reporter_email)
    )
      continue;
    const recipient =
      audience === "department"
        ? report.notification_email
        : report.reporter_email;
    const link =
      audience === "department"
        ? await departmentLink(connection, report)
        : citizenLink(report);
    const subject = `${report.public_id}: ${report.status}`;
    const html = `<div style="font-family:Arial,sans-serif;color:#102344;max-width:640px;margin:auto"><div style="background:#062653;color:white;padding:24px;font-size:22px">kosova.report</div><div style="padding:24px"><h1>${escapeHTML(report.public_id)}</h1><p>Report status: <strong>${escapeHTML(report.status)}</strong></p><p><a href="${escapeHTML(link)}" style="display:inline-block;background:#0843b5;color:white;padding:14px 20px;border-radius:8px">${audience === "department" ? "View report and update progress" : "Check report progress"}</a></p><p style="font-size:12px">This private link is intended for the recipient. Do not share it publicly.</p></div><p style="font-size:12px">in co-operation with CODON a part of Progon LLC.</p></div>`;
    await connection.execute(
      "INSERT IGNORE INTO report_status_notifications (event_key,audience,report_id,recipient,subject,html,text_body) VALUES (?,?,?,?,?,?,?)",
      [
        eventKey,
        audience,
        reportId,
        recipient,
        subject,
        html,
        `${report.public_id}: ${report.status}\nPrivate progress link: ${link}`,
      ],
    );
  }
}
export async function deliverStatusEmails(eventKey) {
  const [rows] = await database().execute(
    "SELECT id,recipient,subject,html,text_body FROM report_status_notifications WHERE event_key=? AND sent_at IS NULL",
    [eventKey],
  );
  let pending = 0;
  for (const row of rows) {
    try {
      await database().execute(
        "UPDATE report_status_notifications SET attempts=attempts+1 WHERE id=?",
        [row.id],
      );
      await sendDepartmentEmail({
        to: row.recipient,
        subject: row.subject,
        html: row.html,
        text: row.text_body,
        messageId: `<status-${row.id}@${new URL(siteConfig().origin).hostname}>`,
        attachments: [],
      });
      await database().execute(
        "UPDATE report_status_notifications SET sent_at=UTC_TIMESTAMP() WHERE id=?",
        [row.id],
      );
    } catch {
      pending++;
      console.error("Status email pending", { notificationId: row.id });
    }
  }
  return { pending };
}
