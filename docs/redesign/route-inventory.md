# Route inventory — kosova.report

Snapshot of `main` at `5c2f22b`, taken 2026-10-19. Every row gets ticked when its redesigned version ships.
Legend: ☐ not started · ◐ in progress · ☑ redesigned and verified.

## Current stack

| Area | What is there today | Note for the redesign |
| --- | --- | --- |
| Framework | Next.js **14.2.35**, App Router, plain JS (no TypeScript), React **18.2** | React `<ViewTransition>` needs React 19 / Next 15.2+. `proxy.ts` is Next 16. **Upgrade decision needed.** |
| Styling | Tailwind **3.4**, empty `tailwind.config.js`, default palette (`slate`, `blue`, `emerald`, `amber`, `red`) used everywhere, plus ~100 lines of hand CSS in `globals.css` | Move to Tailwind v4 with `@theme` and the default palette removed. |
| Icons | `lucide-react` 0.300, used as the visual identity (category icons are `Construction`, `Leaf`, `Droplets`…) | Replace with custom category icons. Lucide may stay for utility icons, restyled. |
| Map | `leaflet` 1.9 + `react-leaflet` 4, OSM tile server by default, `NEXT_PUBLIC_MAP_TILE_URL` override, loaded with `next/dynamic` (`ssr:false`) | Keep Leaflet. Tile host is a third party (privacy note already says so). |
| PDF | `jspdf` 4, server-side, `public/fonts/NotoSans-Regular.ttf` (one weight) | jsPDF needs static TTFs; we will ship static instances of the new faces for it. |
| i18n | None. Every component carries its own `copy`/`translations` object. Language comes from `?lang=` and is broadcast by mutating `document.documentElement.lang` (`src/components/useLanguage.js`). Root layout hard-codes `lang="sq"`. Admin: sq/en via `kr-admin-language` cookie and a string-keyed dictionary (`src/lib/admin-translations.js`). | Move to `next-intl` with `app/[locale]`. Admin stays cookie-based (not indexed). |
| Rendering | `/` and `/report` are fully `"use client"`. Server HTML is always Albanian; other languages exist only after hydration. | Public pages become Server Components. |
| PWA | `public/manifest.json` (2 non-maskable icons, no shortcuts, no screenshots). Hand-written `public/sw.js` caches install assets only, navigations fall back to `public/offline.html`. `next-pwa` is installed but unused. | `app/manifest.ts`, Serwist or the existing SW extended for drafts/queue. Remove `next-pwa`. |
| Shared layout | `src/app/layout.js` → `<main>` + `Footer` + `AppControls` (cookie dialog + install button bar, rendered *below* the footer). Each page draws its own header; there are three different header/language-switcher implementations. | One global shell. |
| Backend | MySQL (`mysql2`), Cloudflare R2 for photos, SMTP2Go for email. | Untouched. |
| Deploy | Push to `main` deploys to production via `.github/workflows/deploy.yml`. | All redesign work stays on `redesign/*` branches. |

## Public routes

| ☐ | Route | File | What it does | States found in code | States the brief adds |
| --- | --- | --- | --- | --- | --- |
| ☐ | `/` | `src/app/page.js` | Landing | sq/sr/en via `?lang=`; "how it works" rendered **twice** (hero card + `#how` grid) | Map draw-in, categories index, after-submit timeline, supporters block, install CTA |
| ☐ | `/report` | `src/app/report/page.js` | 3-step flow + success, all in one client component | **Options:** loading (no visible state), error (reuses the "category not configured" text). **Step 1 category:** none chosen (Continue disabled), chosen. **Step 2 details:** municipality select (auto-selected if only one city; auto-selected on pin drop if within 50 km), category not routed in this city, description 10–5000 chars with counter, map tile error, lat/lng number fields, photo limit error (≤10, ≤5 MB, JPEG/PNG/WebP), photo previews + remove, all validation errors joined into one alert. **Step 3 review:** summary list, thumbnails, anonymous checkbox (default on), email field. Submitting, submit error. | Category preselect via URL, geolocation (granted/denied/unavailable), address search, outside-city state, per-photo upload progress, compression + EXIF strip, draft restore, leave-confirmation, offline queue, slow network |
| ☐ | (success view inside `/report`) | same | Public ID, tracking key in `<code>`, "notification pending" note, PDF download (loading, error), "report another" | **Refreshing the page loses the tracking key.** | Stamp moment, ticket stub, "I saved my key" check, share, install |
| ☐ | `/track/[public_id]#key=…` | `src/app/track/[public_id]/page.js` → `src/components/ReportProgress.jsx` | Citizen progress view | no key in hash → error, loading, invalid/expired, loaded (Pending / In Progress / Resolved), refresh, PDF download. `noindex`. Key is stripped from the URL after reading. | Timeline from `created_at` → status → `resolved_at` |
| ☐ | `/municipality/[public_id]#key=…` | `src/app/municipality/[public_id]/page.js` → `ReportProgress` | Department link from email (90-day token) | Same as track + "We are handling this", "Mark as resolved", saving, saved | Work-mode styling |
| ☐ | **missing** — retrieve by key | — | Today a key can only be used through the emailed/copied link; there is nowhere to type it. | — | New route: report number + key input, paste/auto-format, invalid/expired states. Uses the existing tracking API, no backend change. |
| ☐ | **missing** — privacy, cookies, about, FAQ | — | The cookie dialog is the only privacy text on the site. | — | New long-form pages. Legal text needs an owner (see open questions). |
| ☐ | **missing** — category and city guide pages | — | — | — | Indexable "report a pothole in Prishtina" pages. Needs real department responsibilities (`TODO(data)`). |
| ☐ | **new, requested** — news (`/sq/lajme`, `/sr/vesti`, `/en/news`) and article pages | — | Updates, articles and reports from the team for citizens. | — | Index, article, empty, not found. Needs a `news_posts` table, an admin editor and cover images in R2 (backend addition). |
| ☐ | **missing** — `/design` | — | — | — | Dev-only system reference, `noindex`. |

