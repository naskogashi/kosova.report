import { scheduleExpiry, cancelExpiry } from "./retention";

export const closedError = () =>
  Object.assign(new Error("Report is closed and anonymized"), { status: 409 });

// The only way a report's status changes. Retention follows the status in the same
// transaction: resolving starts the 30-day clock, reopening stops it. Anonymized reports
// are final. The caller holds the row lock, writes the audit entry and queues emails.
export async function setReportStatus(connection, reportId, status) {
  const [result] = await connection.execute(
    "UPDATE reports SET status=?,resolved_at=CASE WHEN ?='Resolved' THEN COALESCE(resolved_at,UTC_TIMESTAMP()) ELSE NULL END WHERE id=? AND anonymized_at IS NULL",
    [status, status, reportId],
  );
  if (result.affectedRows === 0) throw closedError();
  if (status === "Resolved") await scheduleExpiry(connection, reportId);
  else await cancelExpiry(connection, reportId);
}
