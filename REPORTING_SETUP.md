# Architecture and deployment

## Runtime
Next.js App Router on the existing CloudPanel Node 22 service, port 3067. The public page renders a mobile-first reporting wizard. Language URLs use `?lang=sq`, `?lang=sr`, or `?lang=en` and preserve the current draft. React-Leaflet is loaded only in the browser. No changes to the verified GitHub Actions deployment workflow are required.

`POST /api/reports/submit` accepts multipart fields `city`, `category`, `description`, `latitude`, `longitude`, `anonymous`, `language`, optional `email`, and up to ten `images`. Images are limited to 5 MiB each, validated by MIME and magic bytes, uploaded under random R2 keys, and attached inline to the department email. A transaction locks the city/year counter, assigns the public ID, and writes the report, relational image URLs, and durable notification record. R2 uploads are removed if the database operation fails before commit. SMTP is attempted immediately after commit; email failure returns a successful receipt with `notification: pending` to avoid telling the citizen that a saved report failed.

`GET /api/reports/:public_id/pdf` requires `Authorization: Bearer <tracking_key>`. The success screen downloads the PDF through authenticated fetch without putting the private key into a URL or browser history. The receipt uses an embedded, open-license Noto Sans font, wraps long descriptions across pages, and omits reporter contact details. The tracking key is shown to the citizen once and retained only in the current page state; save it before closing the page.

## Database
For a fresh database, apply `sql/001_reports.sql` followed by `sql/002_report_images.sql` once, in order. If migration 001 has already been applied, apply only 002. Migration 002 preserves existing reports, renames `departments.email` to `notification_email`, adds database city codes, and adds `report_images`. It does not replace an unrelated existing schema; compare it with any server schema before applying.

Populate actual department assignments for each supported city/category. Categories are `infrastructure`, `environment`, `public_services`, `administration`, `health`, `education`, and `safety`. Department addresses are never hardcoded or seeded with fictitious data. A missing assignment returns 503 before upload. Seven initial municipalities are listed in `src/lib/report-options.js` and migration 002; extend both when adding municipalities. Location is reporter-selected and checked against a Kosovo-area bounding box, not municipal polygons.

## Configuration
Set the server-only variables listed in `.env.example`. `APP_URL` must match the public origin. `R2_IMAGE_BASE_URL` is the HTTPS base used for relational image URLs; it can point to an access-controlled image host. The R2 API endpoint is derived from `R2_ACCOUNT_ID`. Do not expose credentials through NEXT_PUBLIC_ variables. SMTP defaults to SMTP2Go's documented `mail.smtp2go.com` on port 587 with required STARTTLS; use a verified sender. The value `://smtp2go.com` is not a valid SMTP hostname.

Keep the R2 bucket private if reports contain personal evidence. An authenticated image gateway/admin viewer is outside these four endpoints. Inline emails deliberately transmit the uploaded evidence to the assigned institution. Up to 50 MiB of images becomes roughly 67 MiB after email encoding, so verify the SMTP account's message-size limit. Large rejected emails remain pending.

Configure Nginx with `client_max_body_size 52m`, sufficient proxy timeouts, and edge rate limiting on the public submission route. The API independently enforces a streaming 51 MiB body limit. Images are not transcoded, malware-scanned, or stripped of EXIF metadata.

Pending notifications are retained in `report_notifications`; a scheduled retry worker is not included. Such a worker must read `report_images`, retrieve private R2 objects, and rebuild CID attachments before sending. A send followed by a failed sent_at update can be delivered twice; the stable Message-ID supports duplicate identification. A lost HTTP response can lead to a repeat citizen submission; a persisted client idempotency token is not yet implemented.

## Branding assets
The exact funding disclaimer and developer credits are present, and the five partner positions follow the updated required order. Genuine CIVICUS, Metamorphosis, TechSoup and Digital Activism Program artwork is stored locally, sourced from the official DDI program site:
https://ddidigitalspark.org/

IdeoNgritja has been removed at the project owner's request. Sbunker is the final partner and uses the supplied official image URL: https://sbunker.org/wp-content/uploads/2023/11/sbunker22.png . Its image is loaded directly from Sbunker because Cloudflare blocked the local asset download; availability therefore depends on the remote host. Donor logos retain their owners' rights and are not covered by a software license. Noto Sans font licensing is included in `public/fonts/OFL.txt`.

## Verification
Run `node --experimental-vm-modules --test tests/reports.test.mjs` for backend behavior tests with isolated MySQL, R2 and SMTP mocks. Run `npm run build` for compilation and route generation. PDF layout was rendered and checked using a multipage Unicode fixture. Mobile browser checks cover category selection, details, map coordinates, review and language switching. Live MySQL/R2/SMTP delivery still needs a configured integration environment; no live service credentials were available for this work.
