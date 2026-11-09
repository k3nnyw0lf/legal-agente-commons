# Volunteer training and quiz gate

**DRAFT FOR COUNSEL REVIEW.** Every word of the training and the quiz, in English and in Spanish, needs a Florida lawyer's read (and a Spanish speaker's for the Spanish) before real volunteers use it. The page, the data and the answer to the app all say so.

A helper **cannot open a case until they pass.** The server enforces it on every case route and every file, not the browser.

## What it is

About 15 minutes: three short parts and a 10-question quiz (page `/training`, text in `public/training.mjs`).

1. **Privacy.** Only the people on a case see it. Keep everything inside the app. Private numbers stay on the paper. The person can see who opened their file. Use your own login. The papers never train AI. Tell the program lead about a mistake at once. 911 and 988.
2. **The line between organizing and advising.** Only a licensed lawyer advises. What a helper who is not a lawyer can and cannot do. A good answer when someone asks what to do. A non-lawyer's note reaches the person only after the supervising lawyer approves it. Never call the tool or a helper a lawyer.
3. **Conflicts.** Say it early. Stop and tell the program lead if you see a name you know. No money, gifts or promises. Never use what you learn for your own business. Lawyers: your own conflict rules apply too.

**To pass:** at least 8 of 10 right, **and every question about the no-advice line right.** A helper can try again. Missed questions come back with the right answer and why.

## How the gate works

- Passing is recorded on the person's login (`trained: { v, at, score }`). A request cannot set it: only the server's own scoring can.
- The answer key stays on the server. The page gets the text and the questions with **no answers** (`publicTraining()`); the explanation and the right answer come back only for a missed question.
- Until a helper passes, `/api/case`, the other case routes and `/cf/…` files answer **403** with a message in English and Spanish and a link to `/training`. The training page and `/api/training` stay open to anyone signed in.
- **Administrators** (the people who run a deployment) are not asked. A deployment can turn the gate off with `TRAINING_REQUIRED = "off"`; it is on unless it says off.
- **A new version asks everyone again.** When counsel has approved the text, change `version` in `public/training.mjs` (it starts as `draft-1`). Every helper then takes it again.

## Open questions for counsel

1. **All the text.** Is each statement right for Florida? In particular: what a non-lawyer may do under the unauthorized-practice rules (the list in part 2), the line about retired judges acting as guides, and the lawyer-only conflict sentence.
2. **Pass mark.** Is "8 of 10 and every no-advice question right" the right bar? Should the quiz be longer, or the pass mark higher?
3. **Time.** The page does not check that 15 minutes were spent. Should it (a minimum time before the quiz opens)?
4. **A record.** Passing is recorded as a date and a score. Is that enough proof that a volunteer was trained? Should the program keep a signed acknowledgment?
5. **Lawyers.** Should lawyers who volunteer be asked to take part 2 and 3, or only part 1?
6. **Spanish.** The Spanish is a first draft by a machine-assisted writer. A person who speaks Spanish should read all of it ("usted", clear words).
7. **Answers are public.** This repo is public, so the answer key is readable on GitHub. That is fine for a knowledge gate, but a deployment that wants secret questions should keep its own copy of `public/training.mjs` private.
