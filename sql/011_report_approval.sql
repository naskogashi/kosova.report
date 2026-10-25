-- Staff approve each new report before its department is emailed, against spam and trolling.
-- Reports already in the database were emailed on arrival, so they count as approved; new ones
-- start as pending. Repeatable; apply after 010.
SET NAMES utf8mb4;
SET @ddl = IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='reports' AND column_name='review_state'), 'SELECT 1', 'ALTER TABLE reports ADD COLUMN review_state ENUM(''pending'',''approved'',''rejected'') NOT NULL DEFAULT ''approved'', ADD COLUMN reviewed_by INT UNSIGNED NULL, ADD COLUMN reviewed_at DATETIME NULL, ADD INDEX report_review (review_state, created_at)');
PREPARE approval_ddl FROM @ddl;
EXECUTE approval_ddl;
DEALLOCATE PREPARE approval_ddl;
ALTER TABLE reports ALTER COLUMN review_state SET DEFAULT 'pending';
