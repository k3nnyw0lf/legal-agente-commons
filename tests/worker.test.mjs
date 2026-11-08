// Runs the real worker (src/index.js) against in-memory bindings: sign-in, roles, case codes, files, AI rules, fingerprints.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import worker from "../src/index.js";
import { makeEnv, client } from "./helpers.mjs";

const OWNER = "11111111", LAWYER = "22222222", PW = "a long test password 1";

async function adminSession(env) {
  await env.COMMENTS.put("auth:setup_until", String(Date.now() + 60000));
  const a = client(worker, env);
  const r = await a.post("/api/auth/setup", { email: "admin@example.org", password: PW, code: OWNER });
  assert.equal(r.status, 200, await r.clone().text());
  assert.ok(a.hasCookie());
  return a;
}

test("signed out: home page is public, the app and case data are not", async () => {
  const env = makeEnv(), b = client(worker, env);
  assert.equal((await b.get("/")).status, 200);
  const app = await b.get("/app", { Accept: "text/html" });
  assert.equal(app.status, 302);
  assert.match(app.headers.get("location"), /^\/login\?next=/);
  assert.equal((await b.post("/api/case", { code: OWNER })).status, 401);
  assert.equal((await b.get("/cf/sample-debt-ortega/01-collection-letter.pdf?code=" + OWNER)).status, 401);
});

test("setup window: only an email in ADMIN_EMAILS, only while open, only once", async () => {
  const env = makeEnv(), b = client(worker, env);
  assert.equal((await b.post("/api/auth/setup", { email: "admin@example.org", password: PW, code: OWNER })).status, 403, "closed window");
  await env.COMMENTS.put("auth:setup_until", String(Date.now() + 60000));
  assert.equal((await b.post("/api/auth/setup", { email: "someone@example.org", password: PW, code: OWNER })).status, 403, "not an admin email");
  assert.equal((await b.post("/api/auth/setup", { email: "admin@example.org", password: PW, code: "99999999" })).status, 403, "bad case code");
  assert.equal((await b.post("/api/auth/setup", { email: "admin@example.org", password: PW, code: OWNER })).status, 200);
  assert.equal(await env.COMMENTS.get("auth:setup_until"), null, "window closes after one use");
});

test("password sign-in works, a wrong password does not", async () => {
  const env = makeEnv(); await adminSession(env);
  const b = client(worker, env);
  assert.equal((await b.post("/api/auth/login", { email: "admin@example.org", password: "wrong password here" })).status, 401);
  const ok = await b.post("/api/auth/login", { email: "admin@example.org", password: PW });
  assert.equal(ok.status, 200); assert.ok(b.hasCookie());
});

test("the sample case opens, and it is marked as fiction", async () => {
  const env = makeEnv(), a = await adminSession(env);
  const j = await (await a.post("/api/case", { code: OWNER })).json();
  assert.equal(j.ok, true);
  assert.match(j.case.title, /SAMPLE \(fictional\)/);
  assert.equal(j.case.fictional, true);
  const lv = await (await a.post("/api/case", { code: LAWYER })).json();
  assert.equal(lv.slug, "sample-debt-ortega-counsel");
  assert.deepEqual(lv.case.hideTabs, ["notes"]);
});

test("an invited lawyer opens only the case code on the invite", async () => {
  const env = makeEnv(), a = await adminSession(env);
  const inv = await (await a.post("/api/admin/invite", { email: "lawyer@example.org", role: "counsel", codes: [LAWYER], days: 2 })).json();
  assert.equal(inv.ok, true);
  const l = client(worker, env);
  const made = await l.post("/api/auth/setup", { invite: inv.token, password: PW }, { "X-Invite": "1" });
  assert.equal(made.status, 200); assert.ok(l.hasCookie());
  assert.equal((await l.post("/api/case", { code: LAWYER })).status, 200);
  assert.equal((await l.post("/api/case", { code: OWNER })).status, 403, "not on the invite");
  assert.equal((await l.get("/cf/sample-debt-ortega/01-collection-letter.pdf?code=" + OWNER)).status, 403);
  assert.equal((await l.get("/cf/sample-debt-ortega/01-collection-letter.pdf?code=" + LAWYER)).status, 200);
  assert.equal((await l.get("/api/admin/users")).status, 403);
  assert.equal((await l.get("/admin", { Accept: "text/html" })).status, 302);
  // the invite link works once
  assert.equal((await client(worker, env).post("/api/auth/setup", { invite: inv.token, password: PW }, { "X-Invite": "1" })).status, 403);
});

