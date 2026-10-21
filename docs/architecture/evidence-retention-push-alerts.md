# Evidence uploads, retention, push notifications and public alerts

Final design, agreed 2026-10-21. Covers citizen attachments in Cloudflare R2, the 30-day
retention and anonymization rule, personal push notifications, staff-approved public alerts,
and how the Institutional Performance Dashboard and the Transparency Map read the data.

## 1. Rules this design enforces

| # | Rule | Where it is enforced |
|---|------|----------------------|
| R1 | Attachments (photos, 5-second videos, PDFs) are kept until 30 days after the report is resolved, then permanently deleted from R2. | `runRetention()` deletes on day 30; R2 lifecycle on `expiring/` deletes on day 30 as a safety net if the job is down. |
| R2 | On the same day the report is anonymized: contact email, push links, free text, notification history and department links are removed. Only hard metadata stays. | `anonymizeReport()`, in the same run as R1, one transaction. |
| R3 | Hard metadata stays forever: agency (department), municipality, category, coordinates, status, timestamps and the status history. | Columns are never touched by R2; dashboard and map read only these. |
| R4 | Videos are at most 5 seconds and carry no audio track. | Device: Mediabunny `audio: { discard: true }`, recording with `audio: false`. Server: `verifyVideo()` rejects audio tracks, > 5.1 s, non-H.264. Signed upload size ≤ 1.6 MB. |
| R5 | Personal notifications about a citizen's own report go out automatically and at once. | `notifyFollowers()` runs right after the status commit. Recipients are only `push_report_follows` of that one report. |
| R6 | Every public/broadcast alert waits in `pending_review` until a staff owner approves it. | DB `CHECK` constraint, atomic claim in `dispatchAlert()`, `push_area_follows` read nowhere else, approval behind `requireOwner()`. |

"Public/broadcast" means any notification addressed through `push_area_follows`, or to any device
that does not follow the report the notification is about.

## 2. Storage layout

Two R2 buckets. API token scoped to Object Read & Write on these buckets only.

**`kosova-evidence`**: private, r2.dev URL disabled, no custom domain. Staff read through the
existing proxy routes (`/api/admin/images/[id]` and friends).

| Prefix | Contents | Lifecycle rule |
|---|---|---|
| `incoming/` | signed uploads not yet attached to a sent report | expire after 1 day |
| `evidence/` | files of open reports | none |
| `expiring/` | files of resolved reports | expire after 30 days |
| `reports/`, `comments/` | files from before this design | none; handled by the one-time backfill (section 9) |
| branding, news | staff uploads, not evidence | none; never under a rule |

**`kosova-public`**: only re-encoded photos staff chose for a public incident page, behind a
Cloudflare custom domain, `Cache-Control: public, max-age=86400`. Same `expiring/` rule; when the
evidence is deleted the public copy is deleted with it.

Object keys are random and meaningless: `<prefix>/<24 random bytes, base64url>`. No report ID, date,
municipality or original filename. The key-to-report mapping exists only in MySQL.

`PutBucketLifecycleConfiguration` replaces every rule on a bucket. Never use an empty prefix.

## 3. Upload workflow

```
device  pick file ─► process (photo: canvas re-encode, EXIF gone; video: Mediabunny; PDF: pdf-lib strip)
        │            ─► Blob + SHA-256
        │ POST /api/uploads/sign {type,size,sha256}      origin check, public_rate_limits, size/type caps
        │   ◄─ {id, url}  PUT presigned for incoming/<random>, exact Content-Length + Content-Type, 10 min
        │ PUT url ─► R2 (Node never sees the bytes)
        │ POST /api/reports/submit {…fields, uploads:[id…]}   small JSON
server  HEAD each object: size + type match the signed row
        video: verifyVideo() reads the moov header by range: no audio, ≤ 5.1 s, H.264
        photo/PDF: range-read first 16 bytes for magic bytes
        copy incoming/ → evidence/, delete incoming/ copy, attachments.state = 'active'
        failures: delete the object, reject the report with a clear message
```

Signing happens only when the citizen presses Send, so abandoned drafts create no objects. Reports
queued offline (IndexedDB outbox, Background Sync on Chromium, `online`/app-start retry elsewhere)
are signed when they are actually sent.

