# kosova.report

**Report what's broken in your city, with a photo and the exact spot, and it goes straight to the department that handles it.**

[kosova.report](https://kosova.report) is a civic reporting platform for Kosovo. Residents report problems such as potholes, overflowing bins, a school without heating or a counter nobody answers. Each report goes to the responsible municipal department, which marks it "being handled" or "resolved". The reporter can follow it the whole way, with or without giving their name.

It is live in Prishtina, and more municipalities can be switched on from the staff panel. The site works in **Albanian, Serbian (Latin) and English**.

> This platform is not an emergency service. In an emergency, call **112**.

---

## Features

### For residents

- **Report in about two minutes.** Pick a category, drop a pin, describe the problem, add photos, send.
- **Seven categories.** Infrastructure, Environment, Public services, Administration, Health, Education, Safety. Each comes with examples and a hint about what to write.
- **Exact location.** Use the phone's location or tap the map. The pin can be dragged, moved with the keyboard, or entered as coordinates. The official municipal border is drawn on the map, and pins outside it are refused.
- **Photos made safe.** Up to 10 photos per report. They are shrunk on the phone, and the location, device and time details cameras add are removed before upload.
- **With or without your name.** Anonymous reports carry no contact details. Named reports share an email with the department and send status emails to the reporter.
- **Proof of reporting.** Every report gets a number (e.g. `PR-2026-000418`), a private key and a downloadable PDF receipt with a QR code.
- **Follow progress.** With the number and key, anyone can see the status and a timeline: sent, with the department, being handled, resolved.
- **Drafts and offline sending.** A report in progress is saved on the device. Without a connection it is queued and sends itself when the connection returns.
- **Install as an app.** It is a Progressive Web App and can be installed on phones and desktops.
- **Comfortable to use.** Automatic light/dark theme (dark after sunset in Prishtina), a high-contrast mode for sunlight, full keyboard and screen-reader support, and large touch targets.
- **News.** Updates, articles and reports from the team, in all three languages.

### Already reported? Public issues, thumbs-up and comments

- **Duplicates are spotted before they're sent.** While reporting, people see problems already reported nearby, with distance, date, status and count. They can:
  - add their report to an existing issue (it keeps its own number and key),
  - only give it a **thumbs-up** ("I see this too"),
  - or say their problem is different.
- **The person reporting decides.** Two potholes 20 m apart are two problems, so nothing is merged automatically. How far the search reaches depends on the category (from 40 m for a building to 100 m for rubbish) and on GPS accuracy. Another category only counts when it's almost on the same spot.
- **Public issue pages.** Each issue has a shareable page with the category, status, how many times it was reported, how many people confirmed it, and a comment thread.
- **Privacy first.** Until staff check an issue, its page shows only the category, an approximate area (not the exact spot), dates and counts. Staff can then publish their own summary, the exact pin and photos they choose. Names, emails and private keys are never shown.
- **Moderated comments.** Residents can add updates and up to 3 photos. Comments appear only after staff approve them. Staff can post official updates at once.
- **One status for the whole issue.** When the department updates one report, every report of the same problem follows, and each reporter is emailed.

### For municipal departments

- **Email for every new report**, with the description, map link, photos and reporter email (if given) inline. It shows "Reported N times" when the report joins an existing issue.
- **A private link to update status** ("being handled", "resolved"), with no account needed. The link expires after 90 days.
- **Routing per municipality and category.** Each category goes to one department of that municipality.

### For staff (the staff panel at `/admin`)

- **Report inbox.** Filter by status, search by number or text, page through results, and move with `j`/`k` (`/` searches). Grouped reports carry a ×N badge.
- **Report view.** Evidence photos, map link, reporter, department, status changes with an internal note, and a full history.
- **Checking workflow.** Assign reports to checkers, who verify them and leave a note.
- **Issues and duplicates.** See every report of the same problem, review possible duplicates, merge them or mark them as different (this is remembered), and separate a wrongly grouped report.
- **Publication.** Choose what the public sees for each issue (hidden, listed, public), write the public summary and pick photos.
- **Community queue.** Approve or reject comments and review duplicate suggestions in one place.
- **Statistics.** Status overview, new reports in the last 30 days, reports by category, resolution rate, average days to resolve, department performance and checker workload. Every chart can also be shown as a table.
- **News editor.** Updates, articles and reports per language, with cover images and scheduled publishing.
- **Settings.**
  - Countries and municipalities: public ID prefix, map centre and zoom, and the official boundary.
  - Turning public reporting on or off per municipality.
  - Departments and their emails, and category routing (with a check for categories nobody receives).
  - Staff accounts.
- **Roles.** *Admins* manage everything. *Checkers* see and verify only the reports assigned to them.
- **Staff panel in English or Albanian.**

### Privacy and security

- No advertising or analytics cookies.
- Private keys travel in the URL fragment, are kept only for the browser tab, and are never written to server logs.
- All photos are stored in private Cloudflare R2 storage and served only to authorised staff, or on a public page when staff choose them.
- Staff use one-time first passwords and server-side sessions, and sign-in attempts are rate-limited. Every status change is audited.
- Thumbs-up and comments are counted per browser with a hashed random cookie, never an IP address or account, and are rate-limited.
- Database migrations back up the database first and can safely be run again.

---

## Technology

- [Next.js 16](https://nextjs.org) (App Router) and React 19
- [next-intl](https://next-intl.dev) for the three languages and localized URLs
- Tailwind CSS 4, with the Sofia Sans font hosted on the site's own server
- MySQL (via `mysql2`)
- Cloudflare R2 for images (S3 API)
- SMTP2Go for email
- Leaflet with OpenStreetMap tiles
- jsPDF and `qrcode` for receipts

## Getting started

Requires Node.js 22 or newer and a MySQL database.

```bash
npm install --legacy-peer-deps
cp .env.example .env.local   # fill in MySQL, R2 and SMTP2Go settings
npm run migrate              # backs up, then applies sql/004–007
npm run dev
```

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm test` | Test suite (MySQL, R2 and email are mocked) |
| `npm run build` | Production build |
| `npm run setup:server -- --email you@example.org` | First setup on a server: backup, migrations, first admin with a one-time password |
| `npm run migrate` | Backup and migrations only |
| `npm run migrate:images -- --apply` | Moves older report images into R2 |
| `npm run verify:images` | Checks that every stored image really exists in R2 |

Deployment, account recovery and image migration are described in [REPORTING_SETUP.md](REPORTING_SETUP.md). The database migrations are explained in [sql/README.md](sql/README.md).

### Deployment

Every push to `main` deploys to production through GitHub Actions. The deploy installs packages, backs up and migrates the database, builds the site and restarts it. Work on a branch and merge to `main` only when it's ready to go live.

## Project layout

```
src/app/[locale]/   public pages (report, track, issue, news, privacy)
src/app/admin/      staff panel
src/app/api/        reports, tracking, issues, images, municipality links
src/components/     report flow, receipt, maps, issue page
src/lib/            database, matching, notifications, PDF, R2, email
src/messages/       sq / sr / en text
sql/                repeatable database migrations
tests/              node:test suites
```

## Authors

- **Nasko Gashi**
- **[CODON](https://codon.fi)**, a part of Progon LLC

## Supported by

This activity is supported by the **CIVICUS Digital Democracy Initiative (DDI)**. Project partners: CIVICUS, Metamorphosis Foundation, TechSoup, Digital Activism Program and Sbunker.

## License

Copyright © 2026 Nasko Gashi and Progon LLC (CODON).

- **Code:** [GNU Affero General Public License v3.0](COPYING). If you run a modified version as a website or online service, you must publish its complete source code to its users.
- **Written content, reports, data, PDFs and images:** [CC BY-NC-ND 4.0](https://creativecommons.org/licenses/by-nc-nd/4.0/). Share it unchanged, with credit, for non-commercial use. Selling, modifying or translating it needs written permission.
- **The "kosova.report" name, logos and brand:** all rights reserved. The open-source license does not let anyone use them, or present a copy as the official kosova.report.

Fonts, partner logos, libraries, map data and residents' submissions keep their own licenses and owners. The full terms are in [LICENSE](LICENSE). For permissions, write to nasko@gashi.fi.
