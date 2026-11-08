# Legal Agente Commons

**English** · [Español](#español)

Free, open tools that help people in Florida put their legal case in order, so volunteer lawyers can help them faster.

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
- **Email into a case** through private addresses.
- **Reading aid** (`read-aid.js`) and a Spanish interface.
- A **fictional sample case**: a Florida debt-collection dispute with six made-up documents (`src/sample-case.js`, `public/cf/sample-debt-ortega/`).

See [docs/architecture.md](docs/architecture.md) for a map of the files.

## AI features

The AI organizes and finds. **It never gives legal advice.**

- "Ask AI" answers only from the case file and says that a lawyer must answer questions about what to do.
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
- Reading help for people with dyslexia
- Spanish translation
- Privacy and security review
- The pieces still to build in [docs/access-model.md](docs/access-model.md#still-to-build)
- Licensed Florida lawyers: review the guides before they go out

Read [CONTRIBUTING.md](CONTRIBUTING.md) first. Found a security problem? Read [SECURITY.md](SECURITY.md) and report it privately.

## Ground rules

- Never post real case details, names, or documents here.
- No legal advice in issues or discussions.
- Everyone is welcome, no matter who they are or what they believe. Be kind.
- Ideas are welcome. Open an issue and tell us.

Legal Agente is not a law firm and does not give legal advice.

**License:** to be decided. See [LICENSE](LICENSE). Libraries in `vendor/` folders keep their own licenses; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

---

## Español

Herramientas abiertas y gratis para que la gente en Florida ponga su caso legal en orden, y los abogados voluntarios puedan ayudar más rápido.

> **Todo en este repositorio es inventado.** El único caso aquí es un ejemplo ficticio. Nunca agregue un caso real, un nombre real ni un documento real.

**Dónde estamos:** al comienzo. Se está creando una organización sin fines de lucro en Florida. Esta es la primera versión limpia del organizador de casos, hecha a partir de una aplicación privada sin ningún dato de casos reales. Todavía no ha tenido una revisión de seguridad externa. No está lista para casos reales.

**Por qué:** la ayuda legal gratis existe, pero está dispersa y es difícil de alcanzar. Los voluntarios pierden horas ordenando papeles antes de poder aconsejar. Un expediente en orden cambia eso.

**Qué hay aquí:** una aplicación que pone un caso en orden: acceso seguro (contraseña, código de 6 dígitos y llaves de acceso), cronología, mapa de personas, dinero, leyes, mapa de pruebas, documentos con visor, huellas de los archivos, búsqueda en cada página (también por significado, en inglés y español), revisión de citas, correo al caso, ayuda de lectura e interfaz en español. Incluye un caso de ejemplo inventado: una disputa de cobro de deudas en Florida.

**La IA organiza y encuentra. Nunca da consejo legal.** La función que redacta respuestas está apagada a menos que un abogado decida encenderla.

**Quién ve un caso:** solo las personas que están en el caso. Vea [docs/access-model.md](docs/access-model.md) (en inglés).

**Cómo puede ayudar hoy:** guías sencillas en inglés y español, el diseño de un formulario fácil para el teléfono, ayuda de lectura para personas con dislexia, traducción, y revisión de privacidad y seguridad. Los abogados con licencia en Florida pueden revisar las guías antes de publicarlas.

**Reglas:** nunca publique detalles, nombres ni documentos de un caso real. Nada de consejo legal aquí. Todos son bienvenidos, sin importar quiénes sean ni lo que crean. Sea amable. Las ideas son bienvenidas: abra un "issue" y cuéntenos.

¿Encontró un problema de seguridad? Avísenos en privado (vea [SECURITY.md](SECURITY.md)).

Legal Agente no es un bufete de abogados y no da consejo legal.

**Licencia:** por decidir.
