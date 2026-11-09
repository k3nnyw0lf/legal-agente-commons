// SPDX-License-Identifier: AGPL-3.0-only
// Public impact page: counts by case type and county, no names, and no count under 10.
// With only the sample case it says "not enough cases yet". It never asks for money.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import worker from "../src/index.js";
import { makeEnv, client, ROOT } from "./helpers.mjs";
import { impactCounts, CASE_TYPES, COUNTIES, MIN_COUNT } from "../public/impact.mjs";

const OWNER = "11111111", PW = "a long test password 1";
const many = (n, type, county, extra = {}) => Array.from({ length: n }, () => ({ type, county, ...extra }));
// every number in an answer, so a small one cannot hide anywhere
const numbers = o => JSON.stringify(o).match(/(?<![\w.-])\d+(?![\w-])/g) || [];

test("the vocabularies: 10 kinds of case in both languages, and the 67 Florida counties", () => {
  assert.equal(MIN_COUNT, 10);
  assert.ok(CASE_TYPES.length >= 8 && CASE_TYPES.every(t => t.id && t.en && t.es));
  assert.equal(new Set(CASE_TYPES.map(t => t.id)).size, CASE_TYPES.length);
  assert.equal(COUNTIES.length, 67);
  assert.equal(new Set(COUNTIES).size, 67);
  for (const c of ["Collier", "Lee", "Miami-Dade", "Palm Beach", "St. Johns", "DeSoto"]) assert.ok(COUNTIES.includes(c), c);
});

test("fewer than 10 real cases: not enough cases yet, and no count at all", () => {
  for (const n of [0, 1, 9]) {
    const r = impactCounts(many(n, "debt", "Collier"));
    assert.equal(r.enough, false, n + " cases");
    assert.equal(r.total, null);
    assert.deepEqual(r.byType, []); assert.deepEqual(r.byCounty, []);
    assert.ok(!numbers({ ...r, min: 0 }).some(x => x !== "0"), "no number about the cases is in the answer: " + JSON.stringify(r));
  }
  const r = impactCounts(many(10, "debt", "Collier"));
  assert.equal(r.enough, true); assert.equal(r.total, 10);
  assert.deepEqual(r.byType, [{ id: "debt", count: 10, hidden: false }]);
  assert.deepEqual(r.byCounty, [{ county: "Collier", count: 10, hidden: false }]);
});

test("any count under 10 shows as hidden, and the total is held back when anything is hidden", () => {
  const cases = [...many(12, "debt", "Collier"), ...many(8, "housing", "Lee"), ...many(5, "family", "Collier")];
  const r = impactCounts(cases);
  assert.equal(r.enough, true);
  assert.deepEqual(r.byType, [{ id: "debt", count: 12, hidden: false }, { id: "family", count: null, hidden: true }, { id: "housing", count: null, hidden: true }]);
  assert.deepEqual(r.byCounty, [{ county: "Collier", count: 17, hidden: false }, { county: "Lee", count: null, hidden: true }]);
  assert.equal(r.total, null, "a total would let the hidden cells be worked out");
  const shown = numbers(r).map(Number).filter(n => n !== 10);
  assert.ok(shown.every(n => n >= 10), "no number under 10 anywhere: " + shown);
  assert.ok(!JSON.stringify(r).includes('"8"') && !/\b8\b/.test(JSON.stringify(r)) && !/\b5\b/.test(JSON.stringify(r)));
  // when nothing is hidden, the total is shown
  const all = impactCounts([...many(11, "debt", "Collier"), ...many(10, "housing", "Lee")]);
  assert.equal(all.total, 21);
});

test("whatever the mix, no number under 10 can be read from the answer", () => {
  let seed = 7; const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const types = CASE_TYPES.map(t => t.id), counties = COUNTIES.slice(0, 12);
  for (let round = 0; round < 200; round++) {
    const cases = Array.from({ length: Math.floor(rnd() * 120) }, () => ({ type: types[Math.floor(rnd() * types.length)], county: counties[Math.floor(rnd() * counties.length)] }));
    const r = impactCounts(cases);
    for (const n of numbers({ total: r.total, byType: r.byType, byCounty: r.byCounty }).map(Number)) assert.ok(n >= 10, `round ${round}: ${n} in ${JSON.stringify(r)}`);
    for (const row of [...r.byType, ...r.byCounty]) assert.equal(row.hidden, row.count == null);
  }
});

