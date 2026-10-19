CREATE TABLE departments (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 city_code VARCHAR(2) NOT NULL,
 category VARCHAR(30) NOT NULL,
 email VARCHAR(254) NOT NULL,
 active BOOLEAN NOT NULL DEFAULT TRUE,
 UNIQUE KEY department_assignment (city_code, category)
) ENGINE=InnoDB;
CREATE TABLE report_counters (
 city_code VARCHAR(2) NOT NULL,
 report_year SMALLINT UNSIGNED NOT NULL,
 sequence_value BIGINT UNSIGNED NOT NULL DEFAULT 0,
 PRIMARY KEY (city_code, report_year)
) ENGINE=InnoDB;
CREATE TABLE reports (
 id CHAR(36) PRIMARY KEY,
 public_id VARCHAR(40) NOT NULL UNIQUE,
 tracking_key CHAR(36) NOT NULL UNIQUE,
 city_code VARCHAR(2) NOT NULL,
 category VARCHAR(30) NOT NULL,
 latitude DECIMAL(10,7) NOT NULL,
 longitude DECIMAL(10,7) NOT NULL,
 description TEXT NOT NULL,
 language CHAR(2) NOT NULL,
 anonymous BOOLEAN NOT NULL,
 contact_name VARCHAR(120),
 contact_email VARCHAR(254),
 contact_phone VARCHAR(40),
 department_id BIGINT UNSIGNED NOT NULL,
 images JSON NOT NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY (department_id) REFERENCES departments(id)
) ENGINE=InnoDB;
CREATE TABLE report_notifications (
 report_id CHAR(36) PRIMARY KEY,
 recipient VARCHAR(254) NOT NULL,
 subject VARCHAR(255) NOT NULL,
 html MEDIUMTEXT NOT NULL,
 attempts INT UNSIGNED NOT NULL DEFAULT 0,
 sent_at DATETIME NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY (report_id) REFERENCES reports(id)
) ENGINE=InnoDB;
