# Pro bono hours tracker

A helper (lawyer, law student, retired judge, peer guide) logs the time they give to cases and downloads a **year-end report** for their own records. Page: `/hours` (sign-in needed). Code: `public/hours.mjs` (checks, totals, the CSV file, the printable report), `public/hours.html`, `public/hours.js`, and `/api/hours` in `src/index.js`.

## Rules built in

- **Private to the helper.** Hours are kept under the helper's own login (KV key `hours:<email>`). Nobody else reads them: not the owner of a case, not another helper, not an administrator through the app. The API answers only for the signed-in person.
- **Never a score, never a match.** Hours are not used to rate anyone or to offer anyone a case (see [access-model.md](access-model.md), "Helpers and scores"). A test checks the answer carries no score or rank.
- **Nothing is reported to anyone.** The report is made from the helper's own entries. It says it is not a certification, and that only the helper decides which hours count.
- **No names.** Each entry has a "case reference": a short label or the case number. The page says: no names.
- **An entry** is a real date (not in the future), between 5 minutes and 24 hours, one of eight kinds of work, a case reference (60 characters) and a note (200 characters). Control characters are removed. A helper can change or delete their own entries.
- **The report file** is a spreadsheet file (CSV) with a byte-order mark so accents show. Any cell that starts with `=`, `+`, `-` or `@` is made harmless so opening it cannot run a formula. The printable report is escaped the same way.

## What was verified about the Florida Bar rule, and where

The Bar's reporting details were unverified. On **2026-11-09** they were found on the Bar's own site: *Rules Regulating The Florida Bar*, Chapter 4 (Rules of Professional Conduct), **Rule 4-6.1**, version dated **October 22, 2026**, from <https://www.floridabar.org/rules/rrtfb/> (the chapter PDF linked there):

- (b): the duty is **aspirational**; it may be discharged by **at least 20 hours** a year of pro bono legal service to the poor, **or** a contribution of **at least $350** to a legal aid organization.
- (d): each member **must report each year** through the Bar's **annual membership fees statement**, at minimum the hours of pro bono legal services and the dollar amount of contributions to pro bono organizations. Failing to report is a disciplinary offense.
- (e): hours above 20 in one year may be carried forward for up to 2 following years.
- "Pro bono legal service" is legal service rendered without charge or expectation of a fee when the service starts.

These numbers appear **only** in the Bar note on the lawyer's report and in the "For lawyers" box on the page (`BAR_NOTE` in `public/hours.mjs`), with the source and the date checked. A test fails if an hour number shows up anywhere else in the tracker.

## Open questions for counsel

1. **Is the Bar note right and safe to show?** The wording, the Spanish, and the sentence "Rules change: confirm on the Bar's page" are drafts.
2. **Reporting period.** The rule text found does not say which period the fee statement covers. The tracker lets the helper pick any calendar year and does not say "calendar year" anywhere as a rule.
3. **What counts.** Whether time on a Legal Agente case is "pro bono legal service to the poor" under 4-6.1 is each lawyer's decision (and may depend on the person helped). The tracker never decides.
4. **Law students and non-lawyers.** The Bar rule does not apply to them. Whether a school counts these hours is for each school to say (the board asked: "ask each school"). The page says nothing about it yet.
5. **Retired, inactive or judicial lawyers.** The rule defers some members. The tracker does not check anyone's status.
6. **Rule 4-7.22 (the pro bono exemption in advertising)** was noted earlier as unverified; it is not used here.
7. **Retention.** Entries stay until the helper deletes them. Backups (nightly, 30 days) include them. Is that right for a record nobody else reads?
