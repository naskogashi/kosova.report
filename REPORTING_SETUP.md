# kosova.report operator guide

## Deploy and activate this version
Push the saved changes to main to run the existing CloudPanel deployment. Then sign in to the server as kosova and run:

```bash
cd /home/kosova/htdocs/kosova.report
npm run setup:server -- --email admin@kosova.report
pm2 restart kosova-report --update-env
npm run migrate:images -- --apply
```

You can replace `admin@kosova.report` with your own administrator email before running the command. The setup command:

1. Loads existing server settings and, when necessary, the kosova-report PM2 environment without printing keys.
2. Privately prompts for the MySQL password if it has not been configured.
3. Runs mysqldump into a mode-600 file in `~/kosova-backups`; it refuses to migrate if the backup fails.
4. Applies repeatable migrations 004 and 005 to your existing integer-ID database.
5. Saves the existing runtime settings to `~/.config/kosova-report/runtime.json` (directory mode 700, file mode 600), outside the Git checkout. Next.js uses it only as a fallback to actual environment/dotenv values.
6. Creates the first owner account and prints a random **one-time password on the SSH terminal**. It is not committed, stored in plaintext, or printed by CI. It expires in 24 hours and permits one sign-in only.

Open `https://kosova.report/admin/login`, use that email and one-time password, and replace it at `/admin/account`. A first-login session expires in 30 minutes and cannot access reports before replacement. The account page lets you change name, email and password. Later changes require your current password and revoke other sessions.

The old `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH` and `ADMIN_SESSION_SECRET` variables are no longer required. The pre-existing `admins` table is preserved; this version uses new staff_accounts/staff_sessions tables and does not guess the old password format.

If an owner already exists, setup preserves it and does not print a replacement password. To recover an expired/consumed password from the server terminal, explicitly run:

```bash
npm run setup:server -- --email your-existing-owner-email --reset-owner
pm2 restart kosova-report --update-env
```

Use the owner's actual current email. Resetting revokes existing owner sessions. No public registration or universal default password exists.

## Existing MySQL schema
The database/user are both kosova. Core reports/cities/departments/report_images use signed integer IDs. Reports retain lat, lng, is_anonymous, reporter_email, and the exact statuses Pending / In Progress / Resolved. Countries retain their existing integer IDs, name and code fields. Existing reports, IDs, country records, department addresses and image rows are not replaced.

Do not run legacy draft migrations 001–003. Migration 004 adds routing, counters, image metadata, audits and login throttling. Migration 005 adds staff accounts, server-side sessions, report assignments/reviews, municipality configuration, public branding references and progress-notification records. Both migrations are run by setup; do not manually rerun historical migrations.

## Prishtina now; other cities and countries later
On first installation of migration 005, only the existing Prishtina/PR city is enabled. Its initial map center is 42.6629, 21.1655 at zoom 13. Other existing cities remain in the database but are not offered for public reporting. Re-running setup preserves later choices.

Under `/admin/settings`:

- Add or edit countries using their real names/codes.
- Add cities with a country, unique 2–10-character public-ID prefix, map center, zoom and explicit public-reporting enable checkbox.
- Add departments and configure each department's receiving email.
- Route each report category to a department belonging to the same city.

A city appears publicly only if it is enabled and has active matching category routes. No department mapping is guessed. City prefixes cannot change after reports exist. Existing report numbering continues from the maximum official ID for the city/year, guarded by an InnoDB row lock. Geographic selection is reporter-supplied; coordinates are validated as latitude/longitude, not against municipal boundary polygons. Additional enabled cities may be outside Kosovo.

## Report checkers and statistics
Only the owner can change settings, add countries/cities/departments, create or disable checkers, assign reports or change a report's municipal status. Checker creation prints a temporary password once in the owner's authenticated screen. The checker replaces it on first login; afterward the owner can assign reports from the inbox.

Checkers can read only currently assigned reports and their private photos, and record verification notes. They cannot inspect another checker's assignments, change municipal resolution status or manage platform settings. A repeated check updates the same checker/report review rather than inflating the distinct-report count. Disabling a checker or resetting their password revokes their sessions.

`/admin/stats` shows totals by status, average resolution time, departmental resolution counts/rates, daily report volume for the last 30 days and each checker's current assignments/distinct checks. A checker sees only their own scope. Reports retain an internal status audit history. Owner notes and checker notes are never included in citizen progress responses.

Sessions use 32-byte random cookies with only a SHA-256 digest stored in MySQL, HttpOnly/SameSite=Strict, Secure on public HTTPS, and an eight-hour normal lifetime. Login throttling has per-email and global windows. Mutations validate the configured origin in addition to Next.js server-action checks. Use HTTPS on the deployed domain.

## Cloudflare R2 and moving existing images
Account: c268c9a22ef16f948948c241da7a9592. Bucket: **kosova-report-images**.

The existing GitHub workflow forwards R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, SMTP2GO_API_KEY and SMTP_FROM repository secrets. It defaults the account/bucket to the values above. Existing server configuration is supported. R2 credentials need read/write/delete access to that bucket. The dashboard account ID is not an access credential.

The image command defaults to a read-only inventory:

```bash
npm run migrate:images
npm run migrate:images -- --apply
```

Apply mode uploads all six current branding images and legacy report_images entries without R2 metadata. It uses content-derived keys, verifies object size and hash metadata via R2 HEAD, and changes database references only after upload verification. It preserves original files/URLs in backups and does not delete source files. Already-mapped report images are skipped; failed sources can be retried. A nonzero exit identifies failures by asset/image ID without printing credentials or private image URLs.

