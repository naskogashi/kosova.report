-- Apply once after migrations 001 and 002.
ALTER TABLE reports
 ADD COLUMN status ENUM('submitted','in_review','resolved','escalated') NOT NULL DEFAULT 'submitted',
 ADD COLUMN admin_note TEXT NULL,
 ADD COLUMN updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 ADD INDEX report_status_created (status,created_at);
CREATE TABLE report_audit_log (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 report_id CHAR(36) NOT NULL,
 actor_email VARCHAR(254) NOT NULL,
 previous_status VARCHAR(20) NOT NULL,
 new_status VARCHAR(20) NOT NULL,
 note TEXT NOT NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY (report_id) REFERENCES reports(id),
 INDEX report_history (report_id,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE admin_login_limits (
 bucket CHAR(64) PRIMARY KEY,
 attempts INT UNSIGNED NOT NULL,
 window_started DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