## Admin / department routes (all `force-dynamic`, `noindex`, sq/en)

| ☐ | Route | File | States found in code |
| --- | --- | --- | --- |
| ☐ | `/admin/login` | `src/app/admin/login/page.js`, `LoginForm.jsx` | idle, submitting, wrong credentials / expired temp password, setup not run, redirect if signed in |
| ☐ | `/admin` | `src/app/admin/page.js` | inbox list, search `q`, status filter, pagination, empty ("No reports match your filters"), DB unavailable, `?saved` / `?saved=email_pending` / `?error` banners, selected report detail (`?report=`): status + internal note form, photos (`/api/admin/images/[id]`), history, department notification, assign checker (owner only), check/verify review, report not found |
| ☐ | `/admin/settings` | `page.js`, `DepartmentSettings.jsx`, `RouteAssignments.jsx`, `CheckerForm.jsx` | countries and cities, municipality enable + map centre/zoom + ID prefix, departments, category routing table (edit, delete with inline confirm), reporting readiness per city, report checkers + one-time passwords, saved/error, unavailable |
| ☐ | `/admin/stats` | `src/app/admin/stats/page.js` | totals, resolution rate, avg. days to resolve, new reports last 30 days, department performance, checker workload, empty period, unavailable |
| ☐ | `/admin/account` | `page.js`, `AccountForm.jsx` | name/email, password change (≥14 chars), errors |

## System pages

| ☐ | Page | Today |
| --- | --- | --- |
| ☐ | 404 | Next.js default (no `not-found.js`) |
| ☐ | 500 / error boundary | Next.js default (no `error.js` / `global-error.js`) |
| ☐ | Loading | none (`loading.js` absent); map placeholder is a grey `animate-pulse` box |
| ☐ | Offline | `public/offline.html`, trilingual static page, system font |

## Overlays and inline UI

| ☐ | Element | Where | Today |
| --- | --- | --- | --- |
| ☐ | Cookie notice | `AppControls.jsx` | `<dialog>` shown modally on first visit (blocks everything, including the report CTA), "Necessary only" + "Customise" expands a details box with no real toggles |
| ☐ | Cookie re-open link | `AppControls.jsx` | Text button in the bar below the footer |
| ☐ | Install prompt | `AppControls.jsx` | Button in that bar; uses `beforeinstallprompt`, otherwise toggles an inline iOS help paragraph |
| ☐ | Language switcher | landing, report, track, admin | Four separate implementations |
| ☐ | Map picker | `ReportMap.jsx` | Inline 340 px map, click to drop, draggable pin, tile error banner |
| ☐ | Photo picker | `/report` step 2 | Native multi-file input, no `capture`, no camera-first |
| ☐ | Confirmation dialogs | `RouteAssignments.jsx` | Inline "Confirm delete" only. No confirm on leaving a report draft. |
| ☐ | Toasts | — | None. Feedback is inline `role="status"` / `role="alert"` paragraphs. |

## Generated artifacts the user sees

| ☐ | Artifact | Source | Today |
| --- | --- | --- | --- |
| ☐ | PDF proof | `src/lib/report-pdf.js`, served by `/api/reports/[public_id]/pdf` (bearer key) | Navy header bar, trilingual labels in one line ("Category / Kategoria / Kategorija"), Noto Sans Regular, no map, no QR, no stamp |
| ☐ | Private key display | success view | Raw 43-char key in `<code>`, one sentence above it |
| ☐ | New-report email to department | `src/app/api/reports/submit/route.js` | Inline HTML, **English only**, inline photos, link to `/municipality/…` |
| ☐ | Status emails (department + non-anonymous reporter) | `src/lib/report-notifications.js` | Inline HTML, **English only**, "Report status: Pending" |
| ☐ | Manifest, icons, `theme-color` | `public/manifest.json`, `layout.js` | One theme colour, no dark variant |

## SEO today

- One `<title>` (`siteTitle`) for most pages; client code rewrites it after hydration.
- Meta description is English on every page.
- No `hreflang`, canonical, `sitemap.xml`, `robots.txt`, Open Graph, Twitter cards or JSON-LD.
- Language lives in `?lang=`; links are rebuilt by hand with `?lang=${language}`.

## Gaps that touch the backend (flagged, not changed)

1. **Subcategories** don't exist in the schema (`reports.category` is one of seven slugs). Optional subcategory needs a column, or we skip it.
2. **Address search / reverse geocoding** needs a geocoder. Nominatim is a third party and its usage policy forbids autocomplete. Options: self-hosted, a licensed provider, or a local Prishtina street index built from OSM at build time (search only, no reverse lookup).
3. **"Notify me when my city launches"** needs storage for emails. Without it, the outside-city state can only explain and link to the emergency/municipality contacts.
4. **QR code in the PDF**: if it carries the key, the PDF becomes a bearer credential. Safer default: QR opens the retrieval page with the report number filled in, key typed by hand.
5. **Emails are English-only.** `reports.language` is already stored (`CHAR(2)`), so reporter emails can be localised without a schema change. Serbian is Latin only, so `sr` fits as is.
6. **Status history for citizens**: the tracking API returns `status`, `created_at`, `resolved_at` only. Enough for an honest three-point timeline; the "In progress since" date would need the audit log exposed.
