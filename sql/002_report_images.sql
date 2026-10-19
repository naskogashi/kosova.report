-- Apply after 001_reports.sql. Existing report rows and image keys are preserved.
CREATE TABLE cities (
 code VARCHAR(2) PRIMARY KEY,
 name VARCHAR(120) NOT NULL,
 active BOOLEAN NOT NULL DEFAULT TRUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
INSERT INTO cities (code,name) VALUES ('PR','Prishtinë'),('PZ','Prizren'),('PE','Pejë'),('GJ','Gjakovë'),('FE','Ferizaj'),('GL','Gjilan'),('MI','Mitrovicë');
ALTER TABLE departments CHANGE COLUMN email notification_email VARCHAR(254) NOT NULL;
CREATE TABLE report_images (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 report_id CHAR(36) NOT NULL,
 object_key VARCHAR(512) NOT NULL,
 image_url VARCHAR(2048) NOT NULL,
 mime_type VARCHAR(40) NOT NULL,
 byte_size INT UNSIGNED NOT NULL,
 sort_order TINYINT UNSIGNED NOT NULL,
 FOREIGN KEY (report_id) REFERENCES reports(id),
 UNIQUE KEY report_image_order (report_id,sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
-- The legacy reports.images JSON remains for compatibility. New submissions
-- also populate report_images atomically. Existing uploads need a separate
-- backfill if they should appear in administrative image listings.
