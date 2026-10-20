-- Incidents: one public "issue" that groups every report of the same problem,
-- with thumbs-up confirmations and staff-moderated comments. Repeatable; apply after 006.
--
-- Every report belongs to exactly one incident. A new report starts its own incident
-- unless the reporter chose an existing one in the report flow. Nothing is merged
-- automatically: the system only suggests possible duplicates, and staff decide.
--
-- Public visibility:
--   hidden  nothing public (all reports from before this migration, or hidden by staff)
--   listed  category, approximate pin, date, status and counts only (default for new reports)
--   public  also the staff-written summary, exact pin and staff-chosen photos
SET NAMES utf8mb4;
CREATE TABLE IF NOT EXISTS incidents (
 id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 ref CHAR(10) NOT NULL UNIQUE,
 city_id INT NOT NULL,
 category VARCHAR(100) NOT NULL,
 lat DECIMAL(10,7) NOT NULL,
 lng DECIMAL(11,7) NOT NULL,
 status VARCHAR(20) NOT NULL DEFAULT 'Pending',
 visibility ENUM('hidden','listed','public') NOT NULL DEFAULT 'listed',
 public_summary VARCHAR(600) NOT NULL DEFAULT '',
 report_count INT UNSIGNED NOT NULL DEFAULT 0,
 upvote_count INT UNSIGNED NOT NULL DEFAULT 0,
 comment_count INT UNSIGNED NOT NULL DEFAULT 0,
 merged_into INT UNSIGNED NULL,
 seed_report_id INT NULL UNIQUE,
 first_reported_at DATETIME NOT NULL,
 last_reported_at DATETIME NOT NULL,
 resolved_at DATETIME NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 INDEX incident_nearby (city_id, lat, lng),
 FOREIGN KEY(city_id) REFERENCES cities(id),
 FOREIGN KEY(merged_into) REFERENCES incidents(id),
 FOREIGN KEY(seed_report_id) REFERENCES reports(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET @ddl = IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='reports' AND column_name='incident_id'), 'SELECT 1', 'ALTER TABLE reports ADD COLUMN incident_id INT UNSIGNED NULL, ADD COLUMN incident_link ENUM(''new'',''reporter'',''staff'') NOT NULL DEFAULT ''new'', ADD INDEX report_incident (incident_id), ADD CONSTRAINT report_incident_fk FOREIGN KEY (incident_id) REFERENCES incidents(id)');
PREPARE incident_ddl FROM @ddl;
EXECUTE incident_ddl;
DEALLOCATE PREPARE incident_ddl;

-- Reports sent before this feature were private. Each gets its own hidden incident;
-- staff can publish one later from the report page.
INSERT INTO incidents (ref,city_id,category,lat,lng,status,visibility,report_count,seed_report_id,first_reported_at,last_reported_at,resolved_at)
 SELECT SUBSTRING(SHA2(CONCAT(UUID(),RAND(),r.id),256),1,10),r.city_id,r.category,r.lat,r.lng,r.status,'hidden',1,r.id,r.created_at,r.created_at,r.resolved_at
 FROM reports r WHERE r.incident_id IS NULL AND r.city_id IS NOT NULL AND r.lat IS NOT NULL AND r.lng IS NOT NULL AND NOT EXISTS(SELECT 1 FROM incidents i WHERE i.seed_report_id=r.id);
UPDATE reports r JOIN incidents i ON i.seed_report_id=r.id SET r.incident_id=i.id WHERE r.incident_id IS NULL;

-- One thumbs-up per browser. voter_hash is a hash of a random cookie, never an IP or account.
CREATE TABLE IF NOT EXISTS incident_votes (
 incident_id INT UNSIGNED NOT NULL,
 voter_hash CHAR(64) NOT NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(incident_id,voter_hash),
 FOREIGN KEY(incident_id) REFERENCES incidents(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Citizen comments wait for staff approval. Staff updates are published at once.
CREATE TABLE IF NOT EXISTS incident_comments (
 id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 incident_id INT UNSIGNED NOT NULL,
 author_kind ENUM('citizen','staff') NOT NULL DEFAULT 'citizen',
 author_name VARCHAR(60) NOT NULL DEFAULT '',
 staff_account_id INT UNSIGNED NULL,
 body TEXT NOT NULL,
 language CHAR(2) NOT NULL,
 status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
 voter_hash CHAR(64) NULL,
 reviewed_by INT UNSIGNED NULL,
 reviewed_at DATETIME NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 INDEX incident_thread (incident_id,status,created_at),
 INDEX moderation_queue (status,created_at),
 FOREIGN KEY(incident_id) REFERENCES incidents(id) ON DELETE CASCADE,
 FOREIGN KEY(staff_account_id) REFERENCES staff_accounts(id) ON DELETE SET NULL,
 FOREIGN KEY(reviewed_by) REFERENCES staff_accounts(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Comment photos, stored in R2 like report photos.
CREATE TABLE IF NOT EXISTS incident_comment_images (
 id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 comment_id INT UNSIGNED NOT NULL,
 object_key VARCHAR(512) NOT NULL,
 mime_type VARCHAR(40) NOT NULL,
 byte_size INT UNSIGNED NOT NULL,
 sort_order TINYINT UNSIGNED NOT NULL,
 FOREIGN KEY(comment_id) REFERENCES incident_comments(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Report photos staff chose to show on a public incident page.
CREATE TABLE IF NOT EXISTS incident_public_images (
 incident_id INT UNSIGNED NOT NULL,
 report_image_id INT NOT NULL,
 PRIMARY KEY(incident_id,report_image_id),
 FOREIGN KEY(incident_id) REFERENCES incidents(id) ON DELETE CASCADE,
 FOREIGN KEY(report_image_id) REFERENCES report_images(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Possible duplicates for staff to review. A "distinct" decision is remembered,
-- so two different problems side by side are never suggested again.
CREATE TABLE IF NOT EXISTS incident_duplicate_candidates (
 incident_id INT UNSIGNED NOT NULL,
 candidate_id INT UNSIGNED NOT NULL,
 distance_m INT UNSIGNED NOT NULL,
 score DECIMAL(4,3) NOT NULL,
 source ENUM('system','reporter_declined') NOT NULL DEFAULT 'system',
 decision ENUM('open','merged','distinct') NOT NULL DEFAULT 'open',
 decided_by INT UNSIGNED NULL,
 decided_at DATETIME NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(incident_id,candidate_id),
 INDEX open_candidates (decision,created_at),
 FOREIGN KEY(incident_id) REFERENCES incidents(id) ON DELETE CASCADE,
 FOREIGN KEY(candidate_id) REFERENCES incidents(id) ON DELETE CASCADE,
 FOREIGN KEY(decided_by) REFERENCES staff_accounts(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Merges, splits and publication changes, so every grouping decision can be traced and undone.
CREATE TABLE IF NOT EXISTS incident_events (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 incident_id INT UNSIGNED NOT NULL,
 actor_email VARCHAR(254) NOT NULL,
 action VARCHAR(30) NOT NULL,
 detail VARCHAR(500) NOT NULL DEFAULT '',
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 INDEX incident_history (incident_id,created_at),
 FOREIGN KEY(incident_id) REFERENCES incidents(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Rate limits for anonymous public actions (thumbs-up, comments). Buckets are hashes.
CREATE TABLE IF NOT EXISTS public_rate_limits (
 bucket CHAR(64) PRIMARY KEY,
 attempts INT UNSIGNED NOT NULL,
 window_started DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
