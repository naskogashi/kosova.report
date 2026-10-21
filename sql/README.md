# Database migrations

For the existing production kosova database, run `npm run setup:server -- --email your-admin-email` on the server. It backs up first and applies the repeatable compatibility migrations **004**, **005**, **006** (news), **007** (public issues) and **008** (attachments and retention), then generates a one-time owner password. On a server that is already set up, `npm run migrate` backs up and applies them without touching accounts.

**007** groups reports into public issues (incidents) with thumbs-up and staff-moderated comments. It gives every existing report its own *hidden* issue, so nothing sent before it becomes public until staff publish it. New reports start as *listed*: category, approximate area, dates and counts only.

**008** adds the tables for citizen attachments with 30-day retention after a report is resolved, anonymization of resolved reports (`reports.anonymized_at`, `reports.first_opened_at`), push subscriptions and staff-approved public alerts. Its `CHECK` constraints are enforced from MySQL 8.0.16; older versions accept but ignore them, and the application enforces the same rules. See `docs/architecture/evidence-retention-push-alerts.md`.

**009** adds `report_deletions`, the log of reports an owner deleted: report number, category, municipality, who deleted it and when.

**010** adds `account_deletions`, the log of staff accounts an admin deleted: whose account, its role, who deleted it and when.

Files 001–003 describe a superseded draft schema. Do not run them against production. Existing integer report IDs, core tables, statuses and the original admins table remain intact.

See REPORTING_SETUP.md for account recovery, image migration and deployment details.