Per report: up to 10 photos, 1 video and 2 PDFs. If a direct upload fails while online and the report has only photos, they are sent the older way, inside the report (`images`), so a CORS or R2 problem never blocks a report. Photos are also written to `report_images`/`report_image_storage` with their `evidence/` key, so the staff gallery and public issue photos keep working; the routes that read them pick the bucket from the key prefix.

Size caps: photo 5 MB, video 1.6 MB, PDF 5 MB. Video target: 720 px short edge, 24 fps, ~1.2 Mbit/s,
H.264, no audio, no metadata tags (about 750 KB for 5 s). Clips over 5 s get a trim slider instead
of a rejection. PDF only for documents; staff download with `Content-Disposition: attachment` and
`X-Content-Type-Options: nosniff`.

The `S3Client` in `src/lib/r2.js` gets `requestChecksumCalculation: "WHEN_REQUIRED"` and
`responseChecksumValidation: "WHEN_REQUIRED"` (newer SDKs add CRC32 checksums R2 can reject).
Bucket CORS: origin `https://kosova.report`, method `PUT`, header `content-type`.

## 4. Report lifecycle and retention

```
sent ──► Pending ──► In Progress ──► Resolved ─────────── 30 days ───────────► anonymized
           files: evidence/          files: expiring/                          files deleted
                                       │                                       PII purged
                                       └── reopened within 30 days ──► files back to evidence/
```

All status changes go through one function, `setReportStatus()` in `src/lib/report-status.js`.
The three current writers (`src/app/admin/actions.js`, `src/app/api/municipality/[public_id]/route.js`,
`src/lib/incidents.js`) call it instead of their own `UPDATE reports SET status=…`.

- **Resolved**: attachments → `expiring_pending`, `expires_at = resolved_at + 30 days`. After commit
  the job copies them to `expiring/` (a copy is a new object, so the lifecycle clock starts at
  resolution) and deletes the `evidence/` original.
- **Reopened before day 30**: attachments → `restoring`, copied back to `evidence/`, `expires_at` cleared.
- **Day 30** (`runRetention()`, every 15 minutes): for each report with `resolved_at + 30 days ≤ now`
  and `anonymized_at IS NULL`:
  1. `DeleteObject` every remaining file of the report in both buckets (idempotent, free).
  2. In one transaction, `anonymizeReport()` (section 5).
  If step 2 fails it retries on the next run; step 1 is safe to repeat.
- **Lifecycle safety net**: if the job is down, R2 still deletes `expiring/` objects about 30 days
  after resolution (asynchronously, usually within 24 h). The job anonymizes the DB when it is back.
- **Anonymized reports are final**: `setReportStatus()` refuses to change them. A problem that comes
  back is a new report.
- **Comment photos** follow their incident: deleted 30 days after the incident is resolved.

## 5. Anonymization (day 30, same run as the deletion)

| Kept forever (hard metadata) | Removed |
|---|---|
| `reports`: `id`, `public_id`, `city_id`, `department_id`, `category`, `lat`, `lng`, `status`, `created_at`, `first_opened_at`, `resolved_at`, `incident_id`, `is_anonymous`, `anonymized_at` | `reports.reporter_email` → NULL |
| `report_audit_log`: statuses and timestamps (staff actor emails are staff, not citizens) | `reports.description` → `''`, `reports.admin_note` → NULL |
| `attachments`: kind, MIME type, size, duration, dates | `reports.tracking_key` → new random UUID nobody holds (tracking stops working) |
| `incidents` and their staff-written public summary | `report_audit_log.note` → `''` (staff notes can quote the citizen) |
| `agency_metrics_daily` | `report_reviews.note` → `''` |
| | `report_notifications` rows (department email incl. description and reporter email): deleted |
| | `report_status_notifications` rows (citizen email, tracking link): deleted |
| | `municipality_report_tokens` rows: deleted |
| | `push_report_follows` and `push_outbox` rows of the report: deleted; subscriptions left with no follows: deleted |
| | `attachments.object_key`, `public_key`, `sha256` → NULL, `state = 'deleted'` |
| | legacy `report_images` / `report_image_storage` keys and URLs for the report: removed |

The tracking page for an anonymized report shows: resolved on <date>, anonymized on <date>, only
statistics remain. The tracking API returns `anonymized: true`, and the device then drops its stored
`{publicId → trackingKey}` entry.

`public_id` stays: incidents and published links use it, and on its own it identifies no one. The
PDF proof the citizen downloaded stays on their device, which we do not control.

### Outside the database (operations checklist)

