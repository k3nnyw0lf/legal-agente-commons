// SPDX-License-Identifier: AGPL-3.0-only
// Pro bono hours tracker: helpers log time per case and download a year-end report.
// Hours are private to the helper. They never feed a score or a match.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import worker from "../src/index.js";
import { makeEnv, client, ROOT } from "./helpers.mjs";
import { cleanEntry, totals, toCsv, reportHtml, KINDS, BAR_NOTE } from "../public/hours.mjs";

const OWNER = "11111111", LAWYER = "22222222", PW = "a long test password 1";
async function adminSession(env) {
  await env.COMMENTS.put("auth:setup_until", String(Date.now() + 60000));
  const a = client(worker, env);
  assert.equal((await a.post("/api/auth/setup", { email: "admin@example.org", password: PW, code: OWNER })).status, 200);
  return a;
}
async function helperSession(env, a, email = "helper@example.org") {
  const inv = await (await a.post("/api/admin/invite", { email, role: "counsel", codes: [LAWYER], days: 2 })).json();
  const l = client(worker, env);
  assert.equal((await l.post("/api/auth/setup", { invite: inv.token, password: PW }, { "X-Invite": "1" })).status, 200);
  return l;
}
const E = (date, hours, over = {}) => ({ action: "add", date, hours, kind: "review", caseRef: "Sample debt case", note: "", ...over });

test("an entry is checked: real date, 15 minutes to 24 hours, a known kind, short text", () => {
  const ok = cleanEntry({ date: "2026-03-09", hours: 1.5, kind: "review", caseRef: "  Sample debt case ", note: "Read the summons" }, { today: "2026-11-09" });
  assert.equal(ok.ok, true);
  assert.deepEqual({ ...ok.entry }, { date: "2026-03-09", minutes: 90, kind: "review", caseRef: "Sample debt case", note: "Read the summons" });
  const bad = (o, why) => assert.equal(cleanEntry({ date: "2026-03-09", hours: 1, kind: "review", ...o }, { today: "2026-11-09" }).ok, false, why);
  bad({ hours: 0 }, "zero"); bad({ hours: -1 }, "negative"); bad({ hours: 25 }, "more than a day"); bad({ hours: "abc" }, "not a number"); bad({ hours: 0.05 }, "under five minutes is not logged");
  bad({ date: "2026-02-30" }, "impossible date"); bad({ date: "garbage" }, "not a date"); bad({ date: "2026-12-25" }, "in the future"); bad({ date: "1999-01-01" }, "too old");
  bad({ kind: "free-text" }, "unknown kind");
  assert.equal(cleanEntry({ date: "2026-03-09", hours: 1, kind: "review", caseRef: "x".repeat(200), note: "y".repeat(500) }, { today: "2026-11-09" }).entry.caseRef.length, 60);
  assert.equal(cleanEntry({ date: "2026-03-09", hours: 1, kind: "review", note: "a\u0000b\nc" }, { today: "2026-11-09" }).entry.note, "ab c", "control characters are removed");
  assert.equal(cleanEntry({ date: "2026-03-09", hours: 0.25, kind: "other" }, { today: "2026-11-09" }).entry.minutes, 15);
  assert.ok(KINDS.length >= 6 && KINDS.every(k => k.id && k.en && k.es));
});

test("the worker keeps a helper's own hours: add, list by year, edit, delete", async () => {
  const env = makeEnv(), a = await adminSession(env), h = await helperSession(env, a);
  const r1 = await (await h.post("/api/hours", E("2026-03-09", 1.5))).json();
  assert.equal(r1.ok, true); assert.ok(r1.id);
  await h.post("/api/hours", E("2026-04-02", 0.75, { kind: "meeting", caseRef: "Another case" }));
  await h.post("/api/hours", E("2025-12-30", 2, { caseRef: "Sample debt case" }));
  const y26 = await (await h.get("/api/hours?year=2026")).json();
  assert.equal(y26.ok, true);
  assert.equal(y26.entries.length, 2);
  assert.equal(y26.totals.minutes, 135);
  assert.deepEqual(y26.years, [2025, 2026]);
  assert.deepEqual(y26.entries.map(e => e.date), ["2026-04-02", "2026-03-09"], "newest first");
  const edit = await (await h.post("/api/hours", { action: "edit", id: r1.id, date: "2026-03-10", hours: 2, kind: "drafting", caseRef: "Sample debt case", note: "fixed" })).json();
  assert.equal(edit.ok, true);
  assert.equal((await (await h.get("/api/hours?year=2026")).json()).totals.minutes, 120 + 45);
  assert.equal((await (await h.post("/api/hours", { action: "delete", id: r1.id })).json()).ok, true);
  assert.equal((await (await h.get("/api/hours?year=2026")).json()).entries.length, 1);
  assert.equal((await h.post("/api/hours", E("2026-02-30", 1))).status, 400);
  assert.equal((await h.post("/api/hours", { action: "wipe" })).status, 400);
  assert.equal((await h.post("/api/hours", { action: "delete", id: "nope" })).status, 404);
});

