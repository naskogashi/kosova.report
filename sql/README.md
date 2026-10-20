# Database migrations

For the existing production kosova database, run `npm run setup:server -- --email your-admin-email` on the server. It backs up first and applies the repeatable compatibility migrations **004**, **005**, **006** (news) and **007** (public issues), then generates a one-time owner password. On a server that is already set up, `npm run migrate` backs up and applies them without touching accounts.

**007** groups reports into public issues (incidents) with thumbs-up and staff-moderated comments. It gives every existing report its own *hidden* issue, so nothing sent before it becomes public until staff publish it. New reports start as *listed*: category, approximate area, dates and counts only.

Files 001–003 describe a superseded draft schema. Do not run them against production. Existing integer report IDs, core tables, statuses and the original admins table remain intact.

See REPORTING_SETUP.md for account recovery, image migration and deployment details.
