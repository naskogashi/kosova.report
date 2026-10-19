-- News: updates, articles and reports from the team. Repeatable; apply after 005.
-- Each post carries its own text per language. A language with an empty title
-- falls back to Albanian on the public site. Cover images live in R2.
CREATE TABLE IF NOT EXISTS news_posts (
 id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 slug VARCHAR(120) NOT NULL UNIQUE,
 kind ENUM('update','article','report') NOT NULL DEFAULT 'update',
 status ENUM('draft','published') NOT NULL DEFAULT 'draft',
 title_sq VARCHAR(200) NOT NULL DEFAULT '',
 title_sr VARCHAR(200) NOT NULL DEFAULT '',
 title_en VARCHAR(200) NOT NULL DEFAULT '',
 summary_sq VARCHAR(400) NOT NULL DEFAULT '',
 summary_sr VARCHAR(400) NOT NULL DEFAULT '',
 summary_en VARCHAR(400) NOT NULL DEFAULT '',
 body_sq MEDIUMTEXT NULL,
 body_sr MEDIUMTEXT NULL,
 body_en MEDIUMTEXT NULL,
 cover_key VARCHAR(512) NULL,
 cover_mime VARCHAR(40) NULL,
 cover_alt_sq VARCHAR(200) NOT NULL DEFAULT '',
 cover_alt_sr VARCHAR(200) NOT NULL DEFAULT '',
 cover_alt_en VARCHAR(200) NOT NULL DEFAULT '',
 author_id INT UNSIGNED NULL,
 published_at DATETIME NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 INDEX news_published (status, published_at),
 FOREIGN KEY(author_id) REFERENCES staff_accounts(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