test("hosted files need the case code, even for an admin", async () => {
  const env = makeEnv(), a = await adminSession(env);
  assert.equal((await a.get("/cf/sample-debt-ortega/01-collection-letter.pdf")).status, 403);
  const r = await a.get("/cf/sample-debt-ortega/01-collection-letter.pdf?code=" + OWNER);
  assert.equal(r.status, 200);
  assert.equal(r.headers.get("x-robots-tag"), "noindex, nofollow, noarchive");
  const log = env.DB._t.access_log.map(x => x.action);
  assert.ok(log.includes("opened file"), "file views are logged");
});

test("Ask AI is told never to give legal advice", async () => {
  const env = makeEnv(), a = await adminSession(env);
  const j = await (await a.post("/api/ask", { code: OWNER, q: "Should I settle?" })).json();
  assert.equal(j.ok, true);
  const sys = env.AI._calls[0].input.messages[0].content;
  assert.match(sys, /never give legal advice/);
  assert.match(sys, /FICTIONAL SAMPLE|SAMPLE \(fictional\)/);
});

test("AI drafting is off unless the deployment turns it on", async () => {
  const env = makeEnv(), a = await adminSession(env);
  const off = await (await a.post("/api/rewrite", { code: OWNER, q: "Admit you owe the debt.", draft: "I do not agree.", kind: "admission" })).json();
  assert.equal(off.ok, false); assert.match(off.error, /switched off/);
  assert.equal(env.AI._calls.length, 0);
  const env2 = makeEnv({ AI_DRAFTING: "on" }), a2 = await adminSession(env2);
  const on = await (await a2.post("/api/rewrite", { code: OWNER, q: "Admit you owe the debt.", draft: "I do not agree.", kind: "admission" })).json();
  assert.equal(on.ok, true);
  assert.match(env2.AI._calls[0].input.messages[0].content, /for the client in/);
});

test("uploads get a fingerprint, and a changed log row is caught", async () => {
  const env = makeEnv(), a = await adminSession(env);
  const up = await (await a.post("/api/upload?code=" + OWNER + "&name=note.txt", new TextEncoder().encode("A made-up note."), { "Content-Type": "text/plain" })).json();
  assert.equal(up.ok, true); assert.equal(up.fingerprint, true);
  assert.equal(up.sha, createHash("sha256").update("A made-up note.").digest("hex"));
  const ev = await (await a.get("/api/evidence?code=" + OWNER)).json();
  assert.equal(ev.items.length, 1); assert.equal(ev.items[0].sha, up.sha);
  let chain = await (await a.get("/api/admin/evidence-chain")).json();
  assert.equal(chain.n, 1); assert.equal(chain.broken, null);
  env.DB._t.evidence[0].name = "edited later";
  chain = await (await a.get("/api/admin/evidence-chain")).json();
  assert.ok(chain.broken, "editing a row breaks the chain");
});

test("email-in addresses use MAIL_DOMAIN, and unknown addresses are turned away", async () => {
  const env = makeEnv(), a = await adminSession(env);
  const m = await (await a.get("/api/mailin?code=" + OWNER)).json();
  assert.match(m.shared, /^in-[a-f0-9]{24}@mail\.example\.org$/);
  let why = "";
  await worker.email({ to: "in-" + "0".repeat(24) + "@mail.example.org", from: "x@example.org", headers: new Headers(), setReject(r) { why = r; } }, env, { waitUntil() { } });
  assert.match(why, /does not exist/);
  why = "";
  await worker.email({ to: m.shared, from: "stranger@example.org", headers: new Headers(), setReject(r) { why = r; } }, env, { waitUntil() { } });
  assert.match(why, /only takes email from people on the case/);
});
