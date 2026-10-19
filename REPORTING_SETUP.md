# Architecture and deployment

## Runtime
Next.js App Router on the existing CloudPanel Node 22 service, port 3067. The public `/` page renders a multilingual introduction; `/report` renders the mobile-first reporting wizard. Language URLs use `?lang=sq`, `?lang=sr`, or `?lang=en` and preserve the current draft. React-Leaflet is loaded only in the browser. No changes to the verified GitHub Actions deployment workflow are required.

`POST /api/reports/submit` accepts multipart fields `city`, `category`, `description`, `latitude`, `longitude`, `anonymous`, `language`, optional `email`, and up to ten `images`. Images are limited to 5 MiB each, validated by MIME and magic bytes, uploaded under random R2 keys, and attached inline to the department email. A transaction locks the city/year counter, assigns the public ID, and writes the report, relational image URLs, and durable notification record. R2 uploads are removed if the database operation fails before commit. SMTP is attempted immediately after commit; email failure returns a successful receipt with `notification: pending` to avoid telling the citizen that a saved report failed.

`GET /api/reports/:public_id/pdf` requires `Authorization: Bearer <tracking_key>`. The success screen downloads the PDF through authenticated fetch without putting the private key into a URL or browser history. The receipt uses an embedded, open-license Noto Sans font, wraps long descriptions across pages, and omits reporter contact details. The tracking key is shown to the citizen once and retained only in the current page state; save it before closing the page.

## Database
For a fresh database, apply `sql/001_reports.sql`, `sql/002_report_images.sql`, then `sql/003_admin.sql` once, in order. If migrations 001/002 have already been applied, apply only 003. Migration 002 preserves existing reports, renames `departments.email` to `notification_email`, adds database city codes, and adds `report_images`. It does not replace an unrelated existing schema; compare it with any server schema before applying.

Populate actual department assignments for each supported city/category. Categories are `infrastructure`, `environment`, `public_services`, `administration`, `health`, `education`, and `safety`. Department addresses are never hardcoded or seeded with fictitious data. A missing assignment returns 503 before upload. Seven initial municipalities are listed in `src/lib/report-options.js` and migration 002; extend both when adding municipalities. Location is reporter-selected and checked against a Kosovo-area bounding box, not municipal polygons.

## Configuration
Set the server-only variables listed in `.env.example`. `APP_URL` must match the public origin. `R2_IMAGE_BASE_URL` is the HTTPS base used for relational image URLs; it can point to an access-controlled image host. The R2 API endpoint is derived from `R2_ACCOUNT_ID`. Do not expose credentials through NEXT_PUBLIC_ variables. SMTP defaults to SMTP2Go's documented `mail.smtp2go.com` on port 587 with required STARTTLS; use a verified sender. The value `://smtp2go.com` is not a valid SMTP hostname.

Keep the R2 bucket private if reports contain personal evidence. Authenticated staff view images through `/api/admin/images/:id`; that endpoint checks the admin session and streams private objects from R2. Inline emails deliberately transmit the uploaded evidence to the assigned institution. Up to 50 MiB of images becomes roughly 67 MiB after email encoding, so verify the SMTP account's message-size limit. Large rejected emails remain pending.

Configure Nginx with `client_max_body_size 52m`, sufficient proxy timeouts, and edge rate limiting on the public submission route. The API independently enforces a streaming 51 MiB body limit. Images are not transcoded, malware-scanned, or stripped of EXIF metadata.

Pending notifications are retained in `report_notifications`; a scheduled retry worker is not included. Such a worker must read `report_images`, retrieve private R2 objects, and rebuild CID attachments before sending. A send followed by a failed sent_at update can be delivered twice; the stable Message-ID supports duplicate identification. A lost HTTP response can lead to a repeat citizen submission; a persisted client idempotency token is not yet implemented.

## Branding assets
The exact funding disclaimer and developer credits are present, and the five partner positions follow the updated required order. Genuine CIVICUS, Metamorphosis, TechSoup and Digital Activism Program artwork is stored locally, sourced from the official DDI program site:
https://ddidigitalspark.org/

