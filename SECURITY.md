# Security

This app is meant to hold people's legal cases. A security problem here can hurt real people, so please report problems **privately**.

## How to report

- **Do not open a public issue** for a security problem, and do not post details anywhere public.
- Use GitHub's private vulnerability reporting for this repository: the **Security** tab, then **Report a vulnerability**.
- Tell us what you found, how to reproduce it, and what it could expose. Use made-up data in your report.
- If you found **real case data** in this repository (a real name, document or case number), report it the same way. Do not copy it, share it or open it more than you need to.

We will answer as soon as we can, work on a fix, and tell you when it is fixed. Please give us time to fix it before you talk about it publicly.

The same details are in a [`security.txt`](https://www.rfc-editor.org/rfc/rfc9116) file (RFC 9116). The template is [`docs/security.txt.template`](docs/security.txt.template); it goes live at `/.well-known/security.txt` once the project has its public address.

## What counts

Anything that could let someone see a case they are not on, change a file or a log without a trace, sign in as someone else, or get around the "no legal advice" rule in the AI features. If you are not sure, report it.

## Where you may test

- **Only on your own demo copy with made-up data.** Run this repo yourself and use the sample case.
- **Never the real system.** Do not test, scan or probe any live deployment, and never try to open a real person's case.
- Do not try to trick, phish or pressure the people who run the project.

## Thank you, not cash

We are a volunteer nonprofit. We do not pay cash rewards. With your permission, we add your name (or handle) to the thank-you list below when a report you sent is fixed.

### Thank-you list

No reports yet.

## Safe harbor

> **Draft, for counsel review.** This wording is not final until a Florida lawyer approves it.
>
> If you follow this policy (you test only your own demo copy with made-up data, you never touch a live deployment or a real person's case, you report privately and give us time to fix the problem), we will treat your work as welcome and done in good faith, and we will not ask anyone to take legal action against you for it.

---

## En español

Si encuentra un problema de seguridad, **no lo publique**. Use el informe privado de GitHub (pestaña **Security**, luego **Report a vulnerability**). Si ve datos de un caso real en este repositorio, avísenos de la misma forma, sin copiarlos ni compartirlos.

Pruebe **solo en su propia copia de demostración, con datos inventados**. Nunca en el sistema real. No pagamos recompensas en dinero; con su permiso, ponemos su nombre en la lista de agradecimientos.
