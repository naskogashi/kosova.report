# Database migrations

For the existing production kosova database, run `npm run setup:server -- --email your-admin-email` on the server. It backs up first and applies the repeatable compatibility migrations **004**, **005** and **006** (news), then generates a one-time owner password.

Files 001–003 describe a superseded draft schema. Do not run them against production. Existing integer report IDs, core tables, statuses and the original admins table remain intact.

See REPORTING_SETUP.md for account recovery, image migration and deployment details.
