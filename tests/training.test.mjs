// SPDX-License-Identifier: AGPL-3.0-only
// 15-minute volunteer training and quiz gate: privacy, the no-advice line, conflicts.
// A helper cannot open a case until they pass. The training text is a DRAFT for counsel review.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import worker from "../src/index.js";
import { makeEnv, client, ROOT } from "./helpers.mjs";
import { TRAINING, QUESTIONS, scoreQuiz, publicTraining } from "../public/training.mjs";

const OWNER = "11111111", LAWYER = "22222222", PW = "a long test password 1";
const on = () => makeEnv({ TRAINING_REQUIRED: "on" });
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
const allRight = () => Object.fromEntries(QUESTIONS.map(q => [q.id, q.answer]));
const wrongOf = q => (q.answer + 1) % q.options.length;

test("the training: three modules, 15 minutes, every text in both languages, clearly a DRAFT", () => {
  assert.equal(TRAINING.minutes, 15);
  assert.equal(TRAINING.draft, true);
  assert.match(TRAINING.draftNotice.en, /DRAFT FOR COUNSEL REVIEW/);
  assert.match(TRAINING.draftNotice.es, /BORRADOR PARA REVISIÓN DEL ABOGADO/);
  assert.match(TRAINING.version, /^draft-/);
  assert.deepEqual(TRAINING.modules.map(m => m.id), ["privacy", "no-advice", "conflicts"]);
  for (const m of TRAINING.modules) {
    for (const lang of ["en", "es"]) { assert.ok(m.title[lang].length > 5, m.id); assert.ok(m.paras[lang].length >= 5, m.id + " " + lang); assert.equal(m.paras[lang].length, m.paras.en.length, m.id + ": same number of paragraphs in both languages"); }
  }
  const words = TRAINING.modules.flatMap(m => m.paras.en).join(" ").split(/\s+/).length;
  assert.ok(words > 350 && words < 1500, "about 15 minutes of reading and a quiz: " + words + " words");
});

test("the covered ground: privacy, the no-advice line, conflicts, crisis numbers, never 'AI lawyer'", () => {
  const en = TRAINING.modules.flatMap(m => m.paras.en).join("\n"), es = TRAINING.modules.flatMap(m => m.paras.es).join("\n");
  for (const re of [/only the people on (?:a|the) case/i, /Social Security/i, /supervising lawyer/i, /conflict/i, /911/, /988/, /never train AI/i, /licensed lawyer/i, /program lead/i]) assert.match(en, re);
  for (const re of [/Seguro Social/i, /abogado supervisor/i, /conflicto/i, /911/, /988/, /nunca entrenan|nunca se usan para entrenar/i, /abogado con licencia/i, /líder del programa/i]) assert.match(es, re);
  assert.ok(!/\bAI lawyer\b|abogado (?:de )?IA|abogado artificial/i.test(en + es + JSON.stringify(QUESTIONS)), "never calls anything an AI lawyer, except to say never to");
  assert.match(en, /Never call the tool or any helper a lawyer/);
});

test("the quiz: 10 questions, one right answer each, both languages, the no-advice line marked critical", () => {
  assert.equal(QUESTIONS.length, 10);
  assert.equal(new Set(QUESTIONS.map(q => q.id)).size, 10);
  for (const q of QUESTIONS) {
    assert.ok(q.q.en && q.q.es, q.id);
    assert.ok(q.options.length >= 3 && q.options.length <= 4, q.id);
    assert.ok(q.options.every(o => o.en && o.es), q.id + " options in both languages");
    assert.ok(Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.options.length, q.id + " answer index");
    assert.ok(q.why.en && q.why.es, q.id + " explanation in both languages");
    assert.ok(TRAINING.modules.some(m => m.id === q.module), q.id + " belongs to a module");
  }
  assert.ok(new Set(QUESTIONS.map(q => q.answer)).size >= 3, "the right answer is not always in the same place");
  const critical = QUESTIONS.filter(q => q.critical);
  assert.ok(critical.length >= 3 && critical.every(q => q.module === "no-advice"), "the no-advice line is the critical part");
  assert.equal(QUESTIONS.filter(q => q.module === "conflicts").length >= 2, true);
});

