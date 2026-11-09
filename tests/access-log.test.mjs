// SPDX-License-Identifier: AGPL-3.0-only
// "Who opened my file": the person sees every view of their case, and can cut off any helper with one tap.
// The log is short-lived (90 days by default, LOG_DAYS to change).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import worker from "../src/index.js";
import { makeEnv, client, ctx as makeCtx, ROOT } from "./helpers.mjs";

const OWNER = "11111111", LAWYER = "22222222", PW = "a long test password 1", SLUG = "sample-debt-ortega";

async function adminSession(env) {
  await env.COMMENTS.put("auth:setup_until", String(Date.now() + 60000));
  const a = client(worker, env);
  assert.equal((await a.post("/api/auth/setup", { email: "admin@example.org", password: PW, code: OWNER })).status, 200);
  return a;
}
async function lawyerSession(env, a, email = "lawyer@example.org") {
  const inv = await (await a.post("/api/admin/invite", { email, role: "counsel", codes: [LAWYER], days: 2 })).json();
  const l = client(worker, env);
  assert.equal((await l.post("/api/auth/setup", { invite: inv.token, password: PW }, { "X-Invite": "1" })).status, 200);
  return l;
}
const view = async (a, code = OWNER) => { await a.ctx.done(); return (await a.post("/api/who-opened", { code })).json(); };

test("opening the case writes a line the owner can read: who, when, what, no address", async () => {
  const env = makeEnv(), a = await adminSession(env);
  await a.post("/api/case", { code: OWNER });
  const v = await view(a);
  assert.equal(v.ok, true);
  assert.equal(v.entries.length, 1);
  const e = v.entries[0];
  assert.equal(e.who, "admin@example.org");
  assert.equal(e.role, "admin");
  assert.equal(e.action, "case_opened");
  assert.match(e.ts, /^\d{4}-\d\d-\d\dT/);
  assert.deepEqual(Object.keys(e).sort(), ["action", "role", "ts", "what", "who"], "no IP address and nothing else");
  assert.ok(!JSON.stringify(v).includes(OWNER), "the case code is never in the log");
  assert.equal(v.keepDays, 90);
});

test("opening a file and adding a file are written too; the same thing twice in ten minutes is one line", async () => {
  const env = makeEnv(), a = await adminSession(env);
  await a.post("/api/case", { code: OWNER }); await a.post("/api/case", { code: OWNER }); await a.post("/api/case", { code: OWNER });
  await a.get("/cf/" + SLUG + "/01-collection-letter.pdf?code=" + OWNER);
  await a.post("/api/upload?" + new URLSearchParams({ code: OWNER, name: "my photo.jpg" }), new Uint8Array([1, 2, 3, 4]), { "content-type": "image/jpeg" });
  const v = await view(a);
  const acts = v.entries.map(e => e.action + ":" + e.what).sort();
  assert.deepEqual(acts, ["case_opened:", "file_added:my photo.jpg", "file_opened:01-collection-letter.pdf"]);
});

test("a helper's views show up for the owner; the helper cannot read the log", async () => {
  const env = makeEnv(), a = await adminSession(env), l = await lawyerSession(env, a);
  await l.post("/api/case", { code: LAWYER });
  await l.get("/cf/" + SLUG + "/02-dispute-letter.pdf?code=" + LAWYER);
  const v = await view(a);
  const mine = v.entries.filter(e => e.who === "lawyer@example.org");
  assert.deepEqual(mine.map(e => e.action).sort(), ["case_opened", "file_opened"]);
  assert.equal(mine[0].role, "counsel");
  const h = v.helpers.find(x => x.email === "lawyer@example.org");
  assert.ok(h && h.canCut === true && h.blocked === false && h.lastSeen, JSON.stringify(v.helpers));
  const admin = v.helpers.find(x => x.email === "admin@example.org");
  assert.ok(admin && admin.role === "admin" && admin.canCut === false, "administrators are listed, and cannot be cut off here");
  const denied = await l.post("/api/who-opened", { code: LAWYER });
  assert.equal(denied.status, 403);
  assert.equal((await denied.json()).ok, false);
});

test("one tap cuts a helper off at once, the log says so, and one tap lets them back in", async () => {
  const env = makeEnv(), a = await adminSession(env), l = await lawyerSession(env, a);
  assert.equal((await l.post("/api/case", { code: LAWYER })).status, 200);
  const cut = await (await a.post("/api/case-access", { code: OWNER, action: "cut", email: "lawyer@example.org" })).json();
  assert.equal(cut.ok, true);
  assert.equal((await l.post("/api/case", { code: LAWYER })).status, 403, "the helper's next request is refused");
  assert.equal((await l.get("/cf/" + SLUG + "/02-dispute-letter.pdf?code=" + LAWYER)).status, 403, "and so are the files");
  let v = await view(a);
  assert.ok(v.entries.some(e => e.action === "access_cut" && e.what === "lawyer@example.org" && e.who === "admin@example.org"));
  assert.equal(v.helpers.find(x => x.email === "lawyer@example.org").blocked, true);
  // Putting the code back on their login (for example from an old invite) does not undo it.
  const u = JSON.parse(await env.COMMENTS.get("auth:user:lawyer@example.org")); u.codes = [LAWYER]; await env.COMMENTS.put("auth:user:lawyer@example.org", JSON.stringify(u));
  assert.equal((await l.post("/api/case", { code: LAWYER })).status, 403, "a block stays until the owner lifts it");
  const back = await (await a.post("/api/case-access", { code: OWNER, action: "allow", email: "lawyer@example.org" })).json();
  assert.equal(back.ok, true);
  assert.equal((await l.post("/api/case", { code: LAWYER })).status, 200, "let back in");
  v = await view(a);
  assert.ok(v.entries.some(e => e.action === "access_allowed" && e.what === "lawyer@example.org"));
  assert.equal(v.helpers.find(x => x.email === "lawyer@example.org").blocked, false);
});

