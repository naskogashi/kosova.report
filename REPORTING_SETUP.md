# kosova.report deployment and configuration

## Existing production database
The application now targets the existing `kosova` schema supplied from the server:

- `reports.id`: signed INT AUTO_INCREMENT. Foreign keys use `city_id` and `department_id`.
- Coordinates: `lat`, `lng`. Reporter fields: `is_anonymous`, `reporter_email`.
- Existing status values remain `Pending`, `In Progress`, and `Resolved`.
- `cities`: integer ID, country_id, name, code. `departments`: integer ID, city_id, name, notification_email.
- `report_images`: integer ID, integer report_id, image_url. Existing image rows and URLs are preserved.

**Do not execute migrations 001, 002 or 003 against this database.** Those files document a superseded draft schema. The original 003 failed on its first ALTER statement, so it did not install the supporting admin tables.

Deploy the updated code and apply only `sql/004_existing_schema.sql`. It is repeatable: it conditionally adds `reports.admin_note` and creates missing supporting tables with integer foreign keys. It does not rename or drop core columns, change report statuses, reset IDs, modify countries, replace department emails, or change the existing `admins` table. A database with a different core schema needs its own compatibility review.

On the server:

```bash
cd /home/kosova/htdocs/kosova.report
umask 077
mysqldump -u kosova -p --single-transaction --no-tablespaces kosova > "$HOME/kosova-backup-$(date +%Y%m%d-%H%M%S).sql"
# Continue only after the backup succeeds.
mysql -u kosova -p kosova < sql/004_existing_schema.sql
pm2 restart kosova-report --update-env
```

Migration 004 adds city/year counters, category-to-department routing, private image metadata, durable notification records, login throttling and report audit history. Official numbering locks a city/year counter and checks the largest existing matching public ID before incrementing. It therefore continues old sequences even if the counter table is new.

## Required server environment
Store settings in the existing server environment or `.env.production.local` in the application directory. Do not commit secrets. `.env.example` lists all names. Existing PM2 environment variables take precedence over dotenv files; update a setting in the place it was originally defined.

```dotenv
APP_URL=https://kosova.report
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_USER=kosova
MYSQL_DATABASE=kosova
```

Set `MYSQL_PASSWORD` to the actual database password. Keep existing valid database configuration. Protect a server environment file with `chmod 600 .env.production.local`.

## Cloudflare R2
The selected account is `c268c9a22ef16f948948c241da7a9592`; the selected bucket is **kosova-report-images**. Set:

