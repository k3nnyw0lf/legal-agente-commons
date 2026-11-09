# How the code is laid out

License: the code is `AGPL-3.0-only` (see [LICENSE](../LICENSE)); every project file starts with an SPDX line saying so. Vendored libraries keep their own licenses ([THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md)). Before building something new, read [reuse-before-building.md](reuse-before-building.md).

One Cloudflare Worker serves the pages in `public/` and answers the `/api/` calls. There is no build step.

## Server: `src/`

| File | What it does |
|---|---|
| `src/index.js` | The whole server. Routing, sign-in, roles, case data, files, search, AI, email in, calendar, backups. |
| `src/grounding.js`, `src/paper-dates.js` | One-line re-exports of `public/grounding.mjs` and `public/paper-dates.mjs`, so the server and the browser pages share one copy of the rules. |
| `src/sample-case.js` | The one **fictional** case, and its lawyer-view code. Real cases are never stored in code. |
| `src/vendor/` | postal-mime (reads incoming email) and @simplewebauthn/server (passkeys). |

Main parts of `src/index.js`, top to bottom:

- **Case lookup.** `caseByCode()` finds a case by its code: the sample case, a lawyer view of it, or a case added from the admin page (stored in KV as `case:<code>`).
- **Lawyer view.** `counselView()` gives the same case without some tabs, private file groups and requests marked private.
- **Owner-only items.** `ownerView()`; uploads, email and text marked "owner" never reach a lawyer view.
- **File fingerprints.** Every file's SHA-256 goes into a D1 table where each row is chained to the one before (`evRecord`, `/api/evidence`, `/api/admin/evidence-chain`).
- **Citation check.** `citeFind()` finds case citations in text; only the citations are sent to CourtListener.
- **Ask AI rules in code** (`src/grounding.js`). `checkCites()` keeps only page numbers the AI was given and marks answers with none; `adviceAsked()` adds a fixed notice (English or Spanish) when a question asks what to do.
- **Dates found in the papers** (`src/paper-dates.js`). `/api/case` adds a timeline phase with every full date written on a page, linked to that page, skipping dates already on the timeline for the same file.
- **Email into a case.** Two private addresses per case (`in-<token>@<MAIL_DOMAIN>`): one shared with the lawyer view, one owner-only. Only people on the case (or senders the owner lists) can send to them.
- **Search by meaning.** Workers AI embeddings (`@cf/baai/bge-m3`), stored small (int8) in KV.
- **Recordings to text.** The browser sends a few minutes at a time to Workers AI Whisper.
- **The app** (`__app.fetch`): `/api/case`, `/api/ask`, `/api/rewrite`, `/api/store`, `/api/upload`, `/api/text`, `/api/text-add`, `/api/meaning`, `/api/transcribe`, `/api/transcript`, `/api/evidence`, `/api/evidence/check`, `/api/cite-check`, `/api/mailin`, `/api/extract`, `/api/case-edit`, `/api/comments`, and hosted files under `/cf/<slug>/`.
- **Sign-in** (`__authRoutes`): password (PBKDF2-SHA256, 100,000 rounds), 2-step codes (RFC 6238) with one-time backup codes, passkeys, invites, a short "setup window" for the first admin, sign out everywhere, private calendar link.
- **Who opened my file** (`/api/who-opened`, `/api/case-access`; table `case_views`). Every view of a case is written down (who, when, what, no device address) and the owner reads it; the owner can cut a helper off with one tap. Lines are deleted after `LOG_DAYS` (90 by default), when read and every night.
- **Admin** (`/api/admin/*`): invites, users, add or delete a case, access log, backups, settings, fingerprint-log check.
- **Entry point** (`export default`): public pages, sign-in gate, case-code check for invited people, access logging, nightly backup (cron), incoming email.

## Pages: `public/`

| File | What it is |
|---|---|
| `index.html` | Public home page (English and Spanish). |
| `login.html`, `setup.html`, `security.html` | Sign in, create a login (invite or setup window), manage 2-step, passkeys and calendar link. |
| `admin.html` | Invites, cases, access log, backups, settings. |
| `app.html` | The case screen: tabs, map, timeline, money, letters, portals, fees, requests, responses, notes, search. |
| `app-plus.js` | Adds the web graph, document search, exhibit binder, viewer, zoomable timeline, charts, overview, proof map, deadlines, requests with uploads, fingerprints, email in, citation checks, search by meaning, recordings, read aloud, talk, and Spanish. |
| `brief.mjs` | The one-page summary for a volunteer (no DOM, also used by the tests). Opened from the "📄 One-page summary" button. |
| `letter.html`, `letter.js`, `letter-check.mjs` | **"What is this letter?"** (public, no sign-in). Photo → OCR in the browser → what kind of paper, the dates on it (each next to its piece of the photo), who can help (approved list). Runs on the phone; nothing is sent unless the person saves it to a case. See [letter-check.md](letter-check.md). |
| `grounding.mjs`, `paper-dates.mjs` | The Ask AI rules, the approved-sources rules for the letter check, and the date finder. Pure code, no DOM, used by the server, the pages and the tests. |
| `calendar-file.mjs`, `calendar-save.mjs` | **Add to my calendar.** Builds a calendar file (.ics) for dates a person checked against the paper, and saves it on the device. No invitations, no email or audio alarms, no network calls; each event says the court's paper is what counts. Used by the letter page and by "Dates found in the papers" in the case timeline (each found date has a box to tick, kept in the case's `datechecks` store). |
| `binder.mjs` | **Lawyer-ready binder.** One tap in the case bar makes a PDF on the device: cover, index with page numbers, the one-page summary (built on `brief.mjs`), the timeline, and every PDF and photo in the case, each page marked "Binder page N of M". Phone numbers, email addresses and street addresses are left out unless the person ticks "Include phone numbers and addresses" (the papers are added as they are). Draws with the vendored pdf-lib; the tests read the page numbers back out of the finished PDF. |
| `read-aid.js` | Reading aid: bigger text, spacing, a reading ruler. |
| `la.css` | Shared look for the public pages. |
| `vendor/` | Libraries, at fixed versions. See `THIRD_PARTY_NOTICES.md`. |
| `cf/sample-debt-ortega/` | The fictional sample case's documents and text index. |

## Storage (bindings in `wrangler.example.toml`)

- **KV `COMMENTS`**: logins, invites, added cases, notes, editable boards, upload lists, text index, email settings, settings.
- **R2 `FILES`**: uploaded and emailed files (`cases/<slug>/…`) and nightly backups.
- **D1 `DB`**: `access_log`, `case_views` and `evidence` tables. See `schema.sql`.
- **Workers AI `AI`**: Ask AI, find dates and people, search by meaning, speech to text.

## Settings (`[vars]`)

| Name | What it is |
|---|---|
| `ADMIN_EMAILS` | Comma-separated emails that may create an admin login during the setup window. |
| `PASSKEY_RP_ID`, `PUBLIC_ORIGIN` | The site name passkeys belong to, and its full address. |
| `MAIL_DOMAIN` | The domain that receives case email. |
| `LOG_DAYS` | How many days the access logs are kept. Default 90. |
| `AI_DRAFTING` | `"on"` turns on "Rewrite with AI" for discovery answers. Off by default. |
| `COURTLISTENER_TOKEN` (secret) | Optional. Can also be saved from the admin page. |