test("only real, recorded cases are counted: not the sample, not a case with no type or county", () => {
  const cases = [...many(10, "debt", "Collier", { fictional: true }), ...many(6, "debt", "Collier"), ...many(6, "debt", "Collier"), { type: "debt" }, { county: "Collier" }, { type: "made-up", county: "Collier" }, { type: "debt", county: "Atlantis" }, ...many(5, "debt", "Lee")];
  const r = impactCounts(cases);
  assert.equal(r.enough, true);
  assert.deepEqual(r.byType, [{ id: "debt", count: 17, hidden: false }]);
  assert.deepEqual(r.byCounty, [{ county: "Collier", count: 12, hidden: false }, { county: "Lee", count: null, hidden: true }]);
});

test("the worker: public, no sign-in, and with only the sample case it says not enough cases yet", async () => {
  const env = makeEnv(), pub = client(worker, env);
  const r = await pub.get("/api/impact");
  assert.equal(r.status, 200);
  assert.match(r.headers.get("x-robots-tag") || "", /noindex/);
  const j = await r.json();
  assert.equal(j.ok, true); assert.equal(j.enough, false); assert.equal(j.total, null);
  for (const p of ["/impact", "/impact.js", "/impact.mjs"]) assert.equal((await pub.get(p)).status, 200, p);
  assert.equal((await pub.get("/api/admin/users")).status, 403, "the admin routes are still closed");
  assert.equal((await pub.get("/api/hours")).status, 401, "other API routes still need a sign-in");
});

test("the worker counts cases made on the admin page, by type and county, with no names", async () => {
  const env = makeEnv(); await env.COMMENTS.put("auth:setup_until", String(Date.now() + 60000));
  const a = client(worker, env);
  assert.equal((await a.post("/api/auth/setup", { email: "admin@example.org", password: PW, code: OWNER })).status, 200);
  assert.equal((await a.post("/api/admin/case", { title: "X v. Y", type: "made-up", county: "Collier" })).status, 400, "a type that is not on the list");
  assert.equal((await a.post("/api/admin/case", { title: "X v. Y", type: "debt", county: "Atlantis" })).status, 400, "a county that is not on the list");
  for (let i = 0; i < 12; i++) assert.equal((await a.post("/api/admin/case", { title: "Alice Example v. Bob Sample " + i, type: "debt", county: "Collier" })).status, 200);
  for (let i = 0; i < 4; i++) assert.equal((await a.post("/api/admin/case", { title: "Carol Placeholder " + i, type: "housing", county: "Lee" })).status, 200);
  assert.equal((await a.post("/api/admin/case", { title: "No type given" })).status, 200, "type and county are optional");
  const j = await (await client(worker, env).get("/api/impact")).json();
  assert.equal(j.enough, true);
  assert.deepEqual(j.byType, [{ id: "debt", count: 12, hidden: false }, { id: "housing", count: null, hidden: true }]);
  assert.deepEqual(j.byCounty, [{ county: "Collier", count: 12, hidden: false }, { county: "Lee", count: null, hidden: true }]);
  assert.equal(j.total, null);
  const raw = JSON.stringify(j);
  assert.ok(!/Alice|Bob|Carol|Placeholder|example\.org|\b\d{8}\b/.test(raw), "no names, emails or case codes: " + raw);
  assert.deepEqual(Object.keys(j).sort(), ["byCounty", "byType", "enough", "min", "ok", "total", "updated"], "nothing else in the answer");
});

test("the page: not enough yet, fewer than 10, both languages, and it never asks for money", () => {
  const html = fs.readFileSync(path.join(ROOT, "public/impact.html"), "utf8");
  const js = fs.readFileSync(path.join(ROOT, "public/impact.js"), "utf8");
  assert.match(html, /<html lang="en"/);
  assert.match(html, /noindex/);
  assert.match(html, /no names/i); assert.match(html, /sin nombres/i);
  assert.match(js, /\/api\/impact/);
  assert.match(js, /Not enough cases yet/);
  assert.match(js, /Todavía no hay suficientes casos/);
  assert.match(js, /fewer than 10/);
  assert.match(js, /menos de 10/);
  const both = html + js;
  assert.ok(!/donat|donar|donación|donacion|\bgive now|\bpay\b|\bpayment|\bpaypal|stripe|\$\d/i.test(both), "no donate button, no payment, no dollar ask");
  const admin = fs.readFileSync(path.join(ROOT, "public/admin.html"), "utf8");
  assert.match(admin, /id="ctype"/); assert.match(admin, /id="ccounty"/);
});