- `R2_ACCOUNT_ID=c268c9a22ef16f948948c241da7a9592`
- `R2_BUCKET=kosova-report-images` (also the code's default)
- `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY`: R2 S3 API credentials with object read/write/delete access scoped to that bucket.

The dashboard URL and account ID are not access credentials. Keep the bucket private. Report image URLs are recorded in the existing `report_images` table. With no `R2_IMAGE_BASE_URL`, these are private S3 object URLs, not anonymously readable public links. Random object keys/MIME/size metadata are stored separately in `report_image_storage`, preserving your existing image schema. Authorized staff view evidence through `/api/admin/images/:id`, which streams from R2 after checking the admin session.

`R2_IMAGE_BASE_URL` is optional for an existing custom image host. Legacy image rows without new metadata can be read only if their URL maps to the configured R2 base; unrelated external URLs are not fetched. No bucket public-access settings are changed.

## SMTP2Go API key
Email now uses SMTP2Go's HTTPS API, not SMTP username/password authentication. Set:

- `SMTP2GO_API_KEY`: the key from SMTP2Go Sending > API Keys, allowed to call `/email/send`.
- `SMTP_FROM`: the verified sender address; the environment example uses `reports@kosova.report`. Use it only if verified in your account.

The request goes to `https://api.smtp2go.com/v3/email/send` with `X-Smtp2go-Api-Key`. No API key is sent to the browser or stored in report data. The alert includes the public ID, description, OSM location and inline evidence. API acceptance is checked, including failed-recipient counts. Acceptance does not guarantee delivery to the recipient's inbox.

SMTP2Go limits API emails to 50 MB including encoding. Up to 30 MiB of original evidence is embedded inline, leaving space for base64 encoding and message content. If uploads exceed that budget, the email states how many photos are attached; all original images remain in R2 and are available in the admin panel. Uploads still allow ten images, 5 MiB each.

Reports, images and a notification record commit atomically in MySQL. If API sending fails, the report stays saved and the citizen receives a receipt with `notification: pending`. A retry worker is not included; pending alerts are visible in admin. Any future retry worker must rebuild attachments from private R2 objects. Duplicate alerts remain possible if API acceptance succeeds but updating `sent_at` fails; a stable Message-ID identifies the submission.

## Administrator setup
Open `/admin` after migration 004. The initial panel has one administrator configured through environment variables. It does **not** authenticate against or modify the pre-existing `admins` table because its columns and password format have not been supplied.

Set `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH`, and `ADMIN_SESSION_SECRET`. Generate the hash without putting the password into shell history:

```bash
cd /home/kosova/htdocs/kosova.report
read -rsp 'Admin password (at least 14 characters): ' admin_password; echo
printf '%s' "$admin_password" | node scripts/hash-admin-password.mjs
unset admin_password
openssl rand -hex 32
```

Use the generated hash for ADMIN_PASSWORD_HASH and the random hex output for ADMIN_SESSION_SECRET. In a Next.js dotenv file, escape each literal dollar sign in the hash with a backslash: `ADMIN_PASSWORD_HASH='scrypt\$salt\$hash'`, replacing salt/hash with the actual generated values. Shell-managed environment values have different quoting rules; do not add the backslashes to a raw PM2 environment value.

Restart `pm2 restart kosova-report --update-env` after setting credentials. Sessions last eight hours, use signed HttpOnly/SameSite=Strict cookies and require HTTPS outside localhost. Password-hash/secret rotation invalidates old sessions. A shared database-backed window allows five login attempts in 15 minutes. No default password is installed.

The panel shows actual database cities and departments, report status/history, private evidence, reporter emails and internal notes. Status updates maintain the existing `resolved_at` timestamp and audit the change. It offers the three existing status values; it does not add an Escalated status.

### Enable institutional routing
Under **Departments and routing**, verify or add the real department name/email, then add a category assignment to a department in the same municipality. No category-to-department relationship existed in the supplied schema, so migration 004 intentionally does not guess where a report should go. A department can handle several categories. Inactive routes are excluded from the public municipality list. Existing department rows are preserved.

Public choices come from `/api/report-options` using configured active routes. Categories are infrastructure, environment, public_services, administration, health, education and safety. The panel supports database city prefixes of 2–10 letters/digits. Prefixes are normalized to uppercase in public IDs. Location validation uses a Kosovo-area bounding box, not municipal polygons.

## Public pages and receipts
`/` is the SQ/SR/EN welcome page. `/report?lang=sq|sr|en` is the reporting wizard. Language switching preserves the current draft. Leaflet is loaded only in the browser. Submissions use `POST /api/reports/submit`.

`GET /api/reports/:public_id/pdf` requires `Authorization: Bearer <tracking_key>`. It uses the actual schema joins and aliases `lat/lng` to receipt coordinates. The endpoint accepts UUID credentials from new reports and 32–64-character URL-safe credentials from existing records. Contact details and tracking keys are omitted from the PDF. Save the private key before closing the success screen.

## Map tile access
OSM tiles use the canonical HTTPS endpoint, visible attribution and `referrerPolicy=strict-origin-when-cross-origin`. If OSM continues to block the deployed browser/domain, configure an authorized provider using both `NEXT_PUBLIC_MAP_TILE_URL` and `NEXT_PUBLIC_MAP_ATTRIBUTION`, then rebuild. Browser keys must be domain-restricted. No proxy or provider rotation bypasses OSM's usage policy. Coordinate inputs remain available when tiles fail.

## Hosting and checks
Keep Node 22 on port 3067. Nginx needs `client_max_body_size 52m` and adequate timeouts. Add edge rate limiting for public submissions. Images are checked by MIME/signature but are not transcoded, malware-scanned or stripped of EXIF metadata. Client idempotency across a lost response is not implemented.

Run `npm test` and `npm run build`. Tests isolate MySQL, R2 and SMTP2Go and cover integer insertion IDs, existing public-ID sequence recovery, authentication, audit writes and API-key/inline-image payloads. No live MySQL/R2/SMTP2Go credentials were available during implementation, so the migration and real delivery must be verified on the configured server after a backup.

## Branding
Partner order is CIVICUS, Metamorphosis Foundation, TechSoup, Digital Activism Program, Sbunker. IdeoNgritja was removed as requested. Four local logos came from https://ddidigitalspark.org/; Sbunker uses the supplied official image URL. Donor artwork retains its owners' rights. Noto Sans licensing is included in `public/fonts/OFL.txt`.


## GitHub secret forwarding
The deployment workflow now forwards these repository secrets over SSH using the action's `env`/`envs` mechanism, exports nonempty values before the build, and lets PM2 inherit them when starting Next.js:

- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `SMTP2GO_API_KEY`
- `SMTP_FROM` (for example, a verified sender at kosova.report)

`R2_ACCOUNT_ID` and `R2_BUCKET` may also be repository secrets; when absent, the workflow uses the selected account ID and `kosova-report-images`. `R2_IMAGE_BASE_URL` is optional. Empty optional secrets do not replace values loaded from existing server dotenv files. MySQL and admin credentials still use the existing server configuration; `SSH_PASSWORD` remains solely the SSH login password.

Secret values are passed as environment data, not embedded into the remote shell script. Do not enable shell tracing or print the remote environment. PM2 saves its runtime environment on the server for restarts. A deployment with missing GitHub API credentials can still use valid values in the server's environment files; it cannot invent keys that have never been configured.
