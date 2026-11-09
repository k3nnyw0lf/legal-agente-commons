// SPDX-License-Identifier: AGPL-3.0-only
// "Add to my calendar": a calendar file (.ics) for each date the person has checked against the paper.
// The file is made on the phone and saved on the phone. Nothing is sent: no texts, no emails.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import worker from "../src/index.js";
import { ROOT, makeEnv, client } from "./helpers.mjs";
import { buildIcs, icsName, CAL } from "../public/calendar-file.mjs";
import { paperDates } from "../public/paper-dates.mjs";
import { SAMPLE_CASES } from "../src/sample-case.js";

const NOW = new Date("2026-11-09T12:00:00Z");
const sample = SAMPLE_CASES["11111111"].data;
const TEXT = JSON.parse(fs.readFileSync(path.join(ROOT, "public/cf/sample-debt-ortega/_text.json"), "utf8"));
const unfold = s => s.replace(/\r\n[ \t]/g, "");
const lines = s => unfold(s).split("\r\n").filter(Boolean);

test("one VEVENT per checked date: all-day, next-day end, CRLF, nothing else", () => {
  const ics = buildIcs([{ iso: "2026-04-13", where: "Doc 1 · Collection letter, page 1" }, { iso: "2026-12-31" }], { lang: "en", now: NOW });
  assert.ok(ics.startsWith("BEGIN:VCALENDAR\r\n") && ics.endsWith("END:VCALENDAR\r\n"));
  assert.ok(!/[^\r]\n/.test(ics), "every line ends with CRLF");
  const L = lines(ics);
  assert.equal(L.filter(x => x === "BEGIN:VEVENT").length, 2);
  assert.ok(L.includes("DTSTART;VALUE=DATE:20260413") && L.includes("DTEND;VALUE=DATE:20260414"));
  assert.ok(L.includes("DTSTART;VALUE=DATE:20261231") && L.includes("DTEND;VALUE=DATE:20270101"), "year end rolls over");
  assert.ok(L.includes("DTSTAMP:20261109T120000Z"));
  assert.ok(L.includes("VERSION:2.0") && L.includes("METHOD:PUBLISH"));
  const uids = L.filter(x => x.startsWith("UID:"));
  assert.equal(new Set(uids).size, 2, "each event has its own id");
  assert.equal(buildIcs([{ iso: "2026-04-13" }], { now: NOW }), buildIcs([{ iso: "2026-04-13" }], { now: NOW }), "same input, same file (the id does not change)");
  assert.ok(L.includes("DTEND;VALUE=DATE:20260414") && icsName([{ iso: "2026-04-13" }], "en") === "date-2026-04-13.ics");
  assert.equal(icsName([{ iso: "2026-04-13" }, { iso: "2026-05-01" }], "en"), "dates-from-my-papers.ics");
  assert.equal(icsName([{ iso: "2026-04-13" }, { iso: "2026-05-01" }], "es"), "fechas-de-mis-papeles.ics");
});

test("nothing is sent: no invitations, no email or audio alarms, no web addresses, only on-phone reminders", () => {
  const ics = buildIcs([{ iso: "2026-04-13", where: "Doc 1" }, { iso: "2026-05-01" }], { lang: "es", now: NOW });
  for (const bad of ["ATTENDEE", "ORGANIZER", "ACTION:EMAIL", "ACTION:AUDIO", "ACTION:PROCEDURE", "URL", "ATTACH", "METHOD:REQUEST", "METHOD:REPLY", "mailto:", "http"]) {
    assert.ok(!ics.includes(bad), "the file must not contain " + bad);
  }
  const alarms = lines(ics).filter(x => x.startsWith("ACTION:"));
  assert.ok(alarms.length >= 2 && alarms.every(x => x === "ACTION:DISPLAY"), "reminders only show on the phone");
  assert.ok(!/ACTION:/.test(buildIcs([{ iso: "2026-04-13" }], { now: NOW, alarms: false })), "reminders can be left out");
});

