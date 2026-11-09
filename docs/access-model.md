# Who can see a case

The rule: **only the people on a case see it.** Everything below follows from that one rule.

This is the target. The code in this repo does not do all of it yet. See [What the code does today](#what-the-code-does-today) and [Still to build](#still-to-build).

## One access list per case

- Every case has its own access list. The list says who may open the case and which parts they may open.
- The server checks the list on **every** request: case data, files, search, AI, notes, calendar. The browser never decides who sees what.
- Being signed in is not enough. A person must be on that case's list.
- Nobody gets in by role alone. "Admin", "staff" and "board member" open no case by themselves.

## Who sees what

| Person | What they see | When it ends |
|---|---|---|
| **The client** | Their whole case, and a list of everyone who opened it. | Never, while the case exists. |
| **Authorized representative** (see below) | What the client allows: the whole case, or only some parts. Everything they do is logged under their own name. | When the client (or the court order or legal document behind it) ends it. |
| **Notified helper** (offered a task, not yet answered) | A preview with no names: the kind of case, the county, the task, the language, how long it takes, the deadline. No names, no documents. | When they accept or pass. |
| **Matched helper** (accepted a task) | Only the parts of the case their task needs. A helper asked to review a summons sees the summons, not the whole file. | When the task closes, or the helper leaves. Access stops on its own. |
| **Health helper** (psychologist, counselor, social worker, doctor, nurse) | Only what their task needs, kept in the case's separate [health compartment](#health-compartment). Not the legal file, unless the task needs a part of it. | When the task closes, or the helper leaves. |
| **Supervising lawyer** | The cases in their own program. Not the health compartment, unless the person consents (see below). | When the case leaves their program. |
| **Program lead** | Status only: open, matched, waiting, closed, dates. No documents, no notes. | While they lead the program. |
| **Ken (founder) and tech staff** | Nothing, as routine. | Not applicable. |
| **Board, donors, builders** | Never any case data. Builders work only with made-up data like the sample case. | Not applicable. |

### Emergency access

Sometimes a person on the tech team must look inside a case to fix a real problem. Then:

1. A second person approves it first.
2. The access is logged: who, when, which case, why.
3. The client is told.
4. Access ends when the fix is done.

## Cases brought by someone else

A case can come in through the app, a call, a voice note, photos, email, paper or a partner's desk (see [roadmap: bringing a case](roadmap.md#2-bringing-a-case)). Whoever brings it, these rules hold:

- **The person brings their own case.** That is the normal way.
- **A helper can bring it for them** (family, a friend, a caseworker, a partner group), but only with the person's consent, recorded in the case (who agreed, when, how). The person confirms before anything happens on the case. Until they confirm, the case sits in intake and nobody is matched.
- **A parent or guardian** brings a case for a minor.
- **A legal guardian, or an agent under a power of attorney,** brings a case for the person they act for. The program keeps a copy of the paper that gives them that power.
- These people get the **authorized representative** role on that one case. It is listed on the case's access list like anyone else, and the client (where they can) sees it and can end it.
- **Nobody opens a case about someone else without their consent.** No case "against" a neighbor, a landlord or a company.
- **A problem that affects many people** (for example the same collector calling a whole building) goes in as an **issue report**, not a case. An issue report holds no one's private case data.

## Helper notes

Helpers add notes to a case: typed, or spoken into the phone helper app (see [roadmap: helper app](roadmap.md#8-phone-helper-app)).

- **A note goes to the case team first.** The client does not see it yet.
- **A note from a non-lawyer reaches the client only after the supervising lawyer approves it.** Until then it stays with the case team. This keeps advice coming only from a lawyer.
- **Every note keeps its author, role and date.** Nobody can change who wrote it or when. An edit is saved as a new version, and the old one stays.
- **A note stays inside that case's access list.** It is never copied to another case, a helper's own profile, a score, or any report outside the case.
- **Voice notes are turned into text in the case.** The app already does speech to text with Whisper on Workers AI, which does not keep a copy of the audio (confirm this in the provider's current terms before launch). Whether the recording itself is kept, or only the text, is a decision still to make.

## Health compartment

Some helpers are health professionals: psychologists, counselors, social workers, doctors and nurses. They get the **health helper** role.

- **License checked before the first match,** through the state's public license search (in Florida, the Department of Health). Until then they see no previews.
- **Health and therapy notes live in a separate compartment of the case,** never in the legal file. A health note moves into the legal file only if **the person consents in writing and the supervising lawyer agrees.** Both are recorded in the case.
- **Health helpers see only what their task needs.**
- **Lawyers do not see the health compartment by default.** Nor do other helpers, the program lead, or tech staff.
- The health compartment follows every other rule here: one access list, checked on the server, every view logged and shown to the person.

## Crisis note on every helper screen

Every helper's screen shows, at all times:

> **In an emergency, call 911. In a mental-health or suicide crisis, call or text 988.**

The same note shows in Spanish when the screen is in Spanish (**En una emergencia, llame al 911. En una crisis de salud mental o de suicidio, llame o envíe un mensaje de texto al 988.**).

## Languages inside a case

- The case keeps **the person's own words** (what they wrote or said, in their language) **and an English version** for the lawyer. Both stay in the case and on its access list.
- A machine translation is marked as one until a person who speaks the language checks it.
- Case content is translated only by a provider that keeps no copy, the same rule as speech to text and read aloud.

## Every view is logged

- Every time someone opens a case, a file or a page of search results, the server writes it down: who, when, what.
- The client can see that log for their own case: "who opened my file, and when."
- Nobody can edit or delete the log. (The file fingerprint log in this repo already chains each row to the one before it; the access log should work the same way.)

## Helpers and scores

- **Trained before the first case.** A helper must pass the [volunteer training](volunteer-training.md) (privacy, the no-advice line, conflicts) before they can open any case or file. The server enforces it. The training text is a draft for counsel review.
- **Checked before the first match.** A helper's identity, and any license they list, are checked before they are matched to any case: lawyers through the Florida Bar's public member search, notaries through their commission. Until then they see no previews.
- Each offer has three one-tap answers: **Accept**, **Not now**, **Not this type**. None of them lowers a score. "Not this type" updates the helper's profile so they stop getting that kind of task.
- Skipping a card in the helper app counts as "Not now". It never lowers a score either.
- Scores are never based on wins. A helper who takes hard cases must not look worse than one who takes easy ones.
- Scores can count things like: tasks finished on time, clients who say they understood the help, supervisor reviews.
- A helper can leave at any time. Their open tasks go back to the program, and their access to those cases ends the same moment.
- **Hours are the helper's own.** A helper can log the time they give and download a year-end report ([pro-bono-hours.md](pro-bono-hours.md)). Nobody else sees those hours, and they are never used in a score or a match.

## Personal preferences

Each person's settings (read or listen, type or talk, language, font, spacing, text size, plain words, simple mode, how and when updates arrive) are saved on **their account**, so they follow the person to any phone or computer (see [roadmap: preferences](roadmap.md#9-preferences-that-follow-the-person)).

- Preferences belong to the person. They are not case data and are not shared with helpers, except what is needed to reach them: language, and the channel and hours for updates.
- When case content is read aloud, the app uses the voices built into the person's device, or a provider that keeps no copy. It asks the person once before it uses any online voice, and remembers the answer on their account.

## What the code does today

Be honest about the gap. Today's code came from a one-person app, so:

- **An admin can open every case.** That breaks the rule above. It must change before any real case is added.
- Invited people (role `counsel`) open only the case codes on their invite. That part is close to a per-case list.
- A "lawyer view" code shows the same case without some tabs. That is a view, not an access list.
- **Who opened my file (built 2026-11-09).** The owner of a case sees, in the case screen, every time someone opened the case, opened a file, added a file, used Ask AI, or was cut off or let back in: who, when, what. The log lives in D1 table `case_views`. It keeps **no address of anyone's device**, it never holds the case code, and nothing can edit a line. Lines are **short-lived**: deleted after `LOG_DAYS` (90 by default) when the log is read and every night. The owner can **cut off any invited helper with one tap** (and let them back in with one tap). The cut-off works at once, on every route and every file, and it holds even if the helper's login still lists the case code. Administrators are listed but cannot be cut off here: see the next point.
- The older admin log (D1 table `access_log`, with device addresses, for tech staff) is also deleted after `LOG_DAYS`. The owner cannot read it.
- There is no authorized-representative or health-helper role, no health compartment, no notified-helper preview, no task, no automatic end of access.
- Preferences (reading aid, read-aloud speed, online-voice answer, theme) are kept in each browser's local storage, not on the account.
- Case codes are a second key on top of sign-in. They are not a replacement for an access list.

## Still to build

Details for each item are in [roadmap.md](roadmap.md).

1. [Self sign-up and eligibility](roadmap.md#1-self-sign-up-and-eligibility)
2. [Bringing a case](roadmap.md#2-bringing-a-case): every channel, cases brought by someone else, the "court date soon?" flag
3. [Intake and conflict check](roadmap.md#3-intake-and-conflict-check)
4. [Helper profile and checks](roadmap.md#4-helper-profile-and-checks)
5. [Offers, notifications and matching](roadmap.md#5-offers-notifications-and-matching): Accept / Not now / Not this type
6. [Helper scores](roadmap.md#6-helper-scores): never based on wins
7. [Per-case access lists](roadmap.md#7-per-case-access-lists): enforced on the server, with the authorized-representative role
8. [Phone helper app](roadmap.md#8-phone-helper-app)
9. [Preferences that follow the person](roadmap.md#9-preferences-that-follow-the-person)
10. [Languages](roadmap.md#10-languages)
11. [Health helpers and the health compartment](roadmap.md#11-health-helpers-and-the-health-compartment)

Also needed before real cases: an outside security review, and a lawyer's review of every AI feature against the "never gives legal advice" rule (see [AI features](../README.md#ai-features)).

## Open questions for counsel

These need a Florida lawyer's answer before real cases. Nothing here is decided.

1. **Helpers' voice notes:** are they protected as work product when a helper makes them under the supervising lawyer's direction? Does the answer change for a non-lawyer helper (student, paralegal, peer guide), or if the recording is kept instead of only the text?
2. **Consent when someone else brings a case:** what record of the person's consent is enough, and what proof should the program ask of a guardian or an agent under a power of attorney?
3. **Safe-harbor wording** for security researchers in [SECURITY.md](../SECURITY.md): is it right for a Florida nonprofit?
4. **Health compartment:** which health-privacy rules apply to notes that health helpers make in this program, and what must the person's written consent say before a health note moves into the legal file?
5. **How long to keep the access log.** "Who opened my file" keeps lines 90 days, then deletes them (short-lived on purpose, so the log is not itself a record of private activity). Is 90 days right? Does a lawyer's duty to keep records, a legal hold, or a dispute about who saw a paper need a longer period for some cases?
6. **The owner and "the client".** Today the owner of a case is an administrator of the deployment. Until a self sign-up client account exists, who reads the log and who can cut a helper off for a real client?
