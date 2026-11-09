// SPDX-License-Identifier: AGPL-3.0-only
// "¿Qué es esta carta?" The letter check: what kind of paper, which dates, who can help. It never says what to do.
// 26 made-up letters (tests/letters/letters.mjs) run on every change.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { LETTERS } from "./letters/letters.mjs";
import worker from "../src/index.js";
import { ROOT, makeEnv, client } from "./helpers.mjs";
import { analyzeLetter, sentences, quotes, redactSsn, ssnBoxes, sharpness, KINDS, HELPERS, APPROVED_HOSTS, RESULT_KEYS, UI } from "../public/letter-check.mjs";
import { onlyApproved, pickKind, DONT_KNOW, isSpanish } from "../src/grounding.js";

const ocr = L => ({ text: L.text, confidence: L.conf });

// Our own words must never tell anyone what to do, in either language. The paper's own words are quoted separately.
const ADVICE_ANYWHERE = [
  /\b(?:should|must|need to|needs to|have to|has to|had better|ought to|better to)\b/i,
  /\b(?:we|i) (?:recommend|suggest|advise|urge|encourage)\b/i,
  /\byou (?:can|may|could|will want to|might want to)\b/i,
  /\b(?:don't|do not|never|always) (?:ignore|pay|sign|call|respond|worry|panic|wait|delay)\b/i,
  /\b(?:debe|deben|deber[ií]a|deber[aá]|tiene que|tienen que|necesita|necesitan|hay que|le recomendamos|le aconsejamos|le sugerimos|puede usted|usted puede)\b/i,
  /\bno (?:ignore|pague|firme|se preocupe|responda|conteste|espere|llame)\b/i,
];
const IMPERATIVE_START = /(?:^|[.!?:]\s+)(?:pay|sign|call|respond|reply|answer|file|hire|contact|apply|appeal|dispute|fight|settle|ignore|go|bring|send|take|get|make|ask|talk|speak|visit|check|keep|try|read|compare|use|wait|act|worry|pague|firme|llame|responda|conteste|presente|apele|ignore|vaya|traiga|env[ií]e|tome|obtenga|haga|pregunte|hable|visite|revise|compare|guarde|use|espere|act[uú]e)\b/i;

test("26 made-up letters: kind, dates, time periods, who can help, hidden numbers", () => {
  assert.ok(LETTERS.length >= 20, "at least 20 letters");
  for (const L of LETTERS) {
    const r = analyzeLetter(ocr(L), { lang: L.lang });
    const e = L.expect;
    assert.equal(r.status, e.status, L.id + " status");
    assert.equal(r.kind ? r.kind.id : null, e.kind, L.id + " kind");
    assert.deepEqual(r.dates.map(d => d.iso), e.dates, L.id + " dates");
    assert.deepEqual(r.periods.map(p => p.text), e.periods, L.id + " periods");
    const ids = r.helpers.map(h => h.id);
    for (const h of e.helpers) assert.ok(ids.includes(h), L.id + " helper " + h + " in " + ids.join(","));
    if (!e.helpers.length) assert.deepEqual(ids, [], L.id + " no helpers for an unreadable photo");
    assert.equal(r.redactions, e.redacted, L.id + " hidden numbers");
  }
});

test("the answer has a fixed shape: no field for advice, next steps or recommendations", () => {
  for (const L of LETTERS) {
    const r = analyzeLetter(ocr(L), { lang: L.lang });
    assert.deepEqual(Object.keys(r).sort(), [...RESULT_KEYS].sort(), L.id);
  }
  assert.ok(!RESULT_KEYS.some(k => /advice|\bnext|\bsteps?\b|recommend|should|\baction/i.test(k)));
});

test("it never gives advice: nothing in its own words, in either language, tells anyone what to do", () => {
  for (const lang of ["en", "es"]) for (const L of LETTERS) {
    const r = analyzeLetter(ocr(L), { lang });
    const own = sentences(r, lang);
    assert.ok(own.length > 0, L.id);
    for (const s of own) {
      for (const re of ADVICE_ANYWHERE) assert.ok(!re.test(s), `${L.id}/${lang}: advice pattern ${re} in: ${s}`);
      assert.ok(!IMPERATIVE_START.test(s), `${L.id}/${lang}: sentence starts like an order: ${s}`);
    }
  }
  // The fixed texts themselves, whatever letter comes in.
  const all = [];
  for (const lang of ["en", "es"]) {
    for (const k of KINDS) all.push(k.name[lang], k.what[lang]);
    for (const h of Object.values(HELPERS)) all.push(h.name[lang], h.what[lang]);
    all.push(DONT_KNOW[lang], ...Object.values(UI[lang].notes), ...Object.values(UI[lang].labels));
  }
  for (const s of all) {
    for (const re of ADVICE_ANYWHERE) assert.ok(!re.test(s), `fixed text has advice pattern ${re}: ${s}`);
    assert.ok(!IMPERATIVE_START.test(s) || /photo|foto/i.test(s), `fixed text starts like an order: ${s}`);
  }
});

test("a pushy letter: its orders are never repeated in the helper's voice", () => {
  const L = LETTERS.find(l => l.id === "26-pushy-letter-en");
  const r = analyzeLetter(ocr(L), { lang: "en" });
  const own = sentences(r, "en").join(" ");
  assert.ok(!/ignore this letter|lose your home|call us today|must pay/i.test(own));
  assert.ok(!/ignore this letter|lose your home/i.test(JSON.stringify(r)), "not even quoted: those lines carry no date or time period");
  // A date line that is itself an order can be shown, but only as a marked quote from the paper.
  const r2 = analyzeLetter({ text: "You must respond by March 9, 2026 or you will lose.\nExample Credit Recovery, LLC\nThis communication is from a debt collector.", confidence: 90 }, { lang: "en" });
  assert.equal(r2.dates.length, 1);
  assert.match(r2.dates[0].snippet, /You must respond/);
  assert.ok(!/must respond/i.test(sentences(r2, "en").join(" ")));
  assert.ok(quotes(r2).some(q => /must respond/.test(q)), "it is listed with the quotes");
});

test("every 'who can help' entry is on the approved list, with an official web address", () => {
  for (const [id, h] of Object.entries(HELPERS)) {
    assert.ok(h.url.startsWith("https://"), id);
    assert.ok(APPROVED_HOSTS.includes(new URL(h.url).hostname.replace(/^www\./, "")), id + " host " + h.url);
    assert.ok(h.name.en && h.name.es && h.what.en && h.what.es, id + " both languages");
  }
  for (const k of KINDS) for (const id of k.helpers) assert.ok(HELPERS[id], k.id + " names a helper that is not on the list: " + id);
  // Something that is not on the list is dropped, however it got there.
  const r = onlyApproved([{ id: "floridalawhelp" }, { id: "made-up-law-firm" }, { id: "dial211" }], new Set(Object.keys(HELPERS)));
  assert.deepEqual(r.kept.map(x => x.id), ["floridalawhelp", "dial211"]);
  assert.deepEqual(r.dropped, ["made-up-law-firm"]);
});

test("when it is not sure, it says 'I don't know' (both languages), and a close call counts as not sure", () => {
  const n = LETTERS.find(l => l.id === "23-not-a-legal-paper-en");
  for (const lang of ["en", "es"]) {
    const r = analyzeLetter(ocr(n), { lang });
    assert.equal(r.kind, null);
    assert.ok(sentences(r, lang).includes(DONT_KNOW[lang]));
  }
  assert.match(DONT_KNOW.en, /I don't know/);
  assert.match(DONT_KNOW.es, /No s[eé]/);
  assert.equal(pickKind([{ id: "a", score: 5 }, { id: "b", score: 1 }], { min: 3, margin: 2 }), "a");
  assert.equal(pickKind([{ id: "a", score: 5 }, { id: "b", score: 4 }], { min: 3, margin: 2 }), null, "too close");
  assert.equal(pickKind([{ id: "a", score: 2 }], { min: 3, margin: 2 }), null, "too little evidence");
  assert.equal(pickKind([], { min: 3, margin: 2 }), null);
});

test("every kind it names comes with the words on the page that made it say so", () => {
  for (const L of LETTERS.filter(l => l.expect.kind)) {
    const r = analyzeLetter(ocr(L), { lang: L.lang });
    assert.ok(r.why.length >= 1, L.id + " has evidence");
    const flat = s => s.replace(/\s+/g, " ").toLowerCase();
    for (const w of r.why) assert.ok(flat(L.text).includes(flat(w)), `${L.id}: "${w}" is on the page`);
  }
});

test("time periods are quoted from the page and never counted", () => {
  for (const L of LETTERS) {
    const r = analyzeLetter(ocr(L), { lang: L.lang });
    for (const p of r.periods) assert.ok(L.text.includes(p.text) && L.text.replace(/\s+/g, " ").includes(p.snippet.replace(/…$/, "")), `${L.id}: "${p.text}" quoted from the page`);
    assert.ok(!/\d{4}-\d{2}-\d{2}/.test(JSON.stringify(r.periods)), "no date worked out from a period");
  }
});

test("a blurry photo gets no answer at all: it asks for a new photo", () => {
  const b = analyzeLetter(ocr(LETTERS.find(l => l.id === "24-blurry-photo")), { lang: "en" });
  assert.equal(b.status, "unclear");
  assert.deepEqual(b.dates, []);
  assert.equal(b.kind, null);
  assert.equal(b.helpers.length, 0);
  assert.match(sentences(b, "en").join(" "), /new photo/i);
  assert.match(sentences(analyzeLetter(ocr(LETTERS[23]), { lang: "es" }), "es").join(" "), /foto nueva|nueva foto/i);
  // A sharp reader score but only a few words still counts as unclear: not enough to read safely.
  assert.equal(analyzeLetter({ text: "SUMMONS", confidence: 95 }, { lang: "en" }).status, "unclear");
  const none = analyzeLetter(ocr(LETTERS.find(l => l.id === "25-no-text")), { lang: "en" });
  assert.equal(none.status, "unreadable");
  assert.match(sentences(none, "en").join(" "), /no (?:words|text)/i);
  // No words from a soft photo means "too blurry", not "a blank page".
  const soft = analyzeLetter({ text: "", confidence: 0, sharpness: 1 }, { lang: "en" });
  assert.equal(soft.status, "unclear");
  assert.match(sentences(soft, "en").join(" "), /too blurry/i);
  // A soft photo that the reader still reads with high confidence is read; with low confidence it is not.
  const L = LETTERS.find(l => l.id === "03-debt-collector-en");
  assert.equal(analyzeLetter({ text: L.text, confidence: 92, sharpness: 20 }, { lang: "en" }).status, "read");
  assert.equal(analyzeLetter({ text: L.text, confidence: 75, sharpness: 20 }, { lang: "en" }).status, "unclear");
});

test("the worker serves the letter check without a sign-in, and keeps it out of search engines", async () => {
  const env = makeEnv(), a = client(worker, env);
  for (const p of ["/letter", "/letter.js", "/letter-check.mjs", "/grounding.mjs", "/paper-dates.mjs"]) {
    const r = await a.get(p);
    assert.equal(r.status, 200, p);
    assert.match(r.headers.get("x-robots-tag") || "", /noindex/, p);
  }
  assert.equal((await a.get("/app", { Accept: "text/html" })).status, 302, "the app still needs a sign-in");
  assert.equal((await a.get("/brief.mjs")).status, 401, "other files still need a sign-in");
});

test("sharpness: a sharp picture scores far above a blurred one", () => {
  const w = 64, h = 64, sharp = new Uint8Array(w * h), soft = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) sharp[y * w + x] = ((x >> 2) + (y >> 2)) % 2 ? 235 : 20;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let s = 0, n = 0; for (let dy = -6; dy <= 6; dy++) for (let dx = -6; dx <= 6; dx++) { const yy = y + dy, xx = x + dx; if (yy >= 0 && yy < h && xx >= 0 && xx < w) { s += sharp[yy * w + xx]; n++; } } soft[y * w + x] = s / n; }
  assert.ok(sharpness(sharp, w, h) > 10 * sharpness(soft, w, h), `${sharpness(sharp, w, h)} vs ${sharpness(soft, w, h)}`);
  assert.equal(sharpness(new Uint8Array(4), 2, 2), 0, "too small to measure");
});

