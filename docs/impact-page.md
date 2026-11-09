# Public impact page

Page `/impact` (no sign-in). It shows how many cases the program has, **by kind of case and by county**. Counts only. It never shows a name, a case number or a case code, and it **never asks for money** (no donate button until the nonprofit is registered with FDACS, per the plan).

## The rules, in code (`public/impact.mjs`, tested)

- **Only real cases count.** The fictional sample case is never counted. A case counts only if it has both a **kind** (one of 10) and a **county** (one of Florida's 67) chosen on the admin page when it was made. Anything else is left out.
- **Fewer than 10 real cases in all: "Not enough cases yet."** No number at all, in either list. With only the sample case, this is what shows.
- **Any count under 10 is shown as "fewer than 10"**, never as a number, in English and Spanish ("menos de 10").
- **The total is shown only when nothing is hidden**, so a hidden count cannot be worked out by subtraction. A test tries 200 random mixes and checks that no number under 10 can be read anywhere in the answer.
- The answer has a fixed shape (`ok, enough, min, total, byType, byCounty, updated`): nothing else can leak into it.
- The page is `noindex` for now, like the other public pages.

## Where the numbers come from

`GET /api/impact` reads the cases added from the admin page (KV `case:<code>`) and uses only `data.caseType`, `data.county` and `data.fictional`. It does not read titles, files or notes. The admin "Add a case" form has two new lists, **Kind of case** and **County** (both optional; a value that is not on the list is refused).

## Open questions for counsel

1. **Is 10 the right floor?** Some privacy guidance uses other numbers (and rounding). For a small county, even "12" may point to a person. Should small counties be grouped (for example by region)?
2. **Which kinds of case** should be public, and are the names right? (The list is a draft: debt, rent and eviction, foreclosure, benefits, family, other consumer, immigration, association, taxes, other.)
3. **Should the page say anything about outcomes** ("cases handed to a person", "cases closed")? Left out on purpose: only counts of cases.
4. **Publishing.** The page is live in the code but `noindex`. When should it be linked from the home page for everyone and opened to search engines? (A link in the footer exists.)
5. **Donations.** None. When the nonprofit is registered with FDACS, how should a donate link be added, and should it sit on this page at all?
