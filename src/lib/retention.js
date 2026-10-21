// Evidence files are kept until 30 days after their report is resolved. A status change only
// marks the report's attachments here, inside the same transaction; moving the files in R2
// (evidence/ ⇄ expiring/), the day-30 deletion and the anonymization happen in runRetention(),
// which scripts/retention.mjs runs every 15 minutes. This file has no imports so that script
// can load it directly; storage comes in as { copy(from, to), remove(key) }.
export const RETENTION_DAYS = 30;

export async function scheduleExpiry(connection, reportId) {
  await connection.execute(
    `UPDATE attachments a JOIN reports r ON r.id=a.report_id SET a.state='expiring_pending',a.expires_at=r.resolved_at + INTERVAL ${RETENTION_DAYS} DAY WHERE a.report_id=? AND a.state IN ('active','restoring')`,
    [reportId],
  );
}

// Reopened before day 30: files still in evidence/ stay active, files already moved come back.
export async function cancelExpiry(connection, reportId) {
  await connection.execute(
    "UPDATE attachments SET state=IF(state='expiring','restoring','active'),expires_at=NULL WHERE report_id=? AND state IN ('expiring_pending','expiring')",
    [reportId],
  );
}

const renamed = (key, prefix) => `${prefix}/${key.split("/").pop()}`;

// Reports and issues resolved before retention began wait for the approved backfill.
const ALLOWED = `(%s >= s.started_at OR s.backfill_approved_at IS NOT NULL)`;
const due = (column) =>
  `${column.replace(/resolved_at$/, "status")}='Resolved' AND ${column} <= UTC_TIMESTAMP() - INTERVAL ${RETENTION_DAYS} DAY AND ${ALLOWED.replace("%s", column)}`;

async function transaction(db, work) {
  const connection = db.getConnection ? await db.getConnection() : db;
  try {
    await connection.beginTransaction();
    await work(connection);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    if (connection !== db) connection.release();
  }
}

// Columns some older databases have on reports that can identify a citizen. Each one present
// is cleared: NULL where allowed, an empty value otherwise.
const OPTIONAL_PERSONAL = [
  "reporter_name",
  "reporter_phone",
  "contact_name",
  "contact_email",
  "contact_phone",
  "images",
  "ip_address",
  "user_agent",
];
export async function personalColumns(db) {
  const [rows] = await db.execute(
    `SELECT column_name AS name,is_nullable AS nullable,data_type AS type FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='reports' AND column_name IN (${OPTIONAL_PERSONAL.map(() => "?").join(",")})`,
    OPTIONAL_PERSONAL,
  );
  return rows.map(({ name, nullable, type }) => `${name}=${nullable === "YES" ? "NULL" : type === "json" ? "'[]'" : "''"}`);
}

// Day 30, after the files are gone: only agency, municipality, category, coordinates, status
// and timestamps stay. Nothing left leads back to the citizen.
export async function anonymizeReport(connection, reportId, extraColumns = []) {
  const run = (sql) => connection.execute(sql, [reportId]);
  await run(
    `UPDATE reports SET ${["reporter_email=NULL", "description=''", "admin_note=NULL", "tracking_key=UUID()", "anonymized_at=UTC_TIMESTAMP()", ...extraColumns].join(",")} WHERE id=? AND anonymized_at IS NULL`,
  );
  await run("UPDATE report_audit_log SET note='' WHERE report_id=?");
  await run("UPDATE report_reviews SET note='' WHERE report_id=?");
  await run("DELETE FROM report_notifications WHERE report_id=?");
  await run("DELETE FROM report_status_notifications WHERE report_id=?");
  await run("DELETE FROM municipality_report_tokens WHERE report_id=?");
  await run("DELETE FROM push_outbox WHERE report_id=?");
  await run("DELETE FROM push_report_follows WHERE report_id=?");
  await run(
    "UPDATE attachments SET state='deleted',object_key=NULL,public_key=NULL,sha256=NULL,report_image_id=NULL,deleted_at=UTC_TIMESTAMP() WHERE report_id=? AND state<>'deleted'",
  );
  // Storage rows and published issue photos go with them (ON DELETE CASCADE).
  await run("DELETE FROM report_images WHERE report_id=?");
  await connection.execute(
    "DELETE s FROM push_subscriptions s WHERE NOT EXISTS (SELECT 1 FROM push_report_follows f WHERE f.subscription_id=s.id) AND NOT EXISTS (SELECT 1 FROM push_area_follows a WHERE a.subscription_id=s.id)",
  );
}

// Every R2 key a report still points to, including photos from before direct uploads.
export async function reportKeys(db, reportId, imageBase) {
  const [stored] = await db.execute(
    "SELECT object_key AS k FROM attachments WHERE report_id=? AND object_key IS NOT NULL UNION SELECT s.object_key FROM report_images i JOIN report_image_storage s ON s.report_image_id=i.id WHERE i.report_id=?",
    [reportId, reportId],
  );
  const keys = stored.map((row) => row.k);
  const [legacy] = await db.execute(
    "SELECT i.image_url AS url FROM report_images i LEFT JOIN report_image_storage s ON s.report_image_id=i.id WHERE i.report_id=? AND s.report_image_id IS NULL",
    [reportId],
  );
  for (const { url } of legacy) {
    if (!imageBase || !url?.startsWith(imageBase)) continue;
    const key = decodeURIComponent(url.slice(imageBase.length));
    if (key && !key.split("/").some((part) => part === "." || part === "..")) keys.push(key);
  }
  return [...new Set(keys)];
}