test("every event says the court's paper is what counts, in both languages", () => {
  const en = unfold(buildIcs([{ iso: "2026-04-13" }], { lang: "en", now: NOW })), es = unfold(buildIcs([{ iso: "2026-04-13" }], { lang: "es", now: NOW }));
  assert.match(en, /The court's paper is what counts/);
  assert.match(es, /Lo que cuenta es el papel del tribunal/);
  assert.match(en, /SUMMARY:Date on my paper/);
  assert.match(es, /SUMMARY:Fecha en mi papel/);
  for (const lang of ["en", "es"]) {
    assert.match(CAL[lang].note, /court's paper is what counts|papel del tribunal/);
    assert.match(CAL[lang].note, /Nothing is sent|No se envía nada/);
  }
});

test("text is escaped, long lines are folded to 75 bytes, bad dates are dropped, no empty calendar", () => {
  const long = "Doc 1 · Collection letter; page 1, with a very long description that goes on and on and on, to make the line fold more than once, ñandú ¿qué? " + "x".repeat(200);
  const ics = buildIcs([{ iso: "2026-04-13", where: long, quote: "line one\nline two" }, { iso: "2026-02-30" }, { iso: "garbage" }, { iso: "1899-01-01" }], { lang: "en", now: NOW });
  assert.equal(lines(ics).filter(x => x === "BEGIN:VEVENT").length, 1, "only the real date");
  for (const raw of ics.split("\r\n")) assert.ok(Buffer.byteLength(raw) <= 75, "line too long: " + raw.length);
  const u = unfold(ics);
  assert.match(u, /Collection letter\\; page 1\\, with/);
  assert.match(u, /line one\\nline two/);
  assert.equal(buildIcs([], { now: NOW }), null);
  assert.equal(buildIcs([{ iso: "2026-02-30" }], { now: NOW }), null);
});

test("dates found in the papers, once checked, become the file", () => {
  const found = paperDates(TEXT.files, TEXT.chunks, { cf: sample.cf, timeline: sample.timeline });
  assert.ok(found.length >= 3);
  const checked = new Set([found[0].iso, found[2].iso]);
  const picked = found.filter(e => checked.has(e.iso)).map(e => ({ iso: e.iso, where: String(e.s).split(" · found")[0], quote: e.t }));
  const L = lines(buildIcs(picked, { lang: "en", now: NOW }));
  const days = L.filter(x => x.startsWith("DTSTART;VALUE=DATE:")).map(x => x.slice(19));
  assert.deepEqual(days.sort(), picked.map(p => p.iso.replace(/-/g, "")).sort());
  assert.equal(L.filter(x => x === "BEGIN:VEVENT").length, picked.length, "a date that was not checked is not in the file");
});

test("the file code has no way to send anything", () => {
  const src = fs.readFileSync(path.join(ROOT, "public/calendar-file.mjs"), "utf8");
  assert.ok(!/\bfetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket|mailto:/.test(src), "calendar-file.mjs makes no network calls");
  const save = fs.readFileSync(path.join(ROOT, "public/calendar-save.mjs"), "utf8");
  assert.ok(!/\bfetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket|mailto:/.test(save), "calendar-save.mjs makes no network calls");
  assert.match(save, /download/);
});

test("the pages show the checkbox, the button and the plain note", () => {
  const letter = fs.readFileSync(path.join(ROOT, "public/letter.js"), "utf8");
  assert.match(letter, /\/calendar-file\.mjs/);
  assert.match(letter, /\/calendar-save\.mjs/);
  const plus = fs.readFileSync(path.join(ROOT, "public/app-plus.js"), "utf8");
  assert.match(plus, /laFoundDates/);
  assert.match(plus, /datechecks/);
  assert.match(plus, /Add to my calendar/);
  assert.match(plus, /'Add to my calendar': 'Agregar a mi calendario'/);
  // The Spanish in the case screen is the same Spanish as in the calendar code.
  for (const k of ["buttonAll", "needCheck", "note", "saved", "button"]) {
    assert.ok(plus.includes(JSON.stringify(CAL.es[k]).slice(1, -1).replace(/\\"/g, '"')) || plus.includes(CAL.es[k]), "app-plus.js has the Spanish for " + k);
    assert.ok(plus.includes(CAL.en[k]), "app-plus.js has the English for " + k);
  }
  const app = fs.readFileSync(path.join(ROOT, "public/app.html"), "utf8");
  assert.match(app, /laFoundDates/);
});

test("the worker keeps the 'checked' marks for a case, and serves the calendar code to signed-in and public pages", async () => {
  const env = makeEnv(), pub = client(worker, env);
  assert.equal((await pub.get("/calendar-file.mjs")).status, 200, "the letter page needs it without a sign-in");
  assert.equal((await pub.get("/calendar-save.mjs")).status, 200);
  await env.COMMENTS.put("auth:setup_until", String(Date.now() + 60000));
  const a = client(worker, env);
  assert.equal((await a.post("/api/auth/setup", { email: "admin@example.org", password: "a long test password 1", code: "11111111" })).status, 200);
  const put = await (await a.post("/api/store", { code: "11111111", ns: "datechecks", id: "dabc123", text: JSON.stringify({ iso: "2026-04-13", u: "/cf/sample-debt-ortega/01-collection-letter.pdf#page=1" }) })).json();
  assert.equal(put.ok, true);
  const got = await (await a.get("/api/store?code=11111111&ns=datechecks")).json();
  assert.equal(got.ok, true);
  assert.ok(got.docs.dabc123 && got.docs.dabc123.by === "admin@example.org", "who checked it is kept");
  const lawyer = await (await a.get("/api/store?code=22222222&ns=datechecks")).json();
  assert.ok(lawyer.docs.dabc123, "the lawyer view sees the same marks");
  await a.post("/api/store", { code: "11111111", ns: "datechecks", id: "dabc123", text: "" });
  assert.deepEqual((await (await a.get("/api/store?code=11111111&ns=datechecks")).json()).docs, {}, "unchecking removes it");
});