test("hours are private to the person: not the owner, not another helper", async () => {
  const env = makeEnv(), a = await adminSession(env), h1 = await helperSession(env, a, "one@example.org"), h2 = await helperSession(env, a, "two@example.org");
  await h1.post("/api/hours", E("2026-03-09", 3));
  assert.equal((await (await h2.get("/api/hours?year=2026")).json()).entries.length, 0);
  assert.equal((await (await a.get("/api/hours?year=2026")).json()).entries.length, 0, "even the owner sees only their own");
  const keys = [...env.COMMENTS._map.keys()].filter(k => k.startsWith("hours:"));
  assert.deepEqual(keys, ["hours:one@example.org"]);
  // not signed in: nothing
  assert.equal((await client(worker, env).get("/api/hours?year=2026")).status, 401);
  // another person's entry id does not work for me
  const id = (await (await h1.get("/api/hours?year=2026")).json()).entries[0].id;
  assert.equal((await h2.post("/api/hours", { action: "delete", id })).status, 404);
  // and nothing about hours leaks into a score or a match
  const body = JSON.stringify(await (await h1.get("/api/hours?year=2026")).json());
  assert.ok(!/score|rank|match/i.test(body));
});

test("the year-end report file: CSV for a spreadsheet, newest last, safe to open", () => {
  const entries = [
    { id: "b", date: "2026-04-02", minutes: 45, kind: "meeting", caseRef: "Another, case", note: 'She said "call back"' },
    { id: "a", date: "2026-03-09", minutes: 90, kind: "review", caseRef: "Sample debt case", note: "=HYPERLINK(\"http://example.org\")" },
    { id: "c", date: "2025-12-30", minutes: 120, kind: "review", caseRef: "Old", note: "" },
  ];
  const csv = toCsv(entries, { year: 2026, lang: "en" });
  assert.ok(csv.startsWith("﻿"), "starts with a byte-order mark so a spreadsheet reads the accents");
  const rows = csv.replace(/^﻿/, "").trim().split("\r\n");
  assert.equal(rows[0], "Date,Hours,Activity,Case reference,Note");
  assert.equal(rows.length, 3, "one header, two rows for 2026");
  assert.match(rows[1], /^2026-03-09,1\.50,Reviewing papers,Sample debt case,"'=HYPERLINK/);
  assert.ok(rows[1].includes(`'=HYPERLINK(""http://example.org"")`), "a note that starts with = is made harmless");
  assert.match(rows[2], /^2026-04-02,0\.75,Meeting,"Another, case","She said ""call back"""$/);
  assert.match(toCsv(entries, { year: 2026, lang: "es" }).split("\r\n")[0], /^﻿Fecha,Horas,Actividad,Referencia del caso,Nota$/);
  const t = totals(entries.filter(e => e.date.startsWith("2026")));
  assert.equal(t.minutes, 135);
  assert.equal(t.hours, "2.25");
  assert.deepEqual(t.byKind.map(x => [x.id, x.minutes]).sort(), [["meeting", 45], ["review", 90]]);
  assert.deepEqual(t.byCase.map(x => [x.caseRef, x.minutes]).sort(), [["Another, case", 45], ["Sample debt case", 90]]);
});

test("the printable report: the year's hours by case and activity, and a Bar note that cites its official source", () => {
  const entries = [{ id: "a", date: "2026-03-09", minutes: 90, kind: "review", caseRef: "Sample debt case", note: "" }, { id: "c", date: "2025-12-30", minutes: 120, kind: "review", caseRef: "Old", note: "" }];
  const en = reportHtml(entries, { year: 2026, who: "helper@example.org", lang: "en", made: "2026-11-09" });
  assert.match(en, /<html lang="en">/);
  assert.match(en, /Pro bono hours/);
  assert.match(en, /1\.50/);
  assert.ok(!/Old/.test(en), "only the chosen year");
  assert.match(en, /not a certification|is not a certification/i);
  assert.match(en, /Only you decide which of these hours count/);
  // the Florida Bar note: numbers are there only because they were found on the Bar's own page, and it says where
  assert.match(BAR_NOTE.en, /Rule 4-6\.1/);
  assert.match(BAR_NOTE.en, /20 hours/);
  assert.match(BAR_NOTE.en, /\$350/);
  assert.match(BAR_NOTE.en, /membership fees statement/i);
  assert.match(BAR_NOTE.en, /floridabar\.org\/rules\/rrtfb/);
  assert.match(BAR_NOTE.en, /checked 2026-11-09/);
  assert.match(BAR_NOTE.en, /October 22, 2026/);
  assert.match(BAR_NOTE.en, /aspirational/);
  assert.match(en, /20 hours/, "the note is on the lawyer's report");
  const es = reportHtml(entries, { year: 2026, who: "helper@example.org", lang: "es", made: "2026-11-09" });
  assert.match(es, /<html lang="es">/);
  assert.match(es, /Horas de servicio legal gratuito/);
  assert.match(es, /Solo usted decide cuáles de estas horas cuentan/);
  assert.match(BAR_NOTE.es, /20 horas/);
  assert.match(BAR_NOTE.es, /\$350/);
  // nothing from the entries can become markup
  const evil = reportHtml([{ id: "x", date: "2026-03-09", minutes: 60, kind: "review", caseRef: "<img src=x onerror=alert(1)>", note: "<script>1</script>" }], { year: 2026, who: "a<b@example.org", lang: "en", made: "2026-11-09" });
  assert.ok(!/<img|<script/i.test(evil.replace(/<script>[\s\S]*?window\.print[\s\S]*?<\/script>/, "")), "escaped");
});

test("the Bar note's numbers appear only in that note: no other text in the tracker states an hour target", () => {
  const files = ["public/hours.mjs", "public/hours.js", "public/hours.html"].map(f => fs.readFileSync(path.join(ROOT, f), "utf8"));
  for (const src of files) {
    const stripped = src.replace(/BAR_NOTE\s*=\s*\{[\s\S]*?\n\};/, "");
    assert.ok(!/\b20 (?:hours|horas)\b|\$350/.test(stripped), "an hour number outside the Bar note");
  }
});

test("the hours page: add form, list, year choice, download and print, both languages", () => {
  const html = fs.readFileSync(path.join(ROOT, "public/hours.html"), "utf8");
  const js = fs.readFileSync(path.join(ROOT, "public/hours.js"), "utf8");
  assert.match(html, /<html lang="en"/);
  assert.match(html, /id="hr-form"/);
  assert.match(html, /name="hours"[^>]*inputmode="decimal"/);
  assert.match(html, /id="hr-csv"/);
  assert.match(html, /id="hr-print"/);
  assert.match(html, /private to you/i);
  assert.match(html, /Privadas|privad[oa]s? para usted|solo usted/i);
  assert.match(js, /\/api\/hours/);
  assert.ok(!/localStorage\.(?:set|get)Item\(\s*['"]la-hours/.test(js), "hours live on the server, not in browser storage");
});

test("hours are backed up with everything else, and the page is reachable when signed in only", async () => {
  const src = fs.readFileSync(path.join(ROOT, "src/index.js"), "utf8");
  assert.match(src, /"hours:"/);
  const env = makeEnv(), pub = client(worker, env);
  assert.notEqual((await pub.get("/hours", { Accept: "text/html" })).status, 200, "not public");
  const a = await adminSession(env);
  assert.equal((await a.get("/hours")).status, 200);
  assert.equal((await a.get("/hours.js")).status, 200);
  assert.equal((await a.get("/hours.mjs")).status, 200);
});
