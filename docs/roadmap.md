# Still to build

None of this is built yet. Every part follows [access-model.md](access-model.md): only the people on a case see it, and the server checks that on every request. Starter tasks for new helpers are in [starter-issues.md](starter-issues.md).

**Already built (2026-11-08), not part of the list below** (ideas taken from other legal-help tools, made our own way): Ask AI rules enforced in code (cited pages only, a fixed "a lawyer must answer this" notice in English or Spanish), dates found in the papers on the timeline, and a one-page summary for a volunteer. Still to do for these: a lawyer's review of the wording, and a way to mark a found date as checked.

**Also built (2026-11-09), from the board's review of 12 new ideas.** Each has its own tests and a real-browser test (`node scripts/browser-test.mjs`, Chrome or Edge, no server). All the wording is a **draft for counsel and for a Spanish speaker**.

| Built | What it does | Notes |
|---|---|---|
| [What is this letter?](letter-check.md) (`/letter`, public) | Photo → OCR on the phone → what kind of paper, the dates (each next to its piece of the photo), who can help from an approved list. Never says what to do. Blurry photo: asks for a new one. Social Security numbers blacked out before saving. | 26 made-up letters run as tests on every change. Blur limits need a test with real photos. |
| Add to my calendar | A calendar file for each date the person ticked after checking it against the page. Nothing sent. Says the court's paper is what counts. The tick is kept for the case (this also finishes "a way to mark a found date as checked"). | |
| Lawyer-ready binder | One tap: PDF with a cover, an index with page numbers, the summary, the timeline and every paper. No phones or addresses unless turned on. | Page numbers are read back out of the PDF in the tests. |
| [Who opened my file](access-model.md) | The owner sees every view (who, when, what; no device addresses) and cuts off any invited helper with one tap. Lines kept 90 days. | Part of item 7 below. Administrators can still open every case. |
| [Pro bono hours](pro-bono-hours.md) (`/hours`) | Helpers log time per case and download a year-end report. Private to the helper, never a score. | The Florida Bar rule 4-6.1 numbers were found on the Bar's own site and are shown only in a sourced note. |
| [Volunteer training and quiz](volunteer-training.md) (`/training`) | 15 minutes: privacy, the no-advice line, conflicts, then a quiz. A helper cannot open a case until they pass. | **Draft for counsel review**, clearly marked. |
| [Our numbers](impact-page.md) (`/impact`, public) | Counts by kind of case and county, no names. Under 10 shows "fewer than 10"; too few cases shows "not enough cases yet". | No donate button (FDACS). |

**Not built, by decision:** WhatsApp intake (auto-replies are sends, and papers would pass through Meta), court-day checklists, library and 211 partners, the senior scam packet and the disaster papers kit. They were "later" or "hold" in the review.

**Still to do for these seven:** a lawyer's review of every text; a Spanish reader; a test of the letter check with real phone photos and the person's yes; a test on a cheap Android phone with a screen reader; the open questions listed in each doc; and the same Social Security check for photos uploaded from other screens.

## 1. Self sign-up and eligibility

