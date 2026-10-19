# Database migrations

For the existing production `kosova` database shown in the schema inspection,
back up first and run **004_existing_schema.sql only**. It is repeatable and
preserves your integer IDs, current statuses, core tables and existing data.

Files 001, 002 and 003 target a superseded draft schema. They are kept as
historical references and must not be run against this production database.

See REPORTING_SETUP.md for the exact commands, credentials and routing setup.
