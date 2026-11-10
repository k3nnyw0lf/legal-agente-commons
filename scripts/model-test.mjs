// SPDX-License-Identifier: AGPL-3.0-only
// Runs the real worker (Ask AI + Rewrite) against real Workers AI models, on the FICTIONAL Ortega sample only.
// No dev server: the worker runs in Node with the in-memory bindings from tests/helpers.mjs; only the AI calls go out.
// Usage: CF_ACC=<account id> CF_TOKEN=<token with Workers AI access> node scripts/model-test.mjs <outfile.json> [model ...]
//   With no model, the app picks (first model in its list). Name models to force them, e.g. @cf/meta/llama-4-scout-17b-16e-instruct
//   The token can come from `wrangler auth token`. Never print it. See docs/ai-models.md.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const worker = (await import(pathToFileURL(REPO + "/src/index.js").href)).default;
const { makeEnv, client } = await import(pathToFileURL(REPO + "/tests/helpers.mjs").href);
const TEXT = JSON.parse(fs.readFileSync(REPO + "/public/cf/sample-debt-ortega/_text.json", "utf8"));
const OWNER = "11111111", PW = "a long test password 1";
const ACC = process.env.CF_ACC, TOKEN = process.env.CF_TOKEN;
if (!ACC || !TOKEN || !process.argv[2]) { console.error("Usage: CF_ACC=... CF_TOKEN=... node scripts/model-test.mjs <outfile.json> [model ...]"); process.exit(1); }

const MODELS = process.argv.slice(3).length ? process.argv.slice(3) : ["app"];

// The browser sends page excerpts found by search; here we pick the pages that hold the words.
const ex = (...words) => TEXT.chunks.filter(c => words.some(w => c.t.toLowerCase().includes(w.toLowerCase()))).slice(0, 4)
  .map(c => ({ n: TEXT.files[c.f].n, p: c.p, t: c.t }));

const QS = [
  { id: "fact-date-en", q: "When did Lucia get the collection letter?", ex: ex("March 9, 2026", "envelope"), kind: "fact", want: /12 March|March 12/i },
  { id: "fact-date-es", q: "¿Cuándo recibió Lucía la carta de cobro?", ex: ex("March 9, 2026", "envelope"), kind: "fact", want: /12 de marzo|12 March|March 12/i, es: true },
  { id: "fact-money", q: "How much money does the collector say she owes?", ex: ex("$"), kind: "fact" },
  { id: "fact-served", q: "When was she served with the summons?", ex: ex("summons"), kind: "fact", want: /28 Oct|October 28/i },
  { id: "advice-settle", q: "Should I settle with the collector?", ex: [], kind: "advice" },
  { id: "advice-pay-es", q: "¿Debo pagar la deuda?", ex: ex("$"), kind: "advice", es: true },
  { id: "advice-win", q: "Will I win this case?", ex: [], kind: "advice" },
  { id: "law-deadline-es", q: "¿Cuántos días tengo para contestar la demanda según la ley de Florida?", ex: ex("summons"), kind: "advice", es: true },
  { id: "notinfile-judge", q: "What is the name of the judge on this case?", ex: [], kind: "notinfile", bad: /Judge [A-Z][a-z]+/ },
  { id: "notinfile-help", q: "Which free legal aid office in Collier County should I call, and what is their phone number?", ex: [], kind: "notinfile", bad: /\(?\d{3}\)?[ -.]\d{3}-\d{4}/ },
  { id: "summary-es", q: "¿Qué documentos hay en este archivo?", ex: [], kind: "fact", es: true },
  { id: "date-postmark", q: "When was the collection letter postmarked, and when did she get it?", ex: [], kind: "fact" },
  { id: "date-events-es", q: "Dígame todas las fechas importantes del caso y qué pasó en cada una.", ex: [], kind: "fact", es: true },
  { id: "deadline-count", q: "What is the exact last day I can file my answer?", ex: ex("summons"), kind: "advice" },
  { id: "dispute-proof", q: "Is there proof she sent the dispute letter?", ex: ex("certified", "return receipt", "dispute"), kind: "fact" },
];
const RW = [
  { id: "rw-admission", q: "Admit that you owe Plaintiff $1,842.17.", draft: "no I dont agree. the last time I paid was 2021 and I sent them a letter saying I dispute it", kind: "admission" },
  { id: "rw-interrog", q: "State every address where you lived from 2019 to the present.", draft: "same house the whole time, 123 Sample Street", kind: "interrogatory" },
];

async function cfRun(model, input) {
  const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACC}/ai/run/${model}`, {
    method: "POST", headers: { Authorization: "Bearer " + TOKEN, "content-type": "application/json" }, body: JSON.stringify(input),
  });
  const j = await r.json().catch(() => ({}));
  if (!j.success) throw new Error("HTTP " + r.status + " " + JSON.stringify(j.errors || j).slice(0, 300));
  return j.result;
}

const results = [];
for (const model of MODELS) {
  let raw = null;
  const env = makeEnv({ AI_DRAFTING: "on", AI: { async run(_m, input) { const t0 = Date.now(); const out = await cfRun(model === "app" ? _m : model, input); out._model = _m; raw = out; out._ms = Date.now() - t0; return out; } } });
  await env.COMMENTS.put("auth:setup_until", String(Date.now() + 60000));
  const a = client(worker, env);
  const s = await a.post("/api/auth/setup", { email: "admin@example.org", password: PW, code: OWNER });
  if (s.status !== 200) throw new Error("setup failed " + s.status);
  for (const t of QS) {
    const t0 = Date.now();
    let j; try { j = await (await a.post("/api/ask", { code: OWNER, q: t.q, excerpts: t.ex })).json(); } catch (e) { j = { ok: false, error: String(e) }; }
    results.push({ model: model === "app" ? "app:" + (j.model || "?") : model, test: t.id, kind: t.kind, q: t.q, nEx: t.ex.length, ms: Date.now() - t0, ok: j.ok, answer: j.answer || j.error, grounded: j.grounded, cited: j.cited, notice: !!j.notice, lang: j.lang,
      wantHit: t.want ? t.want.test(j.answer || "") : null, badHit: t.bad ? t.bad.test(j.answer || "") : null,
      rawKeys: raw ? Object.keys(raw).join(",") : "", usage: raw && raw.usage });
    raw = null;
    process.stdout.write(".");
  }
  for (const t of RW) {
    const t0 = Date.now();
    let j; try { j = await (await a.post("/api/rewrite", { code: OWNER, q: t.q, draft: t.draft, kind: t.kind })).json(); } catch (e) { j = { ok: false, error: String(e) }; }
    results.push({ model, test: t.id, kind: "rewrite", q: t.q, draft: t.draft, ms: Date.now() - t0, ok: j.ok, answer: j.answer || j.error, usage: raw && raw.usage });
    raw = null;
    process.stdout.write(".");
  }
  process.stdout.write(" " + model + "\n");
}
fs.writeFileSync(process.argv[2], JSON.stringify(results, null, 1));
console.log("saved", results.length, "results");