- **Backups and MySQL binlogs** hold pre-anonymization copies. Keep both on a rotation of 30 days
  or less (`binlog_expire_logs_seconds = 2592000`), or the purge is not real.
- **SMTP2GO** stays the email sender for department and status emails. It keeps only delivery
  stats (sent, delivered, bounced), no email content, so there is nothing to purge there.
- **Server logs**: tracking keys live in the URL fragment and never reach the server. Do not log
  request bodies of `/api/reports/submit`, `/api/push/*` or `/api/uploads/*`.
- **Push services** (Google, Apple, Mozilla) see delivery metadata, not payloads. Nothing to purge on our side.

## 6. Personal notifications (automatic, no approval)

Opt-in from the success screen after sending ("Notify me when the agency responds"), never on
page load. iOS needs the PWA added to the Home Screen first; outside standalone mode the page shows
install instructions. Subscribing requires the report's tracking key, so nobody can follow
someone else's report.

| Event | Source | Sent |
|---|---|---|
| Agency opened the report | first use of the department link → `reports.first_opened_at` | once |
| Status → In Progress | `setReportStatus()` | each change |
| Status → Resolved | `setReportStatus()`; deep link to "is it really fixed?" | each change |
| Grouped with an incident | incident merge/attach | once per grouping |
| No response in 14 days | nightly job, `first_opened_at IS NULL` | once |

Flow: `setReportStatus()` inserts `push_outbox` rows for the report's followers inside the status
transaction; right after commit `notifyFollowers()` sends them (web-push, `TTL` 7 days,
`Topic` = report so an offline phone shows only the latest status). An hourly job retries failures;
`404`/`410` deletes the subscription. Text is rendered on the server in the subscription's language
(sq, sr in Latin script, en). Payloads hold title, body, a relative path, a tag and the language.
Never the tracking key.

Followers stop receiving anything at anonymization, because their follow rows are deleted.

## 7. Public alerts (staff approval required)

Kinds: `systemic_failure`, `cluster`, `dashboard_update`, `digest`.

```
nightly job ─► proposeAlert() ─► pending_review ──owner approves──► approved ─► dispatchAlert() ─► sent
                                     │ ──owner rejects──► rejected
                                     └ ──72 h unreviewed──► expired
```

Triggers (proposals only, never sent directly):

- **Systemic failure**, per municipality × category over 30 days: ≥ 10 reports **and** response rate
  < 30% **and** ≥ 5 incidents without a first response for ≥ 14 days. Proposed again only after
  the numbers recover and drop again.
- **Cluster**: ≥ 5 separate listed/public incidents of one category within 500 m in 72 h.
- **Dashboard update / weekly digest**: per municipality, from `agency_metrics_daily`.

Guarantees:

1. `CHECK alert_needs_review`: `approved`, `rejected`, `dispatching`, `sent` and `failed` are
   impossible without `reviewed_by` and `reviewed_at`.
2. `dispatchAlert()` starts only by claiming `UPDATE … SET status='dispatching' WHERE status='approved'`.
3. `push_area_follows` is read only inside `dispatchAlert()`.
4. Only `owner` staff accounts approve (`requireOwner()`). Department staff with municipality links
   have no access.
5. `dedupe_key` blocks duplicates; every step is written to `public_alert_events`.

Staff panel `/admin/alerts`: the numbers when proposed vs today, the editable message in sq/sr/en,
time left before expiry, "Approve and send" / "Reject" with a note. Owners get an internal email
when an alert is waiting. Delivery respects quiet hours 22:00–08:00 (Europe/Belgrade) and at most
one public alert per follow per day.

## 8. Dashboard and map

Both read only hard metadata, so they keep working on anonymized reports forever.

- **`agency_metrics_daily`**: rebuilt every 10 minutes from `reports` + `report_audit_log`:
  volume, response rate (first status change from Pending within 14 days), median time to first
  response, median time to resolution, per department × municipality × category × day. Rates are
  hidden below 10 reports in the window. Served by `/api/metrics/[city]` with
  `Cache-Control: public, s-maxage=300, stale-while-revalidate=3600`. Public alerts quote this same table.
- **Transparency Map**: GeoJSON of `listed`/`public` incidents. `listed` pins go through
  `approximate()` snapped to a ~200 m grid, new incidents appear after a random 12–24 h delay,
  health and safety show municipality counts only. No R2 reads except staff-published photos.

