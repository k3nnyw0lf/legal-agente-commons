// SPDX-License-Identifier: AGPL-3.0-only
// Ask AI rules enforced in code, dates found in the papers, and the one-page summary for a volunteer.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import worker from "../src/index.js";
import { makeEnv, client, ROOT } from "./helpers.mjs";
import { adviceAsked, isSpanish, checkCites, ADVICE_NOTICE } from "../src/grounding.js";
import { findDates, paperDates, PAPER_DATES_PHASE } from "../src/paper-dates.js";
import { buildBrief, renderBrief } from "../public/brief.mjs";
import { SAMPLE_CASES } from "../src/sample-case.js";

const OWNER = "11111111", LAWYER = "22222222", PW = "a long test password 1";
const SAMPLE = SAMPLE_CASES[OWNER].data;
const TEXT = JSON.parse(fs.readFileSync(path.join(ROOT, "public/cf/sample-debt-ortega/_text.json"), "utf8"));

async function adminSession(env) {
  await env.COMMENTS.put("auth:setup_until", String(Date.now() + 60000));
  const a = client(worker, env);
  const r = await a.post("/api/auth/setup", { email: "admin@example.org", password: PW, code: OWNER });
  assert.equal(r.status, 200, await r.clone().text());
  return a;
}

// ---------- dates found in the papers ----------

test("findDates reads English, Spanish, US and ISO dates, and drops impossible ones", () => {
  const iso = s => findDates(s).map(d => d.iso);
  assert.deepEqual(iso("Dated March 9, 2026."), ["2026-03-09"]);
  assert.deepEqual(iso("Postmark: MAR 10 2026"), ["2026-03-10"]);
  assert.deepEqual(iso("on 9 Mar 2026 and 9 March, 2026 and the 9th of March 2026"), ["2026-03-09", "2026-03-09", "2026-03-09"]);
  assert.deepEqual(iso("Recibido el 9 de marzo de 2026"), ["2026-03-09"]);
  assert.deepEqual(iso("Date of delivery: 03/24/2026"), ["2026-03-24"]);
  assert.deepEqual(iso("filed 2026-06-01"), ["2026-06-01"]);
  assert.deepEqual(iso("2/30/2026, 2026-02-29, 13/01/2026, March 9, 1899"), [], "no 30 February, no 29 February 2026, no month 13, no year before 1950");
  assert.deepEqual(iso("2024-02-29"), ["2024-02-29"], "a real leap day is kept");
  assert.deepEqual(iso("Got this in the mail on March 12."), [], "a date with no year is not guessed");
});

