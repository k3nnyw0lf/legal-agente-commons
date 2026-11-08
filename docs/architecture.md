# How the code is laid out

One Cloudflare Worker serves the pages in `public/` and answers the `/api/` calls. There is no build step.

## Server: `src/`

| File | What it does |
|---|---|
| `src/index.js` | The whole server. Routing, sign-in, roles, case data, files, search, AI, email in, calendar, backups. |
| `src/sample-case.js` | The one **fictional** case, and its lawyer-view code. Real cases are never stored in code. |
| `src/vendor/` | postal-mime (reads incoming email) and @simplewebauthn/server (passkeys). |

Main parts of `src/index.js`, top to bottom:

- **Case lookup.** `caseByCode()` finds a case by its code: the sample case, a lawyer view of it, or a case added from the admin page (stored in KV as `case:<code>`).
- **Lawyer view.** `counselView()` gives the same case without some tabs, private file groups and requests marked private.
- **Owner-only items.** `ownerView()`; uploads, email and text marked "owner" never reach a lawyer view.
- **File fingerprints.** Every file's SHA-256 goes into a D1 table where each row is chained to the one before (`evRecord`, `/api/evidence`, `/api/admin/evidence-chain`).
- **Citation check.** `citeFind()` finds case citations in text; only the citations are sent to CourtListener.
- **Email into a case.** Two private addresses per case (`in-<token>@<MAIL_DOMAIN>`): one shared with the lawyer view, one owner-only. Only people on the case (or senders the owner lists) can send to them.
- **Search by meaning.** Workers AI embeddings (`@cf/baai/bge-m3`), stored small (int8) in KV.
- **Recordings to text.** The browser sends a few minutes at a time to Workers AI Whisper.
- **The app** (`__app.fetch`): `/api/case`, `/api/ask`, `/api/rewrite`, `/api/store`, `/api/upload`, `/api/text`, `/api/text-add`, `/api/meaning`, `/api/transcribe`, `/api/transcript`, `/api/evidence`, `/api/evidence/check`, `/api/cite-check`, `/api/mailin`, `/api/extract`, `/api/case-edit`, `/api/comments`, and hosted files under `/cf/<slug>/`.
- **Sign-in** (`__authRoutes`): password (PBKDF2-SHA256, 100,000 rounds), 2-step codes (RFC 6238) with one-time backup codes, passkeys, invites, a short "setup window" for the first admin, sign out everywhere, private calendar link.
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
| `read-aid.js` | Reading aid: bigger text, spacing, a reading ruler. |
| `la.css` | Shared look for the public pages. |
| `vendor/` | Libraries, at fixed versions. See `THIRD_PARTY_NOTICES.md`. |
| `cf/sample-debt-ortega/` | The fictional sample case's documents and text index. |

## Storage (bindings in `wrangler.example.toml`)

- **KV `COMMENTS`**: logins, invites, added cases, notes, editable boards, upload lists, text index, email settings, settings.
- **R2 `FILES`**: uploaded and emailed files (`cases/<slug>/…`) and nightly backups.
- **D1 `DB`**: `access_log` and `evidence` tables. See `schema.sql`.
- **Workers AI `AI`**: Ask AI, find dates and people, search by meaning, speech to text.

## Settings (`[vars]`)

| Name | What it is |
|---|---|
| `ADMIN_EMAILS` | Comma-separated emails that may create an admin login during the setup window. |
| `PASSKEY_RP_ID`, `PUBLIC_ORIGIN` | The site name passkeys belong to, and its full address. |
| `MAIL_DOMAIN` | The domain that receives case email. |
| `AI_DRAFTING` | `"on"` turns on "Rewrite with AI" for discovery answers. Off by default. |
| `COURTLISTENER_TOKEN` (secret) | Optional. Can also be saved from the admin page. |
