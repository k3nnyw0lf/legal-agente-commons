// SPDX-License-Identifier: AGPL-3.0-only
// Lawyer-ready binder: one tap makes a PDF with a cover, an index with page numbers, the one-page summary, the
// timeline and every paper in the case. No phone numbers or addresses unless the person turns them on.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { ROOT } from "./helpers.mjs";
import { SAMPLE_CASES } from "../src/sample-case.js";
import { planBinder, renderBinder, scrub, toWinAnsi, binderFileName, BL } from "../public/binder.mjs";

const require = createRequire(import.meta.url);
const PDFLib = require(path.join(ROOT, "public/vendor/pdf-lib-1.17.1.min.js"));
const SAMPLE = SAMPLE_CASES["11111111"].data;
const CF = path.join(ROOT, "public/cf/sample-debt-ortega");
const NOW = new Date("2026-11-09T12:00:00Z");
const fetchBytes = async h => { const f = path.join(CF, h); if (!fs.existsSync(f)) throw new Error("missing " + h); return new Uint8Array(fs.readFileSync(f)); };
const PHONE = /\(?\d{3}\)?[-. ]\d{3}-\d{4}/, EMAIL = /[\w.+-]+@[\w-]+\.[\w.]+/, STREET = /\b\d{1,6}\s+(?:[A-Za-z0-9.'-]+\s+){1,3}(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Boulevard|Blvd|Lane|Ln|Way)\b/;
const planText = plan => plan.sections.flatMap(s => s.blocks.map(b => b.t)).join("\n");

// The text that really went on a page, read back out of the finished PDF.
function pageText(doc, i) {
  const { decodePDFRawStream, PDFArray, PDFRawStream, PDFStream } = PDFLib;
  const page = doc.getPages()[i], c = page.node.Contents(), streams = [];
  if (c instanceof PDFArray) for (let k = 0; k < c.size(); k++) streams.push(doc.context.lookup(c.get(k)));
  else if (c) streams.push(c);
  let out = "";
  for (const s of streams) {
    const bytes = s instanceof PDFRawStream ? decodePDFRawStream(s).decode() : s.getContents();
    const txt = Buffer.from(bytes).toString("latin1");
    for (const m of txt.matchAll(/<([0-9A-Fa-f]+)>\s*Tj/g)) out += Buffer.from(m[1], "hex").toString("latin1") + "\n";
  }
  return out;
}

test("the plan: summary, timeline, then every paper in the case, in order; no contacts section by default", () => {
  const p = planBinder(SAMPLE, { lang: "en", now: NOW });
  assert.deepEqual(p.sections.map(s => s.id), ["summary", "timeline"]);
  assert.equal(p.papers.length, 6);
  assert.deepEqual(p.papers.map(x => x.h), ["01-collection-letter.pdf", "02-dispute-letter.pdf", "03-certified-mail-receipt.pdf", "05-summons-and-complaint.pdf", "04-call-log.pdf", "06-final-bank-statement.pdf"]);
  assert.ok(p.papers.every(x => x.kind === "pdf"));
  assert.equal(p.includeContacts, false);
  assert.match(p.title, /Ortega/);
  assert.match(planText(p), /Lucia Ortega/);
  assert.match(binderFileName(p), /binder.*2026-11-09\.pdf$/i);
});

test("no phone numbers, email addresses or street addresses in what the binder writes, unless turned on", () => {
  const off = planBinder(SAMPLE, { now: NOW }), t = planText(off);
  assert.ok(!PHONE.test(t) && !EMAIL.test(t) && !STREET.test(t), "off by default: " + (t.match(PHONE) || t.match(EMAIL) || t.match(STREET) || [""])[0]);
  // A date found in the papers can carry a phone number in its line; that is hidden too.
  const C = JSON.parse(JSON.stringify(SAMPLE));
  C.timeline.push({ phase: "Dates found in the papers (check each one)", auto: true, events: [{ d: "9 Apr 2026", iso: "2026-04-09", t: "04/09/2026 11:40 AM (850) 555-0134 call to ann@example.org at 400 Placeholder Avenue", s: "Doc 4, page 1 · found by the computer, check it", u: "/cf/x/04.pdf#page=1", auto: 1 }] });
  const t2 = planText(planBinder(C, { now: NOW }));
  assert.ok(!PHONE.test(t2) && !EMAIL.test(t2) && !STREET.test(t2), "scrubbed: " + t2.slice(-300));
  assert.match(t2, /\[hidden\]/);
  // Turned on, the contacts section appears with what the case holds.
  const on = planBinder(SAMPLE, { includeContacts: true, now: NOW });
  assert.deepEqual(on.sections.map(s => s.id), ["summary", "timeline", "contacts"]);
  assert.match(planText(on), /\(850\) 555-0134/);
  assert.match(planText(on), /123 Sample Street/);
  assert.equal(on.includeContacts, true);
  assert.equal(scrub("Call (850) 555-0134 or mail a@example.org, 12 Main Street."), "Call [hidden] or mail [hidden], [hidden].");
});

test("the PDF: cover, index, summary, timeline, then every paper; the page count adds up", async () => {
  const plan = planBinder(SAMPLE, { now: NOW });
  const r = await renderBinder(PDFLib, plan, fetchBytes, { now: NOW });
  const doc = await PDFLib.PDFDocument.load(r.bytes);
  assert.equal(doc.getPageCount(), r.total);
  const sourcePages = [2, 1, 1, 2, 1, 1]; // the sample papers, in the binder's order
  assert.deepEqual(r.index.filter(e => e.paper).map(e => e.count), sourcePages);
  assert.equal(r.total, r.front + sourcePages.reduce((a, b) => a + b, 0));
  let next = r.front + 1;
  for (const e of r.index.filter(e => e.paper)) { assert.equal(e.start, next, e.title); next += e.count; }
  assert.equal(next - 1, r.total, "the last paper ends on the last page");
});

test("page numbers in the index are the real page numbers: read back out of the PDF", async () => {
  const plan = planBinder(SAMPLE, { now: NOW });
  const r = await renderBinder(PDFLib, plan, fetchBytes, { now: NOW });
  const doc = await PDFLib.PDFDocument.load(r.bytes);
  // every page says "Binder page N of M"
  for (let i = 0; i < r.total; i++) assert.match(pageText(doc, i), new RegExp(`Binder page ${i + 1} of ${r.total}\\b`), "page " + (i + 1));
  // the index pages list each paper with the page it starts on and the pages it covers
  const idx = Array.from({ length: r.indexPages }, (_, k) => pageText(doc, 1 + k)).join("\n");
  for (const e of r.index) {
    const range = e.count > 1 ? `${e.start}-${e.start + e.count - 1}` : `${e.start}`;
    assert.ok(idx.includes("p. " + range), `index says p. ${range} for ${e.title}\n` + idx);
  }
  // the page an entry points to really is that paper: the first paper's first page carries its own title in the margin
  const first = r.index.find(e => e.paper);
  assert.match(pageText(doc, first.start - 1), /Doc 1/);
  // the cover and the index say what they are
  assert.match(pageText(doc, 0), /Lawyer-ready binder/);
  assert.match(pageText(doc, 0), /Not legal advice/);
  assert.match(pageText(doc, 0), /Phone numbers and addresses: left out/);
});

test("a paper that cannot be added gets a page that says so, and the index still adds up", async () => {
  const plan = planBinder(SAMPLE, { now: NOW });
  const bad = async h => { if (h === "03-certified-mail-receipt.pdf") throw new Error("404"); return fetchBytes(h); };
  const r = await renderBinder(PDFLib, plan, bad, { now: NOW });
  const doc = await PDFLib.PDFDocument.load(r.bytes);
  assert.equal(doc.getPageCount(), r.total);
  const e = r.index.find(x => /Doc 3/.test(x.title));
  assert.equal(e.count, 1);
  assert.equal(e.status, "missing");
  assert.match(pageText(doc, e.start - 1), /could not be added/i);
  assert.match(Array.from({ length: r.indexPages }, (_, k) => pageText(doc, 1 + k)).join(" "), /not added/i);
});

test("Spanish: cover, index and headings in Spanish", async () => {
  const plan = planBinder(SAMPLE, { lang: "es", now: NOW });
  const r = await renderBinder(PDFLib, plan, fetchBytes, { now: NOW });
  const doc = await PDFLib.PDFDocument.load(r.bytes);
  assert.match(pageText(doc, 0), /Carpeta lista para el abogado/);
  assert.match(pageText(doc, 0), /No es asesor/);
  assert.match(pageText(doc, 1), /Índice|Ã\u008dndice|ndice/);
  assert.match(pageText(doc, 0), /Páginas|P.ginas/);
  assert.match(BL.es.notAdvice, /No es asesoría legal/);
  assert.match(BL.en.notAdvice, /Not legal advice/);
});

test("many papers: the index runs over more than one page and stays right", async () => {
  const C = JSON.parse(JSON.stringify(SAMPLE));
  const item = C.files.groups[0].items[0];
  C.files.groups[0].items = Array.from({ length: 70 }, (_, i) => ({ ...item, t: "Paper " + (i + 1) + " · copy of the collection letter" }));
  const plan = planBinder(C, { now: NOW });
  const r = await renderBinder(PDFLib, plan, fetchBytes, { now: NOW });
  const doc = await PDFLib.PDFDocument.load(r.bytes);
  assert.ok(r.indexPages >= 2, "index pages: " + r.indexPages);
  assert.equal(doc.getPageCount(), r.total);
  const last = r.index.filter(e => e.paper).at(-1);
  assert.equal(last.start + last.count - 1, r.total);
  const idx = Array.from({ length: r.indexPages }, (_, k) => pageText(doc, 1 + k)).join("\n");
  assert.ok(idx.includes(`p. ${last.start}`));
});

test("text is made safe for the PDF font: accents stay, symbols the font cannot draw are replaced", () => {
  assert.equal(toWinAnsi("¿Qué pasó? ñandú — “hola” … ★ ⚠ ✔"), "¿Qué pasó? ñandú - \"hola\" ... * ! yes");
  assert.equal(toWinAnsi("日本"), "??");
});

test("the case screen has the one-tap button and the phones-and-addresses switch, off by default", () => {
  const html = fs.readFileSync(path.join(ROOT, "public/app.html"), "utf8");
  const js = fs.readFileSync(path.join(ROOT, "public/app-plus.js"), "utf8");
  assert.match(html, /id="binderbtn"/);
  assert.match(html, /<input[^>]*id="bindercontacts"(?![^>]*checked)[^>]*>/, "off by default");
  assert.match(js, /import\('\/binder\.mjs'\)/);
  assert.match(js, /Lawyer-ready binder': '/);
  assert.match(js, /'Include phone numbers and addresses': '/);
});