All six branding assets are included locally, including the supplied CODON and Sbunker artwork. The public footer uses `/api/branding/:key`; it reads verified branding objects from private R2 and uses local files as a fallback before migration. Citizen evidence stays private behind authenticated `/api/admin/images/:id`, with assignment checks for checkers. R2 does not need public bucket access.

Legacy external report-image URLs are restricted to the app's HTTPS hostname and explicitly allowed image hosts; redirects are checked. If a legitimate old host is rejected, add its hostname to IMAGE_MIGRATION_ALLOWED_HOSTS in the operator's environment and rerun. Local paths must resolve inside public/. The per-image migration cap is 6 MiB. Current uploads allow ten JPEG/PNG/WebP files, 5 MiB each. Unrelated/private network URLs are not automatically imported.

Without R2_IMAGE_BASE_URL, stored image URLs use the private S3 endpoint. The admin API streams objects using their private keys. An existing custom image base remains optional. Runtime settings are never put in client-side bundles.

## SMTP2Go and private progress links
Set SMTP2GO_API_KEY and a verified SMTP_FROM sender at kosova.report. The app uses `https://api.smtp2go.com/v3/email/send` with X-Smtp2go-Api-Key; SMTP username/password variables are not used.

Initial department alerts include the official ID, description, OSM location, inline images and a private municipality action link. Citizens who supply email get a receipt/progress link; anonymous reports never receive citizen emails.

When the owner or municipality changes a report to In Progress / Resolved, notifications are queued for the receiving department and the citizen when an email exists. The municipality's link can acknowledge handling or mark that one report resolved without giving access to the admin panel, reporter email, or other reports. It cannot reopen a resolved issue. Municipal tokens are random, stored hashed, scoped to one report/department and expire after 90 days. Opening a link does not change status; the recipient must press an action button. Repeating the same status does not queue duplicate events.

Citizen links are read-only and use the existing private tracking credential. Both link types carry credentials in URL fragments, which are not sent in HTTP URLs/referrers. The browser removes the fragment after reading it and sends the credential as a Bearer header. Reopen the original email link if a page reload loses its in-memory credential. Keep these links private. Test your email provider's click-tracking configuration to ensure private URL fragments survive link rewriting.

`/track/:public_id` provides SQ/SR/EN progress and a PDF receipt. `/municipality/:public_id` provides SQ/SR/EN municipal actions. Status emails include HTML and plain-text links. Internal notes and reporter contact details are not shown on those progress pages.

SMTP2Go API acceptance is checked; acceptance is not proof of inbox delivery. Failed sends remain pending and are counted in admin. A scheduled retry worker is not included. A send followed by failure to save sent_at can cause duplicate mail. At most 30 MiB of original images are embedded to remain below the provider's 50 MB encoded-message limit; additional originals remain available to authorized staff. Live sending requires configured server credentials and sender verification.

## Public branding and pages
`/` is the SQ/SR/EN introduction and has no admin link. `/report` is the public reporting wizard. The footer preserves CIVICUS, Metamorphosis, TechSoup, Digital Activism Program and Sbunker in order, then shows the supplied CODON logo and the exact credit: "in co-operation with CODON a part of Progon LLC." The PDF and email text credits have also been updated. Donor artwork retains its owners' rights; Noto Sans licensing is included in public/fonts/OFL.txt.

OSM tiles retain attribution and an explicit referrer policy. If the domain/network remains blocked, configure both NEXT_PUBLIC_MAP_TILE_URL and NEXT_PUBLIC_MAP_ATTRIBUTION for an authorized provider and rebuild. No tile proxy or provider rotation bypasses OSM policies.

## Verification and remaining operational checks
Run `npm test` and `npm run build`. Tests isolate MySQL, R2 and SMTP2Go, exercising one-time credentials, role/assignment enforcement, progress-token scope, idempotent municipal updates, report numbering and email payloads. Production service credentials and the live server are not accessible from this workspace; actual R2 transfers, MySQL migration execution and inbox delivery must be verified using the operator commands above.

Keep Node 22 on port 3067 and Nginx client_max_body_size 52m with adequate timeouts. Original-image EXIF stripping/transcoding/scanning and persistent client idempotency across a lost submission response are not implemented.
# Public branding, install support and privacy controls

The public R2 custom domain is `https://images.kosova.report`. Connect that domain to the `kosova-report-images` bucket in Cloudflare. The deployment workflow supplies this as the default `R2_IMAGE_BASE_URL`; if a repository secret with that name exists, set it to the same URL. The R2 SDK continues using the account's S3 endpoint for authenticated uploads. Public branding uses the custom domain after migration. Existing report records are not rewritten by this change.

Only expose objects intended for public access through a public bucket/custom domain. The authenticated report-image endpoint does not make an underlying public R2 object private. For confidential evidence, use a separate private bucket or a Worker that enforces authorization before serving evidence; keep only logos in the public bucket.

The app links its manifest, supplies PNG and Apple icons, and registers a service worker in production. The worker caches only icons and the offline notice. It never caches report pages, admin pages, API responses, uploaded images, or map tiles. Reporting requires an internet connection. Install UI uses the browser's native prompt when available and otherwise explains browser-menu installation. Installed apps hide the install button.

The multilingual privacy notice explains the admin security cookie, local notice acknowledgement and external map requests. There are no analytics or advertising tags or optional tracking categories. The notice can be reopened from the footer. If optional tracking is added later, implement prior opt-in before loading it. This notice is not a substitute for the operator's complete privacy policy, retention rules and data protection obligations.