test("Social Security numbers are hidden in the text and boxed on the photo", () => {
  const a = redactSsn("SSN 987-65-4321 and also 987 65 4321 and seguro social 987654321. Invoice 1234567890 and ZIP 33901-1234 stay.");
  assert.equal(a.count, 3);
  assert.ok(!/987/.test(a.text), a.text);
  assert.match(a.text, /Invoice 1234567890/);
  assert.match(a.text, /33901-1234/);
  assert.equal(redactSsn("Phone (555) 555-0142, case SAMPLE-2026-CC-000456, $1,842.17, 2026-03-09").count, 0, "no false alarms on phones, case numbers, money or dates");
  assert.equal(redactSsn("Nine digits alone: 123456789").count, 0, "nine digits with no 'social security' next to them are left alone");
  assert.equal(redactSsn("XXX-XX-4321").count, 0, "already masked");
  const r = analyzeLetter(ocr(LETTERS.find(l => l.id === "21-ssn-dashes-en")), { lang: "en" });
  assert.ok(!/987-65-4321/.test(JSON.stringify(r)), "nothing in the answer carries the number");
  // The photo side: the reader reports where each word is; the box covers the number's word.
  const lines = [
    { text: "Dana Example", bbox: { x0: 10, y0: 10, x1: 200, y1: 40 }, words: [{ text: "Dana", bbox: { x0: 10, y0: 10, x1: 90, y1: 40 } }, { text: "Example", bbox: { x0: 100, y0: 10, x1: 200, y1: 40 } }] },
    { text: "Social Security Number: 987-65-4321", bbox: { x0: 10, y0: 60, x1: 500, y1: 90 }, words: [{ text: "Social", bbox: { x0: 10, y0: 60, x1: 90, y1: 90 } }, { text: "Security", bbox: { x0: 100, y0: 60, x1: 200, y1: 90 } }, { text: "Number:", bbox: { x0: 210, y0: 60, x1: 320, y1: 90 } }, { text: "987-65-4321", bbox: { x0: 330, y0: 60, x1: 500, y1: 90 } }] },
  ];
  const boxes = ssnBoxes({ text: lines.map(l => l.text).join("\n"), lines });
  assert.equal(boxes.length, 1);
  assert.ok(boxes[0].x0 <= 330 && boxes[0].x1 >= 500 && boxes[0].y0 <= 60 && boxes[0].y1 >= 90, JSON.stringify(boxes));
  assert.ok(boxes[0].x0 >= 300, "only the number is boxed, not the whole line");
});

