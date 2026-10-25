import { GetObjectCommand } from "@aws-sdk/client-s3";
import { database, required } from "./db";
import { r2, bucketFor } from "./r2";
import { sendDepartmentEmail } from "./smtp2go";
import { departmentLink, escapeHTML, stageFooter } from "./report-notifications";
// Staff approve each new report before its department hears about it, so spam and trolling
// never reach a municipality. The email and its private link are made at approval time.
export const approvalError = (code) => Object.assign(new Error(code), { code });
// Department email in the site's design. Albanian first, Serbian and English beside it.
// Email clients get tables and inline styles only.
const categoryNames = {
  infrastructure: ["Infrastrukturë", "Infrastruktura", "Infrastructure", "#a9592b"],
  environment: ["Mjedis", "Životna sredina", "Environment", "#3c7847"],
  public_services: ["Shërbime publike", "Javne usluge", "Public services", "#237486"],
  administration: ["Administratë", "Administracija", "Administration", "#6b518f"],
  health: ["Shëndetësi", "Zdravstvo", "Health", "#a64b51"],
  education: ["Arsim", "Obrazovanje", "Education", "#787121"],
  safety: ["Siguri", "Bezbednost", "Safety", "#416e8d"],
};
function incidentRow(incident) {
  if (!incident?.joined) return "";
  return `<tr><td style="padding:16px 24px 0"><p style="margin:0;padding:12px 16px;background:#fff6e0;border-radius:12px;font-size:14px;line-height:1.5"><strong>Raportuar ${incident.report_count} herë / Prijavljeno ${incident.report_count} puta / Reported ${incident.report_count} times.</strong><br>Qytetari tha se ky është i njëjti problem si raportet e mëparshme. / Građanin je rekao da je ovo isti problem kao ranije prijave. / The citizen said this is the same problem as earlier reports. #${escapeHTML(incident.ref)}</p></td></tr>`;
}
export function departmentEmail({ publicId, city, category, description, latitude, longitude, reporter, link, imageHTML, attached, total, files = 0, incident, status = "Pending" }) {
  const [sq, sr, en, color] = categoryNames[category] || [category, category, category, "#06244d"];
  const row = (label, value) =>
    `<tr><td style="padding:8px 12px 8px 0;color:#515e72;font-size:13px;vertical-align:top;white-space:nowrap">${label}</td><td style="padding:8px 0;color:#06244d;font-size:15px;font-weight:bold">${value}</td></tr>`;
  const map = `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=17/${latitude}/${longitude}`;
  return `<div style="background:#f6f9fd;padding:24px 12px;font-family:'Segoe UI',Arial,sans-serif;color:#06244d"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:auto;background:#ffffff;border-radius:18px;border:1px solid #d8e1ec"><tr><td style="padding:24px 24px 0"><span style="font-size:22px;font-weight:800;letter-spacing:-0.5px">kosova<span style="color:#e4b756">&#9679;</span>report</span><p style="margin:18px 0 0;color:#515e72;font-size:13px">Raport i ri qytetar / Nova prijava / New report</p><h1 style="margin:4px 0 0;font-size:28px;letter-spacing:-0.5px">${escapeHTML(publicId)}</h1><p style="margin:14px 0 0"><span style="display:inline-block;padding:6px 12px;border:2px solid ${color};border-radius:10px;color:${color};font-weight:800">${escapeHTML(sq)}</span> <span style="color:#515e72;font-size:13px">${escapeHTML(sr)} / ${escapeHTML(en)}</span></p></td></tr><tr><td style="padding:16px 24px 0"><table role="presentation" cellpadding="0" cellspacing="0">${row("Komuna / Opština / Municipality", escapeHTML(city))}${row("Vendi / Mesto / Place", `${latitude}, ${longitude}<br><a href="${map}" style="color:#154fc3;font-weight:normal;font-size:13px">OpenStreetMap</a>`)}${row("Raportuesi / Podnosilac / Reporter", reporter ? escapeHTML(reporter) : "Pa emër / Anonimno / Without name")}</table></td></tr>${incidentRow(incident)}<tr><td style="padding:16px 24px 0"><p style="margin:0 0 6px;color:#515e72;font-size:13px">Përshkrimi / Opis / Description</p><p style="margin:0;padding:14px 16px;background:#f6f9fd;border-radius:12px;font-size:16px;line-height:1.6;white-space:pre-wrap">${escapeHTML(description)}</p></td></tr><tr><td style="padding:20px 24px 0"><a href="${escapeHTML(link)}" style="display:inline-block;background:#154fc3;color:#ffffff;padding:15px 22px;border-radius:14px;font-weight:bold;text-decoration:none">Hap raportin dhe përditëso statusin</a><p style="margin:8px 0 0;color:#515e72;font-size:13px">Otvorite prijavu i ažurirajte status / Open the report and update its status</p></td></tr><tr><td style="padding:12px 24px 0">${imageHTML}<p style="margin:12px 0 0;color:#515e72;font-size:13px">${attached} / ${total} foto të bashkangjitura. Të gjitha fotot janë në panelin administrativ. / ${attached} of ${total} photos attached. All photos are in the staff panel.</p>${files ? `<p style="margin:6px 0 0;color:#515e72;font-size:13px">Video dhe dokumente të bashkangjitura / Video i dokumenti u prilogu / Video and documents attached: ${files}</p>` : ""}</td></tr><tr><td style="padding:4px 24px 0">${stageFooter(status)}</td></tr><tr><td style="padding:20px 24px 24px"><p style="margin:0;padding-top:16px;border-top:1px solid #d8e1ec;color:#515e72;font-size:12px">Lidhja është private dhe skadon pas 90 ditësh. Mos e përcillni. / The link is private and expires after 90 days. Do not forward it.<br><br>in co-operation with CODON a part of Progon LLC.</p></td></tr></table></div>`;
}
// Checkers may decide only the reports assigned to them; owners decide any report.
async function assertCanDecide(db, account, reportId) {
  if (account.role === "owner") return;
  const [rows] = await db.execute(
    "SELECT report_id FROM report_assignments WHERE report_id=? AND account_id=?",
    [reportId, account.id],
  );
  if (!rows.length) throw approvalError("not_assigned");
}
// Leave room under SMTP2Go's 50 MB encoded-message limit. Originals stay in R2.
const EMAIL_BYTES = 30 * 1024 * 1024;
async function download(key) {
  const object = await r2().send(new GetObjectCommand({ Bucket: bucketFor(key), Key: key }));
  return Buffer.from(await object.Body.transformToByteArray());
}
// Approves the report (once) and emails its department. Pressing it again after a failed
// send tries the email again. Returns { sent }; throws approvalError for staff mistakes.
export async function approveReport(account, reportId) {
  const db = database();
  await assertCanDecide(db, account, reportId);
  const connection = await db.getConnection();
  let notice;
  try {
    await connection.beginTransaction();
    const [locked] = await connection.execute(
      "SELECT review_state,anonymized_at FROM reports WHERE id=? FOR UPDATE",
      [reportId],
    );
    if (!locked.length) throw approvalError("unavailable");
    if (locked[0].anonymized_at) throw approvalError("closed");
    const [rows] = await connection.execute(
      "SELECT r.id,r.public_id,r.category,r.status,r.description,r.lat,r.lng,r.department_id,r.is_anonymous,r.reporter_email,UPPER(c.code) AS city_code,d.notification_email,i.ref,i.report_count,n.sent_at FROM reports r JOIN cities c ON c.id=r.city_id JOIN departments d ON d.id=r.department_id LEFT JOIN incidents i ON i.id=r.incident_id LEFT JOIN report_notifications n ON n.report_id=r.id WHERE r.id=?",
      [reportId],
    );
    const report = rows[0];
    if (report.sent_at) {
      await connection.commit();
      return { sent: true };
    }
    if (locked[0].review_state !== "approved")
      await connection.execute(
        "UPDATE reports SET review_state='approved',reviewed_by=?,reviewed_at=UTC_TIMESTAMP() WHERE id=?",
        [account.id, reportId],
      );
    const link = await departmentLink(connection, report);
    const [[photos], [files]] = await Promise.all([
      connection.execute(
        "SELECT s.object_key,s.mime_type,s.byte_size FROM report_images i JOIN report_image_storage s ON s.report_image_id=i.id WHERE i.report_id=? ORDER BY s.sort_order,i.id",
        [reportId],
      ),
      connection.execute(
        "SELECT kind,mime_type,byte_size,object_key FROM attachments WHERE report_id=? AND kind IN ('video','pdf') AND state='active' AND object_key IS NOT NULL ORDER BY sort_order",
        [reportId],
      ),
    ]);
    // Photos inline first, then videos and documents as ordinary attachments, while they fit.
    const inline = [],
      attached = [];
    let bytes = 0;
    for (const photo of photos) {
      if (bytes + Number(photo.byte_size) > EMAIL_BYTES) break;
      inline.push(photo);
      bytes += Number(photo.byte_size);
    }
    for (const file of files) {
      if (bytes + Number(file.byte_size) > EMAIL_BYTES) break;
      attached.push(file);
      bytes += Number(file.byte_size);
    }
    const incident = report.ref
      ? { ref: report.ref, joined: Number(report.report_count) > 1, report_count: Number(report.report_count) }
      : null;
    const html = departmentEmail({
      publicId: report.public_id,
      city: report.city_code,
      category: report.category,
      description: report.description,
      latitude: Number(report.lat),
      longitude: Number(report.lng),
      reporter: report.is_anonymous ? null : report.reporter_email,
      link,
      imageHTML: inline
        .map(
          (image, index) =>
            `<img src="cid:image-${index}@kosova.report" alt="Foto ${index + 1}" style="display:block;max-width:100%;height:auto;margin:12px 0 0;border-radius:10px"/>`,
        )
        .join(""),
      attached: inline.length,
      total: photos.length,
      files: files.length,
      incident,
      status: report.status,
    });
    const subject = incident?.joined
      ? `Raport i ri ${report.public_id} (raportuar ${incident.report_count} herë) / New report, reported ${incident.report_count} times`
      : `Raport i ri ${report.public_id} / New report`;
    await connection.execute(
      "INSERT INTO report_notifications (report_id,recipient,subject,html) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE recipient=VALUES(recipient),subject=VALUES(subject),html=VALUES(html)",
      [reportId, report.notification_email, subject, html],
    );
    await connection.commit();
    notice = { report, link, inline, attached, subject, html };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
  // The approval is saved; a failed send stays pending and staff can press the button again.
  const { report, link, inline, attached, subject, html } = notice;
  try {
    await db.execute("UPDATE report_notifications SET attempts=attempts+1 WHERE report_id=?", [reportId]);
    const photoBodies = await Promise.all(inline.map((photo) => download(photo.object_key)));
    const fileBodies = await Promise.all(attached.map((file) => download(file.object_key)));
    await sendDepartmentEmail({
      attachments: [
        ...inline.map((photo, index) => ({
          filename: `photo-${index + 1}.${photo.mime_type.split("/")[1].replace("jpeg", "jpg")}`,
          content: photoBodies[index],
          contentType: photo.mime_type,
          cid: `image-${index}@kosova.report`,
          contentDisposition: "inline",
        })),
        ...attached.map((file, index) => ({
          filename: `${file.kind === "video" ? "video" : "document"}-${index + 1}.${file.kind === "video" ? "mp4" : "pdf"}`,
          content: fileBodies[index],
          contentType: file.mime_type,
        })),
      ],
      to: report.notification_email,
      subject,
      html,
      text: `New report ${report.public_id}\n${report.description}\nCoordinates: ${report.lat}, ${report.lng}\nProgress: ${link}`,
      messageId: `<report-${report.id}-${Date.now()}@${new URL(required("APP_URL")).hostname}>`,
    });
    await db.execute("UPDATE report_notifications SET sent_at=UTC_TIMESTAMP() WHERE report_id=?", [reportId]);
    return { sent: true };
  } catch {
    console.error("Report notification pending", { reportId });
    return { sent: false };
  }
}
// Spam or trolling: the department is never emailed and the problem stays off the public map.
// The report stays in the inbox for the record; an owner can still delete it.
export async function rejectReport(account, reportId) {
  const db = database();
  await assertCanDecide(db, account, reportId);
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute(
      "SELECT r.id,n.sent_at FROM reports r LEFT JOIN report_notifications n ON n.report_id=r.id WHERE r.id=? FOR UPDATE",
      [reportId],
    );
    if (!rows.length) throw approvalError("unavailable");
    if (rows[0].sent_at) throw approvalError("already_sent");
    await connection.execute(
      "UPDATE reports SET review_state='rejected',reviewed_by=?,reviewed_at=UTC_TIMESTAMP() WHERE id=?",
      [account.id, reportId],
    );
    await connection.execute("DELETE FROM report_notifications WHERE report_id=? AND sent_at IS NULL", [reportId]);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
