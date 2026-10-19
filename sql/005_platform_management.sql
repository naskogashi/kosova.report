-- Apply after 004_existing_schema.sql. Existing core tables and admins remain intact.
CREATE TABLE IF NOT EXISTS staff_accounts (
 id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 email VARCHAR(254) NOT NULL UNIQUE,
 name VARCHAR(120) NOT NULL,
 role ENUM('owner','checker') NOT NULL,
 password_hash VARCHAR(200) NOT NULL,
 active BOOLEAN NOT NULL DEFAULT TRUE,
 must_change_password BOOLEAN NOT NULL DEFAULT TRUE,
 temporary_expires_at DATETIME NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS staff_sessions (
 token_hash CHAR(64) PRIMARY KEY,
 account_id INT UNSIGNED NOT NULL,
 expires_at DATETIME NOT NULL,
 FOREIGN KEY(account_id) REFERENCES staff_accounts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS report_assignments (
 report_id INT PRIMARY KEY,
 account_id INT UNSIGNED NOT NULL,
 assigned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(report_id) REFERENCES reports(id) ON DELETE CASCADE,
 FOREIGN KEY(account_id) REFERENCES staff_accounts(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS report_reviews (
 report_id INT NOT NULL,
 account_id INT UNSIGNED NOT NULL,
 note TEXT NOT NULL,
 checked_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(report_id,account_id),
 FOREIGN KEY(report_id) REFERENCES reports(id) ON DELETE CASCADE,
 FOREIGN KEY(account_id) REFERENCES staff_accounts(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS municipality_settings (
 city_id INT PRIMARY KEY,
 enabled BOOLEAN NOT NULL DEFAULT FALSE,
 latitude DECIMAL(10,7) NOT NULL,
 longitude DECIMAL(11,7) NOT NULL,
 zoom_level TINYINT UNSIGNED NOT NULL DEFAULT 13,
 FOREIGN KEY(city_id) REFERENCES cities(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
INSERT IGNORE INTO municipality_settings (city_id,enabled,latitude,longitude,zoom_level)
 SELECT id,IF(id=(SELECT selected.id FROM (SELECT MIN(id) AS id FROM cities WHERE UPPER(code)='PR' OR LOWER(name) IN ('prishtina','prishtinë','prishtine','pristina','priština')) selected),1,0),42.6629,21.1655,13 FROM cities;
CREATE TABLE IF NOT EXISTS municipality_report_tokens (
 token_hash CHAR(64) PRIMARY KEY,
 report_id INT NOT NULL,
 department_id INT NOT NULL,
 expires_at DATETIME NOT NULL,
 FOREIGN KEY(report_id) REFERENCES reports(id) ON DELETE CASCADE,
 FOREIGN KEY(department_id) REFERENCES departments(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS report_status_notifications (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 event_key VARCHAR(80) NOT NULL,
 audience ENUM('department','reporter') NOT NULL,
 report_id INT NOT NULL,
 recipient VARCHAR(254) NOT NULL,
 subject VARCHAR(255) NOT NULL,
 html MEDIUMTEXT NOT NULL,
 text_body TEXT NOT NULL,
 attempts INT UNSIGNED NOT NULL DEFAULT 0,
 sent_at DATETIME NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE KEY event_audience(event_key,audience),
 FOREIGN KEY(report_id) REFERENCES reports(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS branding_assets (
 asset_key VARCHAR(40) PRIMARY KEY,
 object_key VARCHAR(512) NOT NULL,
 mime_type VARCHAR(40) NOT NULL,
 updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