test("every date comes with the line it was read from and where it sits on the photo", () => {
  const lines = [
    { text: "Example Credit Recovery, LLC", bbox: { x0: 10, y0: 10, x1: 400, y1: 40 } },
    { text: "March 9, 2026", bbox: { x0: 10, y0: 50, x1: 200, y1: 80 } },
    { text: "Unless you dispute the debt by April 13, 2026, we will assume it is valid.", bbox: { x0: 10, y0: 120, x1: 700, y1: 150 } },
    { text: "This communication is from a debt collector.", bbox: { x0: 10, y0: 160, x1: 600, y1: 190 } },
  ];
  const r = analyzeLetter({ text: lines.map(l => l.text).join("\n"), confidence: 92, lines }, { lang: "en" });
  assert.deepEqual(r.dates.map(d => d.iso), ["2026-03-09", "2026-04-13"]);
  assert.deepEqual(r.dates[1].box, { x0: 10, y0: 120, x1: 700, y1: 150 });
  assert.match(r.dates[1].snippet, /dispute the debt by April 13, 2026/);
  assert.equal(r.dates[0].raw, "March 9, 2026");
  // The same date written twice is one card, with a count.
  const twice = analyzeLetter({ text: "Dated March 9, 2026\nExample Credit Recovery, LLC\nThis communication is from a debt collector.\nReceived on March 9, 2026", confidence: 90 }, { lang: "en" });
  assert.equal(twice.dates.length, 1);
  assert.equal(twice.dates[0].more, 1);
});

