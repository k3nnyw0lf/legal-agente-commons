# Which AI model Ask AI uses, and why

Ask AI and Rewrite call Cloudflare Workers AI. They try a list of models in order and use the first one that answers.

## The order (since November 2026)
1. `@cf/deepseek-ai/deepseek-v4.1-flash-1017`
2. `@cf/meta/llama-4-scout-17b-16e-instruct`, then the older Llama and Mistral models as before.

DeepSeek V4.1 Flash needs the Workers Paid plan. On a free Cloudflare account it fails, and Llama 4 Scout answers instead, so the app still works.

## Why this model
- **The benchmark that fits us** is the vals.ai **Access to Justice** board. It asks whether an AI can be the first stop for someone without a lawyer: ask about the situation, explain the law in general, and send the person to the right local help. It is built from real legal-aid questions and graded by legal-aid experts.
- **The November 2026 results** (vals.ai, read 2026-11-10):
  - The best model met 76.4% of the experts' criteria, and none reached their 80% bar.
  - DeepSeek V4.1 Flash met 73.1%. It was the highest-scoring model that runs on Workers AI.
  - Llama 4 Scout was not on the board.
- **Every model was weak at naming the right local help office** (30 to 50%). Do not let the model pick one: local help should come from a checked list in code.
- **Price:** about the same as Llama 4 Scout on Workers AI ($0.30 / $1.20 per million tokens in / out, November 2026).

## How it was tested
`scripts/model-test.mjs` runs the real worker in Node (no dev server) and sends 17 questions about the fictional Ortega sample case to real Workers AI models:
- Ask AI: facts, dates, money, advice questions (EN and ES), a deadline question, things not in the file
- Rewrite: two discovery answers

```bash
CF_ACC=<account id> CF_TOKEN="$(wrangler auth token)" node scripts/model-test.mjs results.json
```

Add model names at the end to force those models instead of the app's order.

What the tests found, and what changed in the code:
- **Dates:** models gave a date for the wrong event (the received date as the postmark date).
  - The sample timeline itself joined the two. It now names the postmark date.
  - The prompt now asks that every date name its event (dated, postmarked, received, served, filed).
- **Answers cut off:** DeepSeek thinks before it answers, and that hidden thinking counts against `max_tokens`.
  - Ask AI now asks for about 150 words and allows 2,500 tokens.
  - DeepSeek runs with `reasoning_effort: "low"` (see `aiOpts`).
- **Deadlines:** one model counted the days to a deadline by itself. The prompt now says never to count days, and to give the deadline only in the paper's words.
- **Phone numbers:** two models added phone numbers nobody asked for. The prompt now gives contact details only when asked.

Final run with DeepSeek first:
- 17 of 17 answered, in 1.5 to 12 seconds.
- Every advice question was sent to a lawyer.
- Nothing was made up, and no answer was cut off.

## Before you change the model
Run `scripts/model-test.mjs` on the old and the new model, then read every answer. A passing `npm test` does not test the model: the unit tests use a fake AI.
