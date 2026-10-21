-- Staff accounts an admin deleted: whose account it was, who deleted it and when. Names and
-- emails are copied so the log still reads right after both accounts are gone.
-- Repeatable; apply after 009.
SET NAMES utf8mb4;
CREATE TABLE IF NOT EXISTS account_deletions (
 id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 account_name VARCHAR(120) NOT NULL,
 account_email VARCHAR(254) NOT NULL,
 account_role VARCHAR(20) NOT NULL,
 deleted_by INT UNSIGNED NULL,
 deleted_by_name VARCHAR(120) NOT NULL,
 deleted_by_email VARCHAR(254) NOT NULL,
 deleted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 INDEX account_deletion_log (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
