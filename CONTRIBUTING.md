# Contributing

Thank you for helping. Everyone is welcome, no matter who you are, where you come from or what you believe.

## Three rules

1. **Never post real case data.** No real names, case numbers, addresses, phone numbers, emails, documents, screenshots or stories from a real case. Not in code, not in issues, not in pull requests, not in test files. Use **sample cases only**, like the made-up one in `src/sample-case.js`. If you see real data here, do not copy it: report it privately (see [SECURITY.md](SECURITY.md)) so it can be removed.
2. **No legal advice.** Not in issues, discussions, code comments or guides. Guides explain in plain words and say when to talk to a lawyer. Licensed Florida lawyers review guides before they go out.
3. **Be kind.** Disagree with ideas, never with people.

## You do not need to code

Non-coders are welcome, and needed:

- **Design:** screens, the phone intake form, the helper task cards.
- **Testing:** try the sample case on a phone and tell us what is hard.
- **Accessibility:** check screens against WCAG 2.2 AA, with a screen reader, big text and the dyslexia fonts.
- **Docs and guides:** plain-language guides (debt collection first).
- **Translation:** Spanish today; Haitian Creole, Portuguese and any language you speak next. See [Languages](docs/roadmap.md#10-languages).

Starter tasks are listed in [docs/starter-issues.md](docs/starter-issues.md).

## How changes get in

- Open an issue to suggest an idea, report a bug, or say what you want to work on.
- Keep pull requests small and about one thing.
- **Every change is reviewed by a maintainer** before it is merged.
- **Changes to sign-in, access or data need two reviewers.** That means anything touching sign-in, sessions, passkeys or 2-step codes, who can open a case, the access log, case files, uploads, backups, or anything that stores or sends case data.
- Write in plain language. Short sentences. English and Spanish when the text is for people using the app.
- New features that touch case data must follow [docs/access-model.md](docs/access-model.md): the server checks the case's access list on every request.
- AI features organize and find. They never tell a person what to do about their case.

## Sign off your commits

Every commit is signed off under the [Developer Certificate of Origin](https://developercertificate.org/) (DCO). It says you wrote the change, or have the right to send it, and that it can be shared under the project's license. Sign off with:

```bash
git commit -s
```

That adds a `Signed-off-by: Your Name <your email>` line. Use your real name or the name you are known by in the project.

## Before you open a pull request

```bash
npm test
```

This runs the tests and a check that looks for things that must never be here (email addresses, account ids, tokens). It needs no install.

If you changed a page, also run `node scripts/browser-test.mjs` (needs Chrome or Edge). It tests the real pages on a phone-sized screen. Add a scenario to `scripts/browser-scenarios.mjs` for anything new that a person can tap. Write the tests **before** the code, and use only made-up data.

To change the sample documents, edit `scripts/build-sample.mjs` and run:

```bash
node scripts/build-sample.mjs
```

## Libraries

Third-party libraries are copied into `vendor/` folders at a fixed version, with their licenses. Do not load new code from a CDN at runtime. Ask in an issue before adding a library.

---

## En español

Gracias por ayudar. Todos son bienvenidos, también quienes no programan: diseño, pruebas, accesibilidad, guías y traducción.

1. **Nunca publique datos de un caso real.** Ni nombres, ni números de caso, ni documentos, ni capturas de pantalla. Use solo casos de ejemplo inventados.
2. **Nada de consejo legal.** Las guías explican con palabras sencillas y dicen cuándo hablar con un abogado.
3. **Sea amable.**

Un responsable revisa cada cambio; los cambios de acceso, inicio de sesión o datos necesitan dos revisores. Firme sus commits con `git commit -s`. Antes de enviar cambios, ejecute `npm test`.