## 9. Database: `sql/008_attachments_retention_alerts.sql`

```sql
-- Citizen attachments with 30-day retention after resolution, anonymization of resolved reports,
-- push subscriptions and public alerts that staff must approve. Repeatable; apply after 007.
--
-- Files live in R2 under evidence/ while their report is open and under expiring/ once it is
-- resolved. Thirty days after resolution the files are deleted and the report is anonymized:
-- only agency, municipality, category, coordinates, status and timestamps remain, forever.
SET NAMES utf8mb4;

SET @ddl = IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='reports' AND column_name='first_opened_at'), 'SELECT 1', 'ALTER TABLE reports ADD COLUMN first_opened_at DATETIME NULL, ADD COLUMN anonymized_at DATETIME NULL, ADD INDEX report_retention (status, resolved_at, anonymized_at)');
PREPARE retention_ddl FROM @ddl;
EXECUTE retention_ddl;
DEALLOCATE PREPARE retention_ddl;

CREATE TABLE IF NOT EXISTS attachments (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 report_id INT NULL,
 comment_id INT UNSIGNED NULL,
 report_image_id INT NULL,
 kind ENUM('photo','video','pdf') NOT NULL,
 mime_type VARCHAR(40) NOT NULL,
 byte_size INT UNSIGNED NOT NULL,
 duration_ms SMALLINT UNSIGNED NULL,
 sha256 CHAR(44) NULL,
 object_key VARCHAR(512) NULL,
 public_key VARCHAR(512) NULL,
 state ENUM('signed','active','expiring_pending','expiring','restoring','deleted') NOT NULL DEFAULT 'signed',
 sort_order TINYINT UNSIGNED NOT NULL DEFAULT 0,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 attached_at DATETIME NULL,
 expires_at DATETIME NULL,
 deleted_at DATETIME NULL,
 INDEX attachment_report (report_id),
 INDEX attachment_comment (comment_id),
 INDEX attachment_retention (state, expires_at),
 FOREIGN KEY(report_id) REFERENCES reports(id),
 FOREIGN KEY(comment_id) REFERENCES incident_comments(id),
 FOREIGN KEY(report_image_id) REFERENCES report_images(id),
 CONSTRAINT attachment_scrubbed CHECK (state<>'deleted' OR (object_key IS NULL AND public_key IS NULL AND sha256 IS NULL))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Endpoint and keys are sealed with AES-GCM under a key that lives only in the environment.
CREATE TABLE IF NOT EXISTS push_subscriptions (
 id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 endpoint_hash CHAR(64) NOT NULL UNIQUE,
 sealed VARBINARY(2048) NOT NULL,
 locale CHAR(2) NOT NULL,
 failures TINYINT UNSIGNED NOT NULL DEFAULT 0,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 last_sent_at DATETIME NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- A device following its own report. Deleted when the report is anonymized.
CREATE TABLE IF NOT EXISTS push_report_follows (
 subscription_id INT UNSIGNED NOT NULL,
 report_id INT NOT NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(subscription_id, report_id),
 INDEX follow_report (report_id),
 FOREIGN KEY(subscription_id) REFERENCES push_subscriptions(id) ON DELETE CASCADE,
 FOREIGN KEY(report_id) REFERENCES reports(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Public followers of a municipality ('' = every category). Only dispatchAlert() reads this.
CREATE TABLE IF NOT EXISTS push_area_follows (
 subscription_id INT UNSIGNED NOT NULL,
 city_id INT NOT NULL,
 category VARCHAR(100) NOT NULL DEFAULT '',
 PRIMARY KEY(subscription_id, city_id, category),
 INDEX follow_area (city_id, category),
 FOREIGN KEY(subscription_id) REFERENCES push_subscriptions(id) ON DELETE CASCADE,
 FOREIGN KEY(city_id) REFERENCES cities(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Every public alert starts as pending_review and is sent only after an owner approves it.
CREATE TABLE IF NOT EXISTS public_alerts (
 id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 kind ENUM('systemic_failure','cluster','dashboard_update','digest') NOT NULL,
 dedupe_key VARCHAR(120) NOT NULL UNIQUE,
 city_id INT NOT NULL,
 category VARCHAR(100) NOT NULL DEFAULT '',
 status ENUM('pending_review','approved','rejected','expired','dispatching','sent','failed') NOT NULL DEFAULT 'pending_review',
 evidence JSON NOT NULL,
 message JSON NOT NULL,
 link_path VARCHAR(200) NOT NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 review_by DATETIME NOT NULL,
 reviewed_by INT UNSIGNED NULL,
 reviewed_at DATETIME NULL,
 review_note VARCHAR(500) NOT NULL DEFAULT '',
 dispatched_at DATETIME NULL,
 recipients INT UNSIGNED NULL,
 INDEX alert_queue (status, created_at),
 FOREIGN KEY(city_id) REFERENCES cities(id),
 FOREIGN KEY(reviewed_by) REFERENCES staff_accounts(id),
 CONSTRAINT alert_needs_review CHECK (status IN ('pending_review','expired') OR (reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS public_alert_events (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 alert_id INT UNSIGNED NOT NULL,
 account_id INT UNSIGNED NULL,
 action VARCHAR(30) NOT NULL,
 detail VARCHAR(500) NOT NULL DEFAULT '',
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 INDEX alert_history (alert_id, created_at),
 FOREIGN KEY(alert_id) REFERENCES public_alerts(id) ON DELETE CASCADE,
 FOREIGN KEY(account_id) REFERENCES staff_accounts(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS push_outbox (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 subscription_id INT UNSIGNED NOT NULL,
 report_id INT NULL,
 public_alert_id INT UNSIGNED NULL,
 event_key VARCHAR(80) NOT NULL,
 payload JSON NOT NULL,
 topic VARCHAR(32) NOT NULL DEFAULT '',
 urgency ENUM('low','normal','high') NOT NULL DEFAULT 'normal',
 attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
 sent_at DATETIME NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE KEY one_per_event (subscription_id, event_key),
 INDEX outbox_queue (sent_at, attempts),
 FOREIGN KEY(subscription_id) REFERENCES push_subscriptions(id) ON DELETE CASCADE,
 FOREIGN KEY(report_id) REFERENCES reports(id) ON DELETE CASCADE,
 FOREIGN KEY(public_alert_id) REFERENCES public_alerts(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

`CHECK` needs MySQL 8.0.16 or later. Foreign keys on `CHECK` columns carry no `ON DELETE` action
because MySQL forbids it.

## 10. Core functions

### `src/lib/report-status.js`

```js
// The only way a report's status changes. Retention and personal notifications follow the
// status inside the same transaction; anonymized reports are final.
import { scheduleExpiry, cancelExpiry } from "./retention";
import { queueFollowerPush } from "./push";