test("paperDates lists dates from the sample papers, linked to the page, and skips ones already on the timeline", () => {
  const ev = paperDates(TEXT.files, TEXT.chunks, { cf: SAMPLE.cf, timeline: SAMPLE.timeline });
  const apr13 = ev.find(e => e.d === "13 Apr 2026");
  assert.ok(apr13, "the 'dispute by April 13, 2026' line in Doc 1 is found");
  assert.match(apr13.t, /dispute/);
  assert.equal(apr13.u, "/cf/sample-debt-ortega/01-collection-letter.pdf#page=1");
  assert.match(apr13.s, /found by the computer, check it/);
  assert.equal(apr13.auto, 1);
  assert.ok(ev.find(e => e.d === "10 Mar 2026" && /#page=2$/.test(e.u)), "the envelope postmark on page 2");
  assert.ok(!ev.some(e => e.d === "9 Mar 2026" && /01-collection-letter/.test(e.u)), "9 Mar 2026 in Doc 1 is already on the timeline");
  assert.ok(!ev.some(e => e.d === "28 Oct 2026"), "service date is already on the timeline for Doc 5");
  const sorted = ev.map(e => e.iso);
  assert.deepEqual(sorted, [...sorted].sort(), "in date order");
  assert.equal(new Set(ev.map(e => e.iso + e.u)).size, ev.length, "no repeats");
  assert.equal(paperDates(TEXT.files, TEXT.chunks, { cf: SAMPLE.cf, max: 3 }).length, 3, "max is respected");
});

test("opening the case adds the 'Dates found in the papers' phase to the timeline", async () => {
  const env = makeEnv(), a = await adminSession(env);
  const j = await (await a.post("/api/case", { code: OWNER })).json();
  const ph = j.case.timeline.find(p => p.phase === PAPER_DATES_PHASE);
  assert.ok(ph && ph.auto && ph.events.length > 0);
  assert.ok(ph.events.some(e => e.d === "13 Apr 2026"));
  const lv = await (await a.post("/api/case", { code: LAWYER })).json();
  assert.ok(lv.case.timeline.some(p => p.phase === PAPER_DATES_PHASE), "the lawyer view gets it too");
});

// ---------- Ask AI: rules enforced in code ----------

test("advice questions are spotted in English and Spanish; plain fact questions are not", () => {
  for (const q of ["Should I settle?", "Will I win this case?", "What should I do now?", "Do I have to pay this?", "Can I sue them?"]) assert.ok(adviceAsked(q), q);
  for (const q of ["¿Debo pagar la deuda?", "¿Voy a ganar?", "¿Qué hago ahora?", "¿Tengo que ir a la corte?", "¿Necesito un abogado?"]) assert.ok(adviceAsked(q), q);
  for (const q of ["When did the letter arrive?", "How much does the letter ask for?", "¿Cuándo llegó la carta?"]) assert.ok(!adviceAsked(q), q);
  assert.ok(isSpanish("¿Cuándo llegó la carta?"));
  assert.ok(!isSpanish("When did the letter arrive?"));
  assert.match(ADVICE_NOTICE.es, /Comparta/, "Spanish notice uses usted");
});

test("checkCites keeps only pages the AI was given", () => {
  const g = checkCites("The letter asks for $1,842.17 [1]. The fees are $200.00 [2]. It was signed by the judge [7].", 2);
  assert.deepEqual(g.cited, [1, 2]);
  assert.deepEqual(g.removed, [7]);
  assert.ok(!/\[7\]/.test(g.text));
  assert.match(g.text, /judge\.$/);
  assert.equal(g.grounded, true);
  assert.equal(checkCites("No page here.", 3).grounded, false);
  assert.equal(checkCites("Made up [1].", 0).grounded, false, "with no excerpts, no citation is real");
});

test("Ask AI: a Spanish advice question gets the Spanish notice, and made-up citations are removed", async () => {
  const env = makeEnv({ AI: { _calls: [], async run(model, input) { this._calls.push({ model, input }); return { response: "La carta pide $1,842.17 [1]. El juez firmó [9]." }; } } });
  const a = await adminSession(env);
  const ex = [{ n: "Doc 1 · Collection letter", p: 1, t: "Total amount of the debt now $1,842.17" }];
  const j = await (await a.post("/api/ask", { code: OWNER, q: "¿Debo pagar la deuda?", excerpts: ex })).json();
  assert.equal(j.ok, true);
  assert.equal(j.lang, "es");
  assert.equal(j.notice, ADVICE_NOTICE.es);
  assert.deepEqual(j.cited, [1]);
  assert.equal(j.grounded, true);
  assert.ok(!/\[9\]/.test(j.answer));
  assert.match(env.AI._calls[0].input.messages[0].content, /Spanish, using usted/);
  const f = await (await a.post("/api/ask", { code: OWNER, q: "When did the letter arrive?" })).json();
  assert.equal(f.notice, "", "no notice for a plain fact question");
  assert.equal(f.lang, "en");
});

// ---------- one-page summary for a volunteer ----------

test("the one-page summary has the key facts, links with the case code, and no phone numbers or addresses", () => {
  const b = buildBrief(SAMPLE, { origin: "https://example.org", code: OWNER });
  assert.equal(b.fictional, true);
  assert.ok(b.events.length > 0 && b.events.length <= 8);
  assert.ok(b.events.some(e => e.flag === "!"), "disputed events are kept");
  const withLink = b.events.find(e => e.href);
  assert.match(withLink.href, /^https:\/\/example\.org\/cf\/sample-debt-ortega\/.+\?code=11111111(#page=\d+)?$/);
  assert.equal(b.asks.length, 2, "requests marked Done are left out");
  assert.deepEqual(b.gaps.map(g => g.el), ["A paper that explains the $200.00 difference"]);
  assert.equal(b.contactNote, "Prefers Spanish. Calls after 5 PM.");
  assert.ok(b.calendar.some(c => c.confirm), "calendar dates keep their 'to confirm' mark");
  const en = renderBrief(b, "en"), es = renderBrief(b, "es");
  for (const h of [en, es]) {
    assert.ok(!/\(\d{3}\)\s?\d{3}-\d{4}/.test(h), "no phone numbers");
    assert.ok(!/Sample Street|Placeholder Avenue/.test(h), "no addresses");
    assert.ok(!/<script/i.test(h), "no scripts");
  }
  assert.match(en, /Not legal advice/);
  assert.match(en, /FICTIONAL SAMPLE/);
  assert.match(es, /No es asesoría legal/);
  assert.match(es, /Quién es quién/);
  assert.match(es, /<html lang="es">/);
});

test("the Spanish one-page summary writes calendar dates with Spanish month names", () => {
  const b = buildBrief(SAMPLE, { origin: "https://example.org", code: OWNER });
  assert.match(renderBrief(b, "es"), /12 nov\.? 2026/i);
  assert.match(renderBrief(b, "en"), /12 Nov 2026/);
});

test("the one-page summary escapes what it shows", () => {
  const b = buildBrief({ title: "<img src=x onerror=alert(1)>Case", nodes: { a: { nm: 'Tom & "Jerry" <3', rl: "x" } }, timeline: [] });
  const h = renderBrief(b, "en");
  assert.ok(!/<img/.test(h), "tags are removed");
  assert.match(h, /Tom &amp; &quot;Jerry&quot; &lt;3/, "text is escaped");
});

test("the app has the summary button, loads the module, and the new Spanish strings", () => {
  const html = fs.readFileSync(path.join(ROOT, "public/app.html"), "utf8");
  const js = fs.readFileSync(path.join(ROOT, "public/app-plus.js"), "utf8");
  assert.match(html, /id="briefbtn"/);
  assert.match(js, /import\('\/brief\.mjs'\)/);
  assert.match(js, /'Dates found in the papers \(check each one\)': 'Fechas encontradas/);
  assert.match(js, /'No page was cited for this answer\./);
});
