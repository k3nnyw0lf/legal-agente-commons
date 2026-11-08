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
| **Notified helper** (offered a task, not yet answered) | A preview with no names: the kind of case, the county, the task, the language, the deadline. No names, no documents. | When they accept or decline. |
| **Matched helper** (accepted a task) | Only the parts of the case their task needs. A helper asked to review a summons sees the summons, not the whole file. | When the task closes. Access stops on its own. |
| **Supervising lawyer** | The cases in their own program. | When the case leaves their program. |
| **Program lead** | Status only: open, matched, waiting, closed, dates. No documents, no notes. | While they lead the program. |
| **Ken (founder) and tech staff** | Nothing, as routine. | Not applicable. |
| **Board, donors, builders** | Never any case data. Builders work only with made-up data like the sample case. | Not applicable. |

### Emergency access

Sometimes a person on the tech team must look inside a case to fix a real problem. Then:

1. A second person approves it first.
2. The access is logged: who, when, which case, why.
3. The client is told.
4. Access ends when the fix is done.

## Every view is logged

- Every time someone opens a case, a file or a page of search results, the server writes it down: who, when, what.
- The client can see that log for their own case: "who opened my file, and when."
- Nobody can edit or delete the log. (The file fingerprint log in this repo already chains each row to the one before it; the access log should work the same way.)

## Helpers and scores

- Declining a task never lowers a helper's score. People say no for good reasons.
- Scores are never based on wins. A helper who takes hard cases must not look worse than one who takes easy ones.
- Scores can count things like: tasks finished on time, clients who say they understood the help, supervisor reviews.

## What the code does today

Be honest about the gap. Today's code came from a one-person app, so:

- **An admin can open every case.** That breaks the rule above. It must change before any real case is added.
- Invited people (role `counsel`) open only the case codes on their invite. That part is close to a per-case list.
- A "lawyer view" code shows the same case without some tabs. That is a view, not an access list.
- The access log exists (D1 table `access_log`), but only admins can read it. The client cannot see it yet.
- There is no notified-helper preview, no task, no automatic end of access.
- Case codes are a second key on top of sign-in. They are not a replacement for an access list.

## Still to build

1. **Self sign-up and eligibility.** A person in Florida signs up, answers a few questions, and learns if the program can help.
2. **Intake and conflict check.** A trained student or staff member checks the file. The program checks for conflicts before any helper sees a name.
3. **Volunteer skills profile and matching.** Helpers list what they can do (areas of law, languages, counties, hours). The system suggests matches.
4. **Notify, accept, decline.** A helper gets a nameless preview, then accepts or declines. Declining never lowers a score.
5. **Helper scores.** Never based on wins. See above.
6. **Per-case access lists.** Enforced on the server for every route, with time limits per task, emergency access with a second approver, and a log the client can read.

Also needed before real cases: an outside security review, and a lawyer's review of every AI feature against the "never gives legal advice" rule (see [AI features](../README.md#ai-features)).