IdeoNgritja has been removed at the project owner's request. Sbunker is the final partner and uses the supplied official image URL: https://sbunker.org/wp-content/uploads/2023/11/sbunker22.png . Its image is loaded directly from Sbunker because Cloudflare blocked the local asset download; availability therefore depends on the remote host. Donor logos retain their owners' rights and are not covered by a software license. Noto Sans font licensing is included in `public/fonts/OFL.txt`.

## Verification
Run `npm test` for 14 behavior tests covering reporting, isolated MySQL/R2/SMTP failures, admin password verification, signed session expiration/rotation, login throttling, origin/auth checks and atomic status auditing. Run `npm run build` for compilation and route generation. PDF layout was rendered and checked using a multipage Unicode fixture. Mobile browser checks cover category selection, details, map coordinates, review and language switching. Live MySQL/R2/SMTP delivery still needs a configured integration environment; no live service credentials were available for this work.


## Admin panel setup
The panel is available at `/admin` and redirects to `/admin/login` until authenticated. It provides a paginated report inbox, public-ID/description search, status filtering, private evidence photos, internal notes, status audit history and department notification routing. The administrator interface is in English; public introduction and reporting screens support SQ, SR and EN. This initial panel has one configured administrator, not multi-user roles.

1. Apply migration `sql/003_admin.sql` after 001/002. Do not rerun earlier migrations on an existing database.
2. Set `ADMIN_EMAIL` to the staff login address.
3. Generate a password hash on the server without putting the password into shell history:

```bash
cd /home/kosova/htdocs/kosova.report
read -rsp 'Admin password (at least 14 characters): ' admin_password; echo
printf '%s' "$admin_password" | node scripts/hash-admin-password.mjs
unset admin_password
```

Put the resulting `scrypt$...` value into `.env.production.local` as a single-quoted value for `ADMIN_PASSWORD_HASH`. Next.js expands dollar references in env files, so escape each literal dollar sign with a backslash. The stored line must have this shape: `ADMIN_PASSWORD_HASH='scrypt\$salt\$hash'`, using the actual generated salt/hash. Never put the plaintext password in the file or commit credentials.

4. Generate `ADMIN_SESSION_SECRET` with `openssl rand -hex 32` and save it in the same server-only environment file. Set `APP_URL=https://kosova.report` (or the exact deployed public origin). Protect the file with `chmod 600 .env.production.local`.
5. Build/restart the existing service (`pm2 restart kosova-report --update-env`) and visit `https://kosova.report/admin`.

Sessions expire after eight hours and use signed, HttpOnly, SameSite=Strict cookies; HTTPS deployments set Secure. Rotating the password hash or session secret invalidates existing cookies. Sign-out removes the browser cookie; individual stolen tokens cannot be revoked without rotation. Every login attempt consumes one of five attempts in a shared 15-minute database-backed window. A single global admin bucket protects the configured account without trusting spoofable proxy headers. Origin validation and Next.js server action protections apply to changes. No default account or password is installed. Configure HTTPS before signing in publicly.

The admin session authorizes reading citizen evidence and contact emails. Treat the administrative mailbox/password as privileged credentials. Status changes are stored in the audit log; this release does not send status-change emails to citizens. Pending SMTP notifications remain visible but are not automatically retried.

## Map tile access
The screenshot's 403 is an OSM tile-service block, not a failure to record coordinates. Tiles now use the canonical HTTPS endpoint and explicitly set `referrerPolicy=strict-origin-when-cross-origin`, identifying the real application origin. Attribution remains visible, and no proxy or automatic provider rotation bypasses the service's policy. See https://operations.osmfoundation.org/policies/tiles/ . This fixes referrer-stripping caused by the page policy but cannot override a provider block on a domain, browser or network.

If tiles remain blocked in the deployed browser, inspect a tile request's Referer header and configure a provider whose plan authorizes the app's traffic. Set both `NEXT_PUBLIC_MAP_TILE_URL` (an HTTPS XYZ template containing `{z}`, `{x}`, `{y}`) and `NEXT_PUBLIC_MAP_ATTRIBUTION` (the provider's required attribution), then rebuild. Any key in this public URL must be designed for browser use and restricted to the site's domains. The UI reports tile errors in the chosen language and keeps coordinate inputs usable. No bulk downloads or prefetching are added.
