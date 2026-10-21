-- Reports deleted by staff. The report and everything linked to it are removed and its files are
-- deleted from R2, so it no longer counts anywhere; this log keeps which report it was, who
-- deleted it and when. Names are copied so the log still reads right if the account is removed.
-- Repeatable; apply after 008.
SET NAMES utf8mb4;
CREATE TABLE IF NOT EXISTS report_deletions (
 id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 public_id VARCHAR(40) NOT NULL,
 category VARCHAR(100) NOT NULL,
 city_id INT NULL,
 reported_at DATETIME NULL,
 deleted_by INT UNSIGNED NULL,
 deleted_by_name VARCHAR(120) NOT NULL,
 deleted_by_email VARCHAR(254) NOT NULL,
 deleted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 INDEX deletion_log (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
