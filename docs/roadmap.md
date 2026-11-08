# Still to build

None of this is built yet. Every part follows [access-model.md](access-model.md): only the people on a case see it, and the server checks that on every request. Starter tasks for new helpers are in [starter-issues.md](starter-issues.md).

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
- **Checked before the first match:** identity, and any license they list (lawyers through the Florida Bar's public member search, notaries through their commission).
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

Never based on wins. Saying no never lowers a score. Scores can count tasks finished on time, clients who say they understood the help, and supervisor reviews.

## 7. Per-case access lists

Enforced on the server for every route, with: the authorized-representative role, time limits per task, emergency access with a second approver, and an access log the client can read. Until this is built, an admin can open every case, so no real case may be added.

## 8. Phone helper app

So helpers can give spare minutes to cases instead of scrolling social media.

- A feed of small **task cards**: a preview with no names, how long it takes, accept or skip. Skipping never lowers a score.
- **Voice notes:** hold to talk, and the note is turned into text in the case. The app already does speech to text with Whisper on Workers AI, which does not keep a copy of the audio. Notes follow the [helper notes rules](access-model.md#helper-notes): case team first, client only after the supervising lawyer approves a non-lawyer's note.
- Starts as a **phone web app** that people install from the browser, not an app-store app.
- Keeps read aloud, the dyslexia-friendly fonts, and English and Spanish, and uses each helper's saved [preferences](#9-preferences-that-follow-the-person).

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

## Before any real case

- An outside security review.
- A lawyer's review of every AI feature against the "never gives legal advice" rule.
- Answers to the [open questions for counsel](access-model.md#open-questions-for-counsel).
