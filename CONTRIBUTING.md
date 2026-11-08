# Contributing

Thank you for helping. Everyone is welcome, no matter who you are, where you come from or what you believe.

## Three rules

1. **Never post real case data.** No real names, case numbers, addresses, phone numbers, emails, documents, screenshots or stories from a real case. Not in code, not in issues, not in pull requests, not in test files. Use made-up data only, like the sample case in `src/sample-case.js`. If you see real data here, do not copy it: report it privately (see [SECURITY.md](SECURITY.md)) so it can be removed.
2. **No legal advice.** Not in issues, discussions, code comments or guides. Guides explain in plain words and say when to talk to a lawyer. Licensed Florida lawyers review guides before they go out.
3. **Be kind.** Disagree with ideas, never with people.

## How to help

- Open an issue to suggest an idea, report a bug, or say what you want to work on.
- Keep pull requests small and about one thing.
- Write in plain language. Short sentences. English and Spanish when the text is for people using the app.
- New features that touch case data must follow [docs/access-model.md](docs/access-model.md): the server checks the case's access list on every request.
- AI features organize and find. They never tell a person what to do about their case.

## Before you open a pull request

```bash
npm test
```

This runs the tests and a check that looks for things that must never be here (email addresses, account ids, tokens). It needs no install.

To change the sample documents, edit `scripts/build-sample.mjs` and run:

```bash
node scripts/build-sample.mjs
```

## Libraries

Third-party libraries are copied into `vendor/` folders at a fixed version, with their licenses. Do not load new code from a CDN at runtime. Ask in an issue before adding a library.

---

## En español

Gracias por ayudar. Todos son bienvenidos.

1. **Nunca publique datos de un caso real.** Ni nombres, ni números de caso, ni documentos, ni capturas de pantalla. Use solo datos inventados, como el caso de ejemplo.
2. **Nada de consejo legal.** Las guías explican con palabras sencillas y dicen cuándo hablar con un abogado.
3. **Sea amable.**

Antes de enviar cambios, ejecute `npm test`.
