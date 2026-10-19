-- Compatibility migration for the existing kosova database (integer report IDs).
-- Repeatable: preserves core tables, status enum, IDs, credentials and report data.
SET NAMES utf8mb4;
SET @ddl = IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='reports' AND column_name='admin_note'), 'SELECT 1', 'ALTER TABLE reports ADD COLUMN admin_note TEXT NULL');
PREPARE compatibility_ddl FROM @ddl;
EXECUTE compatibility_ddl;
DEALLOCATE PREPARE compatibility_ddl;
CREATE TABLE IF NOT EXISTS report_counters (
 city_id INT NOT NULL,
 report_year SMALLINT UNSIGNED NOT NULL,
 sequence_value BIGINT UNSIGNED NOT NULL DEFAULT 0,
 PRIMARY KEY(city_id,report_year),
 FOREIGN KEY(city_id) REFERENCES cities(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS department_routes (
 city_id INT NOT NULL,
 category VARCHAR(100) NOT NULL,
 department_id INT NOT NULL,
 active BOOLEAN NOT NULL DEFAULT TRUE,
 PRIMARY KEY(city_id,category),
 FOREIGN KEY(city_id) REFERENCES cities(id),
 FOREIGN KEY(department_id) REFERENCES departments(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS report_image_storage (
 report_image_id INT NOT NULL PRIMARY KEY,
 object_key VARCHAR(512) NOT NULL,
 mime_type VARCHAR(40) NOT NULL,
 byte_size INT UNSIGNED NOT NULL,
 sort_order TINYINT UNSIGNED NOT NULL,
 FOREIGN KEY(report_image_id) REFERENCES report_images(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS report_notifications (
 report_id INT NOT NULL PRIMARY KEY,
 recipient VARCHAR(255) NOT NULL,
 subject VARCHAR(255) NOT NULL,
 html MEDIUMTEXT NOT NULL,
 attempts INT UNSIGNED NOT NULL DEFAULT 0,
 sent_at DATETIME NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(report_id) REFERENCES reports(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS report_audit_log (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 report_id INT NOT NULL,
 actor_email VARCHAR(254) NOT NULL,
 previous_status VARCHAR(20) NOT NULL,
 new_status VARCHAR(20) NOT NULL,
 note TEXT NOT NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(report_id) REFERENCES reports(id) ON DELETE CASCADE,
 INDEX report_history(report_id,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS admin_login_limits (
 bucket CHAR(64) PRIMARY KEY,
 attempts INT UNSIGNED NOT NULL,
 window_started DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