A person in Florida signs up, answers a few plain questions, and learns whether the program can help. One question per screen, big buttons, English or Spanish to start (see [Languages](#10-languages)).

## 2. Bringing a case

**Every way in lands in the same private case file**, in the person's language:

| Way in | What happens |
|---|---|
| App or website form | One question per screen. |
| Voice | Hold to talk in the app, or send a WhatsApp voice note. Turned into text. |
| Video | Turned into text. The video itself stays private in the case. |
| Photos of papers | Read with OCR and placed on the timeline by their date. |
| Email | Forwarded to the case's private address. (Already built.) |
| Paper | Mailed in, or dropped at a partner, and scanned by a volunteer. |
| In person | Intake at partner sites. |

**Who can bring a case:** the person; a helper (family, friend, caseworker, partner) only with the person's recorded consent, and the person confirms before anything happens; a parent or guardian for a minor; a legal guardian, or an agent under a power of attorney. These get the **authorized representative** role. Nobody opens a case about someone else without consent. A problem that affects many people goes in as an **issue report**, not a case. Full rules: [access-model.md, cases brought by someone else](access-model.md#cases-brought-by-someone-else).

**First contact asks only the basics,** plus one question: **"Is there a court date or a deadline soon?"** A yes flags the supervising lawyer the same day.

## 3. Intake and conflict check

A trained student or staff member checks the file. The program checks for conflicts before any helper sees a name.

## 4. Helper profile and checks

- **One profile per helper,** with as many case types, skills, languages and counties as they have. Matching uses all of them.
- **Checked before the first match:** identity, and any license they list (lawyers through the Florida Bar's public member search, notaries through their commission, health professionals through the Department of Health's license search).
- Skills can be edited at any time. A helper can leave at any time; their open tasks go back to the program.

## 5. Offers, notifications and matching

- An offer is a **nameless preview**: the kind of case, the county, the task, the language, how long it takes, the deadline.
- **One-tap answers:** **Accept** / **Not now** / **Not this type**. None lowers a score. "Not this type" updates the profile.
- **Notification controls,** set by each helper:
  - on or off for everything
  - on or off per case type
  - quiet hours
  - a weekly limit on offers
  - pause (vacation)
  - channel: app push, SMS, WhatsApp or email
- Matching uses the whole profile, including languages (see [Languages](#10-languages)).

## 6. Helper scores

Never based on wins. Saying no never lowers a score. Scores can count tasks finished on time, clients who say they understood the help, and supervisor reviews. A helper's pro bono hours ([pro-bono-hours.md](pro-bono-hours.md)) are their own and never count toward a score.

## 7. Per-case access lists

Enforced on the server for every route, with: the authorized-representative role, time limits per task, emergency access with a second approver, and an access log the client can read. Until this is built, an admin can open every case, so no real case may be added.

**Partly built (2026-11-09):** the owner can read a short-lived log of who opened the case and can cut off any invited helper with one tap ([Who opened my file](access-model.md)). Still to build: the per-case list itself, the authorized-representative role, time limits, emergency access, and a client account that is not an administrator.

## 8. Phone helper app

So helpers can give spare minutes to cases instead of scrolling social media.

- A feed of small **task cards**: a preview with no names, how long it takes, accept or skip. Skipping never lowers a score.
- **Voice notes:** hold to talk, and the note is turned into text in the case. The app already does speech to text with Whisper on Workers AI, which does not keep a copy of the audio. Notes follow the [helper notes rules](access-model.md#helper-notes): case team first, client only after the supervising lawyer approves a non-lawyer's note.
- Starts as a **phone web app** that people install from the browser, not an app-store app.
- Keeps read aloud, the dyslexia-friendly fonts, and English and Spanish, and uses each helper's saved [preferences](#9-preferences-that-follow-the-person).
- Shows the [crisis note](access-model.md#crisis-note-on-every-helper-screen) on every screen: call 911, or call or text 988.

## 9. Preferences that follow the person

The app adapts to each person, client or helper. Each one chooses:

- **read, listen, or both.** Listen means audio first: every screen and every update is read aloud.
- **type or talk.** Talk means speaking, and the words are typed into the field.
- **English or Spanish** (more as [languages](#10-languages) are added).
- **font** (Standard, Lexend, OpenDyslexic), **spacing**, **text size**, and **plain-words mode**.
- **how updates arrive** (app push, SMS, WhatsApp, email) and **at what hours**.
- **simple mode:** one question per screen, big buttons.

Today `read-aid.js`, read aloud, the language switch and the theme store these in each browser's local storage (keys `la-read`, `la-tts-rate`, `la-tts-online`, `la-lang`, `la-theme`). The change: save them **on the user's account** so they follow the person to any device, with local storage only as a fallback before sign-in.

Read aloud of case content uses the voices built into the device, or a provider that keeps no copy. The person is asked once before any online voice is used.

Target: **WCAG 2.2 AA** on every screen.

## 10. Languages

English and Spanish ship first. More languages are added as volunteers who speak them join. Haitian Creole and Portuguese are likely next.

- **All screen text in one file per language,** so a translator can add a language without touching code. (Today the Spanish lives inside `public/app-plus.js` and in `lang` tags on each page; moving it out is part of this item.)
- Each helper's profile lists their languages, and matching uses them.
- AI first-draft translations are allowed, but they are marked **unreviewed** until a volunteer who speaks the language checks them.
- The case file keeps the **person's original words plus an English version** for the lawyer (see [access-model.md, languages inside a case](access-model.md#languages-inside-a-case)).

## 11. Health helpers and the health compartment

Some helpers are psychologists, counselors, social workers, doctors or nurses.

- A **health helper** role, with the license checked before the first match (in Florida, the Department of Health's public license search).
- A separate **health compartment** in each case for health and therapy notes. A note moves into the legal file only with the person's written consent and the supervising lawyer's agreement. Lawyers do not see the compartment by default.
- Health helpers see only what their task needs.
- **Every helper's screen shows a crisis note:** in an emergency, call 911; in a mental-health or suicide crisis, call or text 988 (in Spanish too).

Rules: [access-model.md, health compartment](access-model.md#health-compartment).

## Before any real case

- An outside security review.
- A lawyer's read of the **new wording** (letter check, calendar, binder, training and quiz, hours report, impact page), and a Spanish speaker's read of all of it.
- The browser test (`node scripts/browser-test.mjs`) run on a real phone with a screen reader, and the letter check tried on real photos with the person's yes.
- License notices in the app (AGPL-3.0): a "Source code" link for everyone who uses a running copy, and a short notice with the copyright, "no warranty", and a link to the license. Counsel confirms the license choice.
- A lawyer's review of every AI feature against the "never gives legal advice" rule.
- Answers to the [open questions for counsel](access-model.md#open-questions-for-counsel).
