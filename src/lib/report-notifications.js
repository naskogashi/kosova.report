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
// Status emails in the site's design: Albanian first, Serbian and English beside it.
const statusNames = {
  Pending: ["Në pritje", "Na čekanju", "Pending"],
  "In Progress": ["Po trajtohet", "U obradi", "Being handled"],
  Resolved: ["I zgjidhur", "Rešeno", "Resolved"],
};
// Footer tracker: the three stages of a report, with the current one highlighted.
const stages = [
  ["Pending", "E pazgjidhur", "Nerešeno", "Not resolved"],
  ["In Progress", "Në zgjidhje", "U rešavanju", "Being resolved"],
  ["Resolved", "E zgjidhur", "Rešeno", "Resolved"],
];
export function stageFooter(current) {
  const reached = Math.max(0, stages.findIndex(([key]) => key === current));
  const cells = stages
    .map(([, sq, sr, en], index) => {
      const active = index === reached;
      const done = index < reached;
      const dot = active ? "#154fc3" : done ? "#8fb0ec" : "#d8e1ec";
      return `<td width="33%" style="padding:10px 6px;vertical-align:top;text-align:center;border-top:4px solid ${dot}"><span style="display:block;font-size:14px;font-weight:${active ? "800" : "600"};color:${active ? "#06244d" : "#515e72"}">${sq}</span><span style="display:block;font-size:11px;color:#515e72">${sr} / ${en}</span></td>`;
    })
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0 0;border-collapse:separate;border-spacing:4px 0"><tr>${cells}</tr></table>`;
}
function statusEmail({ publicId, status, stage, link, department }) {
  const action = department
    ? ["Hap raportin dhe përditëso statusin", "Otvorite prijavu i ažurirajte status / Open the report and update its status"]
    : ["Shiko ecurinë e raportit", "Pogledajte status prijave / Check your report's progress"];
  return `<div style="background:#f6f9fd;padding:24px 12px;font-family:'Segoe UI',Arial,sans-serif;color:#06244d"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:auto;background:#ffffff;border-radius:18px;border:1px solid #d8e1ec"><tr><td style="padding:24px"><span style="font-size:22px;font-weight:800;letter-spacing:-0.5px">kosova<span style="color:#e4b756">&#9679;</span>report</span><p style="margin:18px 0 0;color:#515e72;font-size:13px">Statusi i raportit / Status prijave / Report status</p><h1 style="margin:4px 0 0;font-size:28px;letter-spacing:-0.5px">${escapeHTML(publicId)}</h1><p style="margin:14px 0 0"><span style="display:inline-block;padding:6px 14px;background:#e2f0ff;border-radius:999px;color:#154fc3;font-weight:800">${escapeHTML(status[0])}</span> <span style="color:#515e72;font-size:13px">${escapeHTML(status[1])} / ${escapeHTML(status[2])}</span></p><p style="margin:22px 0 0"><a href="${escapeHTML(link)}" style="display:inline-block;background:#154fc3;color:#ffffff;padding:15px 22px;border-radius:14px;font-weight:bold;text-decoration:none">${action[0]}</a></p><p style="margin:8px 0 0;color:#515e72;font-size:13px">${escapeHTML(action[1])}</p>${stageFooter(stage)}<p style="margin:22px 0 0;padding-top:16px;border-top:1px solid #d8e1ec;color:#515e72;font-size:12px">Kjo lidhje private është vetëm për ju. Mos e ndani publikisht. / Ovaj privatni link je samo za vas. / This private link is for you only. Do not share it publicly.<br><br>Kjo platformë nuk është shërbim emergjence. / This platform is not an emergency service.<br><br>in co-operation with CODON a part of Progon LLC.</p></td></tr></table></div>`;
}
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
    "SELECT r.id,r.public_id,r.tracking_key,r.status,r.department_id,r.is_anonymous,r.reporter_email,r.review_state,d.notification_email FROM reports r JOIN departments d ON d.id=r.department_id WHERE r.id=?",
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
    // A department hears nothing about a report until staff approve it.
    if (audience === "department" && report.review_state !== "approved")
      continue;
    const recipient =
      audience === "department"
        ? report.notification_email
        : report.reporter_email;
    const link =
      audience === "department"
        ? await departmentLink(connection, report)
        : citizenLink(report);
    const [sq, sr, en] = statusNames[report.status] || [report.status, report.status, report.status];
    const subject = `${report.public_id}: ${sq} / ${en}`;
    const html = statusEmail({
      publicId: report.public_id,
      status: [sq, sr, en],
      stage: report.status,
      link,
      department: audience === "department",
    });
    await connection.execute(
      "INSERT IGNORE INTO report_status_notifications (event_key,audience,report_id,recipient,subject,html,text_body) VALUES (?,?,?,?,?,?,?)",
      [
        eventKey,
        audience,
        reportId,
        recipient,
        subject,
        html,
        `${report.public_id}: ${sq} / ${sr} / ${en}\nLidhja private / Privatni link / Private link: ${link}`,
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