export async function setReportStatus(connection, reportId, status) {
  const [[report]] = await connection.execute("SELECT status,anonymized_at FROM reports WHERE id=? FOR UPDATE", [reportId]);
  if (!report || report.anonymized_at) throw Object.assign(new Error("Report is closed and anonymized"), { status: 409 });
  if (report.status === status) return false;
  await connection.execute(
    "UPDATE reports SET status=?,resolved_at=CASE WHEN ?='Resolved' THEN COALESCE(resolved_at,UTC_TIMESTAMP()) ELSE NULL END WHERE id=?",
    [status, status, reportId],
  );
  if (status === "Resolved") await scheduleExpiry(connection, reportId);
  else await cancelExpiry(connection, reportId);
  await queueFollowerPush(connection, reportId, `status:${status}`);
  return true; // caller commits, then calls notifyFollowers(reportId)
}
```

### `src/lib/retention.js`: day 30

```js
// Thirty days after a report is resolved its files are deleted and the report is anonymized,
// in the same run. The R2 lifecycle rule on expiring/ deletes the files even if this job is down.
const DAYS = 30;

async function dueReports(db) {
  const [rows] = await db.execute(
    `SELECT id FROM reports
      WHERE status='Resolved' AND anonymized_at IS NULL AND resolved_at <= UTC_TIMESTAMP() - INTERVAL ${DAYS} DAY
      LIMIT 100`,
  );
  return rows.map((row) => row.id);
}

