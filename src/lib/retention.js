// Evidence files are kept until 30 days after their report is resolved. A status change only
// marks the report's attachments here, inside the same transaction; moving the files in R2
// (evidence/ ⇄ expiring/) and the day-30 deletion happen after commit in the retention job.
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
