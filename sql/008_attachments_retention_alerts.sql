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

-- Every citizen file sent with a report or comment. Photos are also listed in report_images
-- (report_image_id), so the staff gallery and public issue photos keep working unchanged.
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

-- When retention began. Reports resolved before then are only deleted and anonymized after the
-- one-time backfill is approved: npm run retention -- --backfill --approve
CREATE TABLE IF NOT EXISTS retention_settings (
 id TINYINT UNSIGNED PRIMARY KEY,
 started_at DATETIME NOT NULL,
 backfill_approved_at DATETIME NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
INSERT IGNORE INTO retention_settings (id,started_at) VALUES (1,UTC_TIMESTAMP());

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
 payload JSON NOT NULL,
 topic VARCHAR(32) NOT NULL DEFAULT '',
 urgency ENUM('low','normal','high') NOT NULL DEFAULT 'normal',
 attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
 sent_at DATETIME NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE KEY one_per_alert (public_alert_id, subscription_id),
 INDEX outbox_queue (sent_at, attempts),
 FOREIGN KEY(subscription_id) REFERENCES push_subscriptions(id) ON DELETE CASCADE,
 FOREIGN KEY(report_id) REFERENCES reports(id) ON DELETE CASCADE,
 FOREIGN KEY(public_alert_id) REFERENCES public_alerts(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