test("the answer follows the person's language, not the letter's", () => {
  const L = LETTERS.find(l => l.id === "03-debt-collector-en");
  const es = analyzeLetter(ocr(L), { lang: "es" });
  assert.match(es.kind.name, /cobr/i);
  assert.match(es.helpers[0].what, /[áéíóú]|de |para /);
  const en = analyzeLetter(ocr(L), { lang: "en" });
  assert.match(en.kind.name, /debt collector/i);
  // With no language given it follows the letter.
  assert.equal(analyzeLetter(ocr(LETTERS.find(l => l.id === "04-debt-collector-es"))).lang, "es");
  assert.equal(analyzeLetter(ocr(L)).lang, "en");
  assert.ok(isSpanish("Esta comunicación es de un cobrador de deudas"));
});

test("the letter page: both languages, the privacy promise, delete button, nothing stored", () => {
  const html = fs.readFileSync(path.join(ROOT, "public/letter.html"), "utf8");
  const js = fs.readFileSync(path.join(ROOT, "public/letter.js"), "utf8");
  assert.match(html, /<html lang="en"/);
  assert.match(html, /type="file"[^>]*accept="image\/\*"[^>]*capture/);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /id="la-delete"/);
  assert.match(html, /never train AI/i);
  assert.match(html, /Nunca usamos sus papeles|nunca entrenan/i, "the promise in Spanish");
  assert.match(html, /not a law firm|no es un bufete/i);
  assert.ok(!/<script[^>]+src="https?:/.test(html), "no outside scripts in the page itself");
  assert.ok(!/indexedDB|sessionStorage/.test(js), "the photo is never written to browser storage");
  const ls = [...js.matchAll(/localStorage\.(?:get|set)Item\(\s*['"]([^'"]+)['"]/g)].map(m => m[1]);
  assert.ok(ls.every(k => k === "la-lang"), "only the language choice is remembered: " + ls);
  assert.match(js, /\/letter-check\.mjs/);
});
