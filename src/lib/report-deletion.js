import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { r2, bucketFor } from "./r2";
import { reportKeys } from "./retention";
import { logIncident, recount } from "./incidents";

// An owner deletes a report for good: its files go from R2 first (safe to repeat if what
// follows fails), then the report and everything linked to it in one transaction, with a line
// in report_deletions saying which report, who and when. The report then counts nowhere:
// not in statistics, the map or its issue. Report numbers are never reused.
export async function deleteReport(db, reportId, account) {
  const [rows] = await db.execute("SELECT id,public_id,category,city_id,created_at,incident_id FROM reports WHERE id=?", [reportId]);
  const report = rows[0];
  if (!report) throw Object.assign(new Error("Report unavailable"), { status: 404 });
  const imageBase = (process.env.R2_IMAGE_BASE_URL || "https://images.kosova.report").replace(/\/?$/, "/");
  for (const key of await reportKeys(db, report.id, imageBase))
    await r2().send(new DeleteObjectCommand({ Bucket: bucketFor(key), Key: key }));

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const [locked] = await connection.execute("SELECT id FROM reports WHERE id=? FOR UPDATE", [report.id]);
    if (!locked.length) throw Object.assign(new Error("Report unavailable"), { status: 404 });
    await connection.execute(
      "INSERT INTO report_deletions (public_id,category,city_id,reported_at,deleted_by,deleted_by_name,deleted_by_email) VALUES (?,?,?,?,?,?,?)",
      [report.public_id, report.category, report.city_id, report.created_at, account.id, account.name || account.email, account.email],
    );
    await connection.execute("UPDATE attachments SET report_image_id=NULL WHERE report_id=?", [report.id]);
    await connection.execute("DELETE FROM attachments WHERE report_id=?", [report.id]);
    // Storage rows and published issue photos go with the images (ON DELETE CASCADE).
    await connection.execute("DELETE FROM report_images WHERE report_id=?", [report.id]);
    await connection.execute("UPDATE incidents SET seed_report_id=NULL WHERE seed_report_id=?", [report.id]);
    // Audit log, notes, assignments, notifications, department links and push follows cascade.
    await connection.execute("DELETE FROM reports WHERE id=?", [report.id]);
    if (report.incident_id) {
      await recount(connection, report.incident_id);
      // An issue left without reports disappears from public view.
      await connection.execute("UPDATE incidents SET visibility='hidden' WHERE id=? AND report_count=0", [report.incident_id]);
      await logIncident(connection, report.incident_id, account.email, "report_deleted", `Report ${report.public_id} deleted by staff.`);
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
  return report.public_id;
}