export async function expireReports() {
  const db = database();
  for (const reportId of await dueReports(db)) {
    await deleteReportObjects(db, reportId); // DeleteObject on every key in attachments and legacy image tables, both buckets
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      await anonymizeReport(connection, reportId);
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}

export async function anonymizeReport(connection, reportId) {
  const run = (sql) => connection.execute(sql, [reportId]);
  await run(
    "UPDATE reports SET reporter_email=NULL,description='',admin_note=NULL,tracking_key=UUID(),anonymized_at=UTC_TIMESTAMP() WHERE id=? AND anonymized_at IS NULL",
  );
  await run("UPDATE report_audit_log SET note='' WHERE report_id=?");
  await run("UPDATE report_reviews SET note='' WHERE report_id=?");
  await run("DELETE FROM report_notifications WHERE report_id=?");
  await run("DELETE FROM report_status_notifications WHERE report_id=?");
  await run("DELETE FROM municipality_report_tokens WHERE report_id=?");
  await run("DELETE FROM push_outbox WHERE report_id=?");
  await run("DELETE FROM push_report_follows WHERE report_id=?");
  await run(
    "UPDATE attachments SET state='deleted',object_key=NULL,public_key=NULL,sha256=NULL,deleted_at=UTC_TIMESTAMP() WHERE report_id=? AND state<>'deleted'",
  );
  // + the legacy report_images / report_image_storage keys and URLs for this report
  await connection.execute(
    `DELETE s FROM push_subscriptions s
      WHERE NOT EXISTS (SELECT 1 FROM push_report_follows f WHERE f.subscription_id=s.id)
        AND NOT EXISTS (SELECT 1 FROM push_area_follows a WHERE a.subscription_id=s.id)`,
  );
}
```

`runRetention()` (every 15 minutes) runs, in order: move `expiring_pending` to `expiring/`, move
`restoring` back to `evidence/`, `expireReports()`, expire comment photos of incidents resolved
30+ days ago, delete `signed` attachment rows older than 2 days.

### `src/lib/public-alerts.js`

`proposeAlert()` inserts `pending_review` (with `INSERT IGNORE` on `dedupe_key`). `reviewAlert(account, id, {approve, message, note})`
runs from a server action behind `requireOwner()`, updates only `WHERE status='pending_review' AND review_by > now`,
writes `public_alert_events`, and on approval calls `dispatchAlert(id)`. `dispatchAlert()` claims
`approved → dispatching` atomically, fans out to `push_area_follows` into `push_outbox`, and marks
the alert `sent` with the recipient count.

### `src/lib/video.js` and `src/lib/video-check.js`

On the device: Mediabunny `Conversion` with `trim` (5 s), 720 px short edge, `frameRate: 24`,
`codec: "avc"`, `bitrate: 1_200_000`, `audio: { discard: true }`, `tags: {}`, fast-start MP4,
reject if larger than 1.6 MB. On the server: Mediabunny `Input` over a 60-second presigned GET
(`UrlSource`, range requests only). Reject if there are audio tracks, if the duration is over 5.1 s,
or if the codec is not `avc`.

### `public/sw.js`

Add `push` (always shows a notification; path checked against `^/(sq|sr|en)/…`),
`notificationclick` (focuses an open tab or opens a new one, same origin only),
`pushsubscriptionchange` (re-subscribes and posts old + new to `/api/push/renew`), and `sync`
(`send-report` outbox on Chromium). Bump `VERSION`.

## 11. Environment

```
R2_EVIDENCE_BUCKET, R2_PUBLIC_BUCKET, R2_PUBLIC_BASE_URL
VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_SUBJECT=mailto:…
PUSH_SEAL_KEY            32 random bytes, base64; seals push endpoints at rest
```

New dependencies: `mediabunny`, `web-push`, `@aws-sdk/s3-request-presigner`, `pdf-lib`
(PDF metadata strip, loaded only when a PDF is chosen).

## 12. Rollout

1. Migration 008, `setReportStatus()` replacing the three direct updates, lifecycle rules on the new
   prefixes only, new evidence/public buckets.
2. Direct-to-R2 uploads for photos, then video and PDF with `verifyVideo()`.
3. `runRetention()` with day-30 deletion and anonymization. Backups/binlog rotation set to 30 days or less.
4. One-time backfill for reports resolved before this change: **dry run first** (lists what would be
   deleted and anonymized); the real run happens only after explicit approval, because it
   permanently deletes existing evidence and contact data.
5. Personal push notifications.
6. `agency_metrics_daily`, dashboard, map.
7. Public alerts with the `/admin/alerts` review page, then public area follows.

## 13. Out of scope, noted

- Citizen comments on incidents (`incident_comments.author_name`, `body`) are public, moderated content
  separate from reports. Their photos expire with the incident. The text is not covered by the
  report anonymization rule.
- Staff-written `incidents.public_summary` stays. Moderation guideline: no personal data in summaries.