test("cutting off has rules: owner only, helpers only, two actions only, nothing can edit or delete the log", async () => {
  const env = makeEnv(), a = await adminSession(env), l = await lawyerSession(env, a);
  assert.equal((await l.post("/api/case-access", { code: LAWYER, action: "cut", email: "admin@example.org" })).status, 403, "a helper cannot cut anyone off");
  assert.equal((await a.post("/api/case-access", { code: OWNER, action: "cut", email: "admin@example.org" })).status, 400, "an administrator cannot be cut off here");
  assert.equal((await a.post("/api/case-access", { code: OWNER, action: "cut", email: "nobody@example.org" })).status, 404);
  assert.equal((await a.post("/api/case-access", { code: OWNER, action: "delete", email: "lawyer@example.org" })).status, 400);
  assert.equal((await a.post("/api/case-access", { code: OWNER, action: "erase-log" })).status, 400);
  assert.equal((await a.post("/api/who-opened", { code: "00000000" })).status, 403, "wrong code");
  const src = fs.readFileSync(path.join(ROOT, "src/index.js"), "utf8");
  assert.ok(!/UPDATE case_views/i.test(src), "no line of the log is ever changed");
  const deletes = [...src.matchAll(/DELETE FROM case_views ([^"`]*)/g)].map(m => m[1].trim());
  assert.ok(deletes.length && deletes.every(d => d === "WHERE ts < ?" || d === "WHERE slug=?"), "lines are deleted only by age, or when the whole case is deleted: " + deletes);
});

test("the log is short-lived: old lines are deleted when it is read and every night", async () => {
  const env = makeEnv({ LOG_DAYS: "30" }), a = await adminSession(env);
  const t = env.DB._t, day = 864e5, iso = ms => new Date(Date.now() - ms).toISOString();
  t.case_views.push({ id: 1, ts: iso(40 * day), slug: SLUG, who: "old@example.org", role: "counsel", action: "case_opened", what: "" });
  t.case_views.push({ id: 2, ts: iso(5 * day), slug: SLUG, who: "recent@example.org", role: "counsel", action: "case_opened", what: "" });
  t.case_views.push({ id: 3, ts: iso(1 * day), slug: "another-case", who: "x@example.org", role: "counsel", action: "case_opened", what: "" });
  t.access_log.push({ id: 1, ts: iso(100 * day), email: "old@example.org", ip: "203.0.113.9", action: "opened case", detail: "x" });
  t.access_log.push({ id: 2, ts: iso(2 * day), email: "recent@example.org", ip: "203.0.113.9", action: "opened case", detail: "x" });
  const v = await view(a);
  assert.equal(v.keepDays, 30);
  assert.deepEqual(v.entries.map(e => e.who), ["recent@example.org"], "only this case, only what is still kept");
  assert.ok(!t.case_views.some(r => r.who === "old@example.org"), "the old line was deleted, not just hidden");
  // the nightly job clears the other log, and other cases' old lines
  t.case_views.push({ id: 4, ts: iso(60 * day), slug: "another-case", who: "older@example.org", role: "counsel", action: "case_opened", what: "" });
  const c = makeCtx(); await worker.scheduled({}, env, c); await c.done();
  assert.ok(!t.case_views.some(r => r.who === "older@example.org"));
  assert.ok(!t.access_log.some(r => r.email === "old@example.org"), "the admin access log is short-lived too");
  assert.ok(t.access_log.some(r => r.email === "recent@example.org"));
  assert.ok(t.case_views.some(r => r.who === "recent@example.org") && t.case_views.some(r => r.who === "x@example.org"));
});

test("the case screen has the tab for the owner, with the cut-off buttons, in both languages", () => {
  const html = fs.readFileSync(path.join(ROOT, "public/app.html"), "utf8");
  const js = fs.readFileSync(path.join(ROOT, "public/app-plus.js"), "utf8");
  assert.match(html, /data-view="access"[^>]*>Who opened my file</);
  assert.match(html, /id="access-view"/);
  assert.match(html, /access:!CASE\.isOwner/, "the tab is hidden unless this is the owner's view");
  assert.match(js, /accessView/);
  assert.match(js, /\/api\/who-opened/);
  assert.match(js, /\/api\/case-access/);
  assert.match(js, /'Who opened my file': 'Quién abrió mi expediente'/);
  assert.match(js, /'Cut off access': 'Cortar el acceso'/);
  assert.match(js, /'Let back in': 'Permitir de nuevo'/);
  const sql = fs.readFileSync(path.join(ROOT, "schema.sql"), "utf8");
  assert.match(sql, /CREATE TABLE IF NOT EXISTS case_views/);
  assert.doesNotMatch(sql.split("case_views")[1].split(";")[0], /\bip\b/i, "no address column in the person's log");
});

test("the case data tells the screen whether this is the owner's view", async () => {
  const env = makeEnv(), a = await adminSession(env), l = await lawyerSession(env, a);
  assert.equal((await (await a.post("/api/case", { code: OWNER })).json()).case.isOwner, true);
  assert.equal((await (await a.post("/api/case", { code: LAWYER })).json()).case.isOwner, false, "the lawyer view is not the owner's");
  assert.equal((await (await l.post("/api/case", { code: LAWYER })).json()).case.isOwner, false);
});
