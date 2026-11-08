// SPDX-License-Identifier: AGPL-3.0-only
// The fictional sample case must be complete (every link points at a real sample file) and clearly marked as fiction.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { SAMPLE_CASES, SAMPLE_COUNSEL_CODES } from "../src/sample-case.js";
import { ROOT } from "./helpers.mjs";

const [code, c] = Object.entries(SAMPLE_CASES)[0];
const dir = path.join(ROOT, "public", c.data.cf);
const text = JSON.parse(fs.readFileSync(path.join(dir, "_text.json"), "utf8"));

test("only one case, and it is fictional", () => {
  assert.equal(Object.keys(SAMPLE_CASES).length, 1);
  assert.match(code, /^\d{8}$/);
  assert.equal(c.data.fictional, true);
  assert.match(c.data.title, /fictional/i);
  assert.match(c.data.moneyNote, /FICTIONAL SAMPLE/);
  for (const [k, v] of Object.entries(SAMPLE_COUNSEL_CODES)) { assert.match(k, /^\d{8}$/); assert.ok(SAMPLE_CASES[v.base]); }
});

test("every document the case names exists and is in the text index", () => {
  const items = c.data.files.groups.flatMap(g => g.items);
  for (const it of items) {
    assert.ok(fs.existsSync(path.join(dir, it.h)), "missing " + it.h);
    assert.ok(text.files.some(f => f.h === it.h), "not in _text.json: " + it.h);
  }
  for (const h of Object.values(c.data.docMap)) assert.ok(fs.existsSync(path.join(dir, h)), "docMap " + h);
  for (const cl of c.data.proof.claims) for (const el of cl.elements) for (const ev of el.ev) assert.ok(fs.existsSync(path.join(dir, ev.h)), "proof " + ev.h);
  for (const ph of c.data.timeline) for (const ev of ph.events) if (ev.u) assert.ok(fs.existsSync(path.join(ROOT, "public", ev.u.split("#")[0])), "timeline " + ev.u);
});

test("every page of every sample document says it is fiction", () => {
  for (const ch of text.chunks) assert.match(ch.t, /FICTIONAL SAMPLE - NOT A REAL CASE/);
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith(".pdf"))) assert.ok(fs.readFileSync(path.join(dir, f)).length > 1000, f);
});

test("map edges point at people in the case; dates are real calendar dates", () => {
  for (const e of c.data.edges) { assert.ok(c.data.nodes[e[0]], e[0]); assert.ok(c.data.nodes[e[1]], e[1]); }
  for (const d of c.data.deadlines) assert.ok(!isNaN(Date.parse(d.d + "T12:00:00Z")), d.d);
});

test("no email addresses, and phone numbers only from the 555-01xx range kept for fiction", () => {
  const src = fs.readFileSync(path.join(ROOT, "src/sample-case.js"), "utf8") + fs.readFileSync(path.join(ROOT, "scripts/build-sample.mjs"), "utf8");
  assert.doesNotMatch(src, /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[a-z]{2,}/);
  for (const m of src.matchAll(/\(\d{3}\) (\d{3})-(\d{4})/g)) { assert.equal(m[1], "555", m[0]); assert.match(m[2], /^01\d\d$/, m[0]); }
});
