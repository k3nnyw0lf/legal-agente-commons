# Legal Agente Commons

**English** · [Español](#español)

Free, open tools that help people in Florida put their legal case in order, so volunteer lawyers can help them faster.

*The name: Legal Agent-e, with the e for electronic. In Spanish, "agente" simply means agent.*

> **Everything in this repo is made up.** The only case here is a fictional sample. Never add a real case, a real name or a real document.

## Where we are

Early. A Florida nonprofit is being formed. This is the first clean starter of the case organizer, built from a private app with all real case data removed. It has not had an outside security review yet. It is not ready for real cases.

## Why

Free legal help exists, but it is scattered and hard to reach. Volunteers lose hours sorting papers before they can give advice. Organized files change that.

## What is in here

A Cloudflare Worker app that keeps one case in order:

- **Sign-in** with password, 6-digit authenticator codes (2-step) and passkeys. Invites for helpers.
- **Roles and case codes.** Each case opens with its own code on top of sign-in. See [docs/access-model.md](docs/access-model.md) for who should see what, and how far today's code is from that.
- **The case screen:** overview, timeline (list and zoomable), people map, connected web, money, laws, proof map, case files, letters, public portals, requests between lawyer and client, deadlines with a private calendar link, notes.
- **Document viewer** for PDFs, photos, text and recordings, opening at the right page. Exhibit binder with Bates numbers and redaction.
- **File fingerprints** (SHA-256) kept in a chained log, so a changed file shows up.
- **Search** inside every page (words, and by meaning in English and Spanish), OCR for scans, speech to text for recordings.
- **Citation check** that sends only the citations to CourtListener (Free Law Project).
- **Dates found in the papers:** every full date written on a page is added to the timeline, linked to that page, for people to check. Nothing is calculated. Each date has a box to tick once checked against the page, and a button that saves a calendar file on the person's own device ("Add to my calendar"). Nothing is sent: no texts, no emails.
- **What is this letter?** A public page (`/letter`): a photo of a letter goes through OCR on the phone, and the helper says what kind of paper it is, which dates are on it (each next to its piece of the photo) and who can help, from an approved list. It never says what to do. Social Security numbers are blacked out before anything is saved. See [docs/letter-check.md](docs/letter-check.md).
- **One-page summary for a volunteer:** who's who, key events with page links, calendar dates as entered, open requests and missing pages, ready to print. It leaves out phone numbers and addresses.
- **Who opened my file:** the owner of a case sees every view (who, when, what, no device addresses), kept 90 days, and can cut off any helper with one tap.
- **Volunteer training and quiz:** a 15-minute training (privacy, the no-advice line, conflicts) and a quiz. A helper cannot open a case until they pass. **Draft for counsel review.** See [docs/volunteer-training.md](docs/volunteer-training.md).
- **My pro bono hours:** helpers log time per case and download a year-end report. Private to the helper; never a score. See [docs/pro-bono-hours.md](docs/pro-bono-hours.md).
- **Lawyer-ready binder:** one tap makes a PDF with a cover, an index with page numbers, the summary, the timeline and every paper in the case. No phone numbers or addresses unless the person turns them on.
- **Email into a case** through private addresses.
- **Reading aid** (`read-aid.js`) and a Spanish interface.
- A **fictional sample case**: a Florida debt-collection dispute with six made-up documents (`src/sample-case.js`, `public/cf/sample-debt-ortega/`).

See [docs/architecture.md](docs/architecture.md) for a map of the files.

## AI features

The AI organizes and finds. **It never gives legal advice.**

- "Ask AI" answers only from the case file and the pages it was given. The server enforces this in code: it removes any page number the AI was not given, flags an answer that cites no page, and adds a fixed notice (English or Spanish) when a question asks what to do. The AI answers in the language of the question.
- "Find dates & people" lists what a document says.
- "Rewrite with AI" (drafting discovery answers) is **off** unless a deployment sets `AI_DRAFTING = "on"`. A lawyer decides whether it stays.

## Try it

You need [Node.js](https://nodejs.org) 22 or newer. Nothing to install for the tests.

```bash
npm test
```

To run the app itself you need Cloudflare's `wrangler` and your own Cloudflare account. Copy `wrangler.example.toml` to `wrangler.toml`, fill in your own ids, and read the comments in it. The sample case opens with code `11111111` (client view) or `22222222` (lawyer view).

## How you can help

- Plain-language guides in English and Spanish (debt collection first)
- Design of a simple, phone-friendly intake form
- A phone helper app, so helpers can give spare minutes to cases
- Reading help for people with dyslexia, and an accessibility check (WCAG 2.2 AA)
- Translation: Spanish first, then Haitian Creole, Portuguese and any language you speak
- Privacy and security review
- Licensed Florida lawyers: review the guides before they go out

You do not need to code. Starter tasks: [docs/starter-issues.md](docs/starter-issues.md). Everything still to build: [docs/roadmap.md](docs/roadmap.md).

Read [CONTRIBUTING.md](CONTRIBUTING.md) first. Found a security problem? Read [SECURITY.md](SECURITY.md) and report it privately.

## Ground rules

- Never post real case details, names, or documents here.
- No legal advice in issues or discussions.
- Everyone is welcome, no matter who they are or what they believe. Be kind.
- Ideas are welcome. Open an issue and tell us.

Legal Agente is not a law firm and does not give legal advice.

## License

- **Code:** [GNU Affero General Public License v3.0](LICENSE) (`AGPL-3.0-only`). If you run a changed version of this app for other people over a network, you must offer them its source code.
- **Guides and other writing:** license still to be decided (likely Creative Commons).
- **Libraries** in `vendor/` folders keep their own licenses and notices; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
- Counsel will confirm these choices.

---

## Español

Herramientas abiertas y gratis para que la gente en Florida ponga su caso legal en orden, y los abogados voluntarios puedan ayudar más rápido.

*El nombre: Legal Agent-e, con la e de electrónico. Y en español, "agente" es simplemente agente.*

> **Todo en este repositorio es inventado.** El único caso aquí es un ejemplo ficticio. Nunca agregue un caso real, un nombre real ni un documento real.

**Dónde estamos:** al comienzo. Se está creando una organización sin fines de lucro en Florida. Esta es la primera versión limpia del organizador de casos, hecha a partir de una aplicación privada sin ningún dato de casos reales. Todavía no ha tenido una revisión de seguridad externa. No está lista para casos reales.

**Por qué:** la ayuda legal gratis existe, pero está dispersa y es difícil de alcanzar. Los voluntarios pierden horas ordenando papeles antes de poder aconsejar. Un expediente en orden cambia eso.

**Qué hay aquí:** una aplicación que pone un caso en orden: acceso seguro (contraseña, código de 6 dígitos y llaves de acceso), cronología, mapa de personas, dinero, leyes, mapa de pruebas, documentos con visor, huellas de los archivos, búsqueda en cada página (también por significado, en inglés y español), revisión de citas, fechas encontradas en los papeles (cada una con su página), resumen de una página para el voluntario, correo al caso, ayuda de lectura e interfaz en español. Incluye un caso de ejemplo inventado: una disputa de cobro de deudas en Florida.

**La IA organiza y encuentra. Nunca da consejo legal.** La función que redacta respuestas está apagada a menos que un abogado decida encenderla.

**Quién ve un caso:** solo las personas que están en el caso. Vea [docs/access-model.md](docs/access-model.md) (en inglés).

**Cómo puede ayudar hoy:** guías sencillas en inglés y español, el diseño de un formulario fácil para el teléfono, una aplicación de teléfono para que los voluntarios ayuden en sus minutos libres, ayuda de lectura para personas con dislexia, revisión de accesibilidad, traducción (español primero, luego criollo haitiano, portugués y cualquier idioma que usted hable), y revisión de privacidad y seguridad. No hace falta programar. Los abogados con licencia en Florida pueden revisar las guías antes de publicarlas. Tareas para empezar: [docs/starter-issues.md](docs/starter-issues.md) (en inglés).

**Reglas:** nunca publique detalles, nombres ni documentos de un caso real. Nada de consejo legal aquí. Todos son bienvenidos, sin importar quiénes sean ni lo que crean. Sea amable. Las ideas son bienvenidas: abra un "issue" y cuéntenos.

¿Encontró un problema de seguridad? Avísenos en privado (vea [SECURITY.md](SECURITY.md)).

Legal Agente no es un bufete de abogados y no da consejo legal.

**Licencia:** el código usa la licencia GNU AGPL v3.0 ([LICENSE](LICENSE)). Las guías y otros textos tendrán una licencia por decidir (probablemente Creative Commons). Un abogado confirmará estas decisiones.