test("scoring: 8 of 10 passes, 7 fails, and a miss on the no-advice line fails whatever the score", () => {
  assert.deepEqual(scoreQuiz(allRight()), { score: 10, total: 10, passed: true, wrong: [], criticalWrong: false });
  const miss = ids => { const a = allRight(); for (const id of ids) a[id] = wrongOf(QUESTIONS.find(q => q.id === id)); return scoreQuiz(a); };
  const plain = QUESTIONS.filter(q => !q.critical).map(q => q.id), crit = QUESTIONS.filter(q => q.critical).map(q => q.id);
  assert.equal(miss(plain.slice(0, 2)).passed, true, "8 of 10");
  assert.equal(miss(plain.slice(0, 3)).passed, false, "7 of 10");
  const c = miss(crit.slice(0, 1));
  assert.equal(c.score, 9); assert.equal(c.passed, false); assert.equal(c.criticalWrong, true);
  assert.equal(scoreQuiz({}).score, 0, "nothing answered");
  assert.equal(scoreQuiz({ ...allRight(), [QUESTIONS[0].id]: 99 }).wrong[0], QUESTIONS[0].id, "an answer that is not an option is wrong");
});

test("what the browser gets has no answer key; wrong answers come back with the right one and why", async () => {
  const pub = publicTraining();
  assert.ok(!/"answer"/.test(JSON.stringify(pub)), "no answer key in the page's copy");
  assert.equal(pub.questions.length, 10);
  const env = on(), a = await adminSession(env), h = await helperSession(env, a);
  const g = await (await h.get("/api/training")).json();
  assert.equal(g.ok, true); assert.equal(g.draft, true); assert.equal(g.required, true); assert.equal(g.status.trained, false);
  assert.ok(!/"answer"/.test(JSON.stringify(g)));
  assert.equal((await h.post("/api/training", { answers: { [QUESTIONS[0].id]: 0 } })).status, 400, "answer every question");
  const bad = allRight(); bad[QUESTIONS[3].id] = wrongOf(QUESTIONS[3]);
  const r = await (await h.post("/api/training", { answers: bad })).json();
  assert.equal(r.ok, true); assert.equal(r.passed, false); assert.equal(r.score, 9);
  assert.equal(r.wrong.length, 1);
  assert.equal(r.wrong[0].id, QUESTIONS[3].id); assert.equal(r.wrong[0].correct, QUESTIONS[3].answer); assert.ok(r.wrong[0].why.en && r.wrong[0].why.es);
  assert.equal((await (await h.get("/api/training")).json()).status.trained, false, "not passed, not trained");
});

test("a helper cannot open a case until they pass; passing opens it; a new version asks again", async () => {
  const env = on(), a = await adminSession(env), h = await helperSession(env, a);
  const no = await h.post("/api/case", { code: LAWYER });
  assert.equal(no.status, 403);
  const body = await no.json();
  assert.equal(body.training, true);
  assert.match(body.error, /training/i); assert.match(body.error, /capacitación/i);
  assert.equal((await h.get("/cf/sample-debt-ortega/01-collection-letter.pdf?code=" + LAWYER)).status, 403, "files too");
  assert.equal((await h.post("/api/ask", { code: LAWYER, q: "When did the letter arrive?" })).status, 403, "and Ask AI");
  assert.equal((await h.get("/api/training")).status, 200, "the training itself is open to everyone who is signed in");
  assert.equal((await h.get("/training", { Accept: "text/html" })).status, 200);
  const r = await (await h.post("/api/training", { answers: allRight() })).json();
  assert.equal(r.passed, true);
  assert.equal((await h.post("/api/case", { code: LAWYER })).status, 200, "passed: the case opens");
  assert.equal((await h.get("/cf/sample-debt-ortega/01-collection-letter.pdf?code=" + LAWYER)).status, 200);
  const st = await (await h.get("/api/training")).json();
  assert.equal(st.status.trained, true); assert.equal(st.status.score, 10); assert.match(st.status.at, /^\d{4}-/);
  // counsel finalises the text and changes the version: everyone takes it again
  const u = JSON.parse(await env.COMMENTS.get("auth:user:helper@example.org")); u.trained.v = "an-older-version"; await env.COMMENTS.put("auth:user:helper@example.org", JSON.stringify(u));
  assert.equal((await h.post("/api/case", { code: LAWYER })).status, 403);
});