export async function runRetention({ db, storage, imageBase = "", limit = 100 }) {
  const result = { moved: 0, restored: 0, anonymized: 0, comments: 0, failed: 0 };
  const attempt = async (counter, work) => {
    try {
      await work();
      result[counter]++;
    } catch (error) {
      result.failed++;
      console.error("Retention step failed", { step: counter, code: error.code || error.name || "ERROR" });
    }
  };

  // Resolved: copy to expiring/, where the lifecycle rule counts 30 days from now.
  const [pending] = await db.execute(
    `SELECT id,object_key FROM attachments WHERE state='expiring_pending' LIMIT ${limit}`,
  );
  for (const row of pending)
    await attempt("moved", async () => {
      const key = renamed(row.object_key, "expiring");
      if (key !== row.object_key) {
        await storage.copy(row.object_key, key);
        await storage.remove(row.object_key);
      }
      await db.execute("UPDATE attachments SET object_key=?,state='expiring' WHERE id=? AND state='expiring_pending'", [key, row.id]);
      await db.execute("UPDATE report_image_storage s JOIN attachments a ON a.report_image_id=s.report_image_id SET s.object_key=? WHERE a.id=?", [key, row.id]);
    });

  // Reopened within 30 days: back to evidence/.
  const [restoring] = await db.execute(`SELECT id,object_key FROM attachments WHERE state='restoring' LIMIT ${limit}`);
  for (const row of restoring)
    await attempt("restored", async () => {
      const key = renamed(row.object_key, "evidence");
      await storage.copy(row.object_key, key);
      await storage.remove(row.object_key);
      await db.execute("UPDATE attachments SET object_key=?,state='active' WHERE id=? AND state='restoring'", [key, row.id]);
      await db.execute("UPDATE report_image_storage s JOIN attachments a ON a.report_image_id=s.report_image_id SET s.object_key=? WHERE a.id=?", [key, row.id]);
    });

  // Day 30: files deleted first (safe to repeat), then the report anonymized in one transaction.
  const [reports] = await db.execute(
    `SELECT r.id FROM reports r JOIN retention_settings s ON s.id=1 WHERE r.anonymized_at IS NULL AND ${due("r.resolved_at")} ORDER BY r.resolved_at LIMIT ${limit}`,
  );
  const extraColumns = reports.length ? await personalColumns(db) : [];
  for (const { id } of reports)
    await attempt("anonymized", async () => {
      for (const key of await reportKeys(db, id, imageBase)) await storage.remove(key);
      await transaction(db, (connection) => anonymizeReport(connection, id, extraColumns));
    });

  // Photos in comments follow their issue.
  const [photos] = await db.execute(
    `SELECT m.id,m.object_key FROM incident_comment_images m JOIN incident_comments c ON c.id=m.comment_id JOIN incidents i ON i.id=c.incident_id JOIN retention_settings s ON s.id=1 WHERE ${due("i.resolved_at")} LIMIT ${limit * 5}`,
  );
  for (const photo of photos)
    await attempt("comments", async () => {
      await storage.remove(photo.object_key);
      await db.execute("DELETE FROM incident_comment_images WHERE id=?", [photo.id]);
    });

  // Rows of uploads never sent with a report; their objects expire under incoming/ after a day.
  await db.execute("DELETE FROM attachments WHERE state='signed' AND created_at < UTC_TIMESTAMP() - INTERVAL 2 DAY");
  return result;
}

// What the one-time backfill would delete: reports and issues resolved more than 30 days
// before retention began. Counts only, nothing personal.
export async function backfillSummary(db) {
  const before = (column) =>
    `${column.replace(/resolved_at$/, "status")}='Resolved' AND ${column} <= UTC_TIMESTAMP() - INTERVAL ${RETENTION_DAYS} DAY AND ${column} < s.started_at`;
  const [[settings]] = await db.execute(
    "SELECT started_at,backfill_approved_at AS approved_at FROM retention_settings WHERE id=1",
  );
  const [[reports]] = await db.execute(
    `SELECT COUNT(DISTINCT r.id) AS reports,COUNT(i.id) AS photos FROM reports r JOIN retention_settings s ON s.id=1 LEFT JOIN report_images i ON i.report_id=r.id WHERE r.anonymized_at IS NULL AND ${before("r.resolved_at")}`,
  );
  const [[comments]] = await db.execute(
    `SELECT COUNT(*) AS photos FROM incident_comment_images m JOIN incident_comments c ON c.id=m.comment_id JOIN incidents i ON i.id=c.incident_id JOIN retention_settings s ON s.id=1 WHERE ${before("i.resolved_at")}`,
  );
  return { ...settings, reports: Number(reports.reports), photos: Number(reports.photos), commentPhotos: Number(comments.photos) };
}

export async function approveBackfill(db) {
  await db.execute("UPDATE retention_settings SET backfill_approved_at=UTC_TIMESTAMP() WHERE id=1 AND backfill_approved_at IS NULL");
}
