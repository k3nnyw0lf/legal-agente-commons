# "What is this letter?" (¿Qué es esta carta?)

A person sends a photo of a scary letter or court paper. The helper says three things and no more:

1. **What kind of paper it is**, from a short list a person wrote ([`KINDS`](../public/letter-check.mjs)). It names a kind only with evidence on the page and a clear lead over the next kind. Otherwise it says **"I don't know."**
2. **Which full dates are written on it**, each shown **next to the piece of the photo it was read from**. Time periods like "20 days" are quoted from the page. Nothing is counted and no deadline is worked out.
3. **Who can help**, from an approved list of official places ([`HELPERS`](../public/letter-check.mjs)). Anything not on the list is dropped in code (`onlyApproved` in `public/grounding.mjs`).

**It never says what to do.** This is built in, not only promised:

- There is no AI model in the letter check. It is rules and fixed texts.
- Every sentence the helper says in its own voice is a fixed text in `public/letter-check.mjs`, in English and Spanish.
- The answer has a fixed shape (`RESULT_KEYS`) with no field for advice, next steps or a recommendation.
- Words from the paper are returned separately as quotes, always marked as the paper's own words. A letter that orders someone around is never repeated in the helper's voice.

## Privacy

- The photo is read by OCR **in the browser** (tesseract.js, loaded from a public CDN the first time; only the program and the English and Spanish language data are fetched). The photo and its words are **not sent anywhere** unless the person chooses "Save this to my case".
- Numbers that look like a Social Security number (3-2-4 digits, or nine digits next to "Social Security", "SSN" or "seguro social") are **blacked out on the picture and replaced by `[hidden]` in the text** before anything is shown or saved.
- The photo stays in memory only: never in local storage, session storage or IndexedDB. "Delete the photo now" empties it. It is also dropped after 10 minutes without use, and when the page closes.
- "Your papers never train AI. Delete them anytime." is on the page, in both languages.

## Blurry photos

If the reader's own confidence is below 65 out of 100, there are fewer than 12 words, or the picture is very soft, the helper **does not answer**. It asks for a new photo. A blurry photo is never read for dates.

## Tests that run on every change

- `tests/letters/letters.mjs`: **26 made-up letters** (fictional people, a fictional county, 555-01xx phones, a Social Security number from the range never issued) with the expected kind, dates, time periods, helpers and hidden numbers. These were written before the code.
- `tests/letter-check.test.mjs`: the fixed answer shape; **no advice patterns in any of the helper's own words, in either language**, for every letter and every fixed text; a pushy letter is not repeated; every helper is on the approved list with an approved host; "I don't know" and close calls; evidence is on the page; time periods are quotes; blurry photos get no answer; hidden numbers; dates tied to a line and a box on the photo.
- `scripts/browser-test.mjs`: headless Chrome reads a letter drawn by the browser itself with the real OCR, checks the dates are shown with their photo crops, that nothing is stored, that a blurry photo gets a request for a new one, and that **the saved photo, read again, no longer shows the Social Security number**.

## Open questions for counsel and reviewers

1. **Wording.** The names and descriptions of the kinds (for example "complaint" and "summons"), the "who can help" texts and **all the Spanish** are drafts. Florida's own Spanish court forms may use other words (for example for "summons").
2. **Is "A lawyer or a legal aid office can tell you what to do" acceptable** next to a list of places that can help, or should the screen say less?
3. **Quoting a time period** ("within 20 days") is the paper's own wording, shown with a fixed note that the helper does not count days. Is that safe, or is a date-only view safer?
4. **The approved list.** All 13 addresses answered on 2026-11-09, but a person must check that each one still fits. The list has no local legal aid offices yet; a program lead should add the ones that take referrals.
5. **Insurance letters.** The helper names them and points to the state helpline only. Counsel should confirm that is outside public-adjuster work (Fla. 626.854).
6. **Retention.** The photo is never kept unless the person saves it. Saved photos follow the case's rules.
7. **Thresholds.** The blur limits (reader confidence 65, picture sharpness 60, 12 words) were set from letters drawn by a browser, not from real phone photos. They need a test with real photos and the person's yes, as the board suggested (5 people at a library).
8. **Photos saved by other parts of the app** (uploads from the requests screen) are not yet checked for Social Security numbers. Only photos saved from this page are.