test("failing does not open anything, and nobody can mark themselves trained", async () => {
  const env = on(), a = await adminSession(env), h = await helperSession(env, a);
  const bad = allRight(); for (const q of QUESTIONS.filter(q => q.critical)) bad[q.id] = wrongOf(q);
  assert.equal((await (await h.post("/api/training", { answers: bad })).json()).passed, false);
  assert.equal((await h.post("/api/case", { code: LAWYER })).status, 403);
  assert.equal((await h.post("/api/training", { answers: allRight(), passed: true, trained: { v: TRAINING.version } })).status, 200);
  const u = JSON.parse(await env.COMMENTS.get("auth:user:helper@example.org"));
  assert.equal(u.trained.v, TRAINING.version);
  const u2 = JSON.parse(await env.COMMENTS.get("auth:user:helper@example.org")); delete u2.trained; await env.COMMENTS.put("auth:user:helper@example.org", JSON.stringify(u2));
  assert.equal((await h.post("/api/case", { code: LAWYER, trained: true })).status, 403, "a flag in the request does nothing");
});

test("the gate has two exceptions only: administrators, and a deployment that turns it off", async () => {
  const env = on(), a = await adminSession(env);
  assert.equal((await a.post("/api/case", { code: OWNER })).status, 200, "the deployer is not asked");
  const st = await (await a.get("/api/training")).json();
  assert.equal(st.required, false);
  const off = makeEnv({ TRAINING_REQUIRED: "off" }), a2 = await adminSession(off), h2 = await helperSession(off, a2);
  assert.equal((await h2.post("/api/case", { code: LAWYER })).status, 200);
  assert.equal((await (await h2.get("/api/training")).json()).required, false);
  const dflt = makeEnv(); delete dflt.TRAINING_REQUIRED;
  const a3 = await adminSession(dflt), h3 = await helperSession(dflt, a3);
  assert.equal((await h3.post("/api/case", { code: LAWYER })).status, 403, "on unless a deployment says off");
});

test("the training page: draft banner in both languages, readable on a phone, a real form", () => {
  const html = fs.readFileSync(path.join(ROOT, "public/training.html"), "utf8");
  const js = fs.readFileSync(path.join(ROOT, "public/training.js"), "utf8");
  assert.match(html, /DRAFT FOR COUNSEL REVIEW/);
  assert.match(html, /BORRADOR PARA REVISIÓN DEL ABOGADO/);
  assert.match(html, /<html lang="en"/);
  assert.match(html, /15 minutes/); assert.match(html, /15 minutos/);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /id="tr-form"/);
  assert.match(js, /\/api\/training/);
  assert.match(js, /fieldset/);
  assert.match(js, /legend/);
  assert.ok(!/localStorage/.test(js) || !/answer/i.test((js.match(/localStorage[^;]*;/g) || []).join(" ")), "answers are not kept in browser storage");
  const app = fs.readFileSync(path.join(ROOT, "public/app.html"), "utf8");
  assert.match(app, /d\.training/, "the case screen shows the training link when the gate stops someone");
  const plus = fs.readFileSync(path.join(ROOT, "public/app-plus.js"), "utf8");
  assert.match(plus, /\/training/);
  assert.match(plus, /Volunteer training/);
  const toml = fs.readFileSync(path.join(ROOT, "wrangler.example.toml"), "utf8");
  assert.match(toml, /TRAINING_REQUIRED = "on"/);
});
