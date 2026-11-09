// SPDX-License-Identifier: AGPL-3.0-only
// In-memory stand-ins for the Cloudflare bindings, so the real worker runs in Node with no network and no deploy.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".pdf": "application/pdf" };

export function kv() {
  const m = new Map();
  return {
    _map: m,
    async get(k) { return m.has(k) ? m.get(k) : null; },
    async put(k, v) { m.set(k, String(v)); },
    async delete(k) { m.delete(k); },
    async list({ prefix = "" } = {}) { return { keys: [...m.keys()].filter(k => k.startsWith(prefix)).sort().map(name => ({ name })), list_complete: true }; },
  };
}

export function assets() {
  return {
    async fetch(req) {
      const u = new URL(typeof req === "string" ? req : req.url);
      let p = decodeURIComponent(u.pathname);
      if (p === "/") p = "/index.html";
      if (!path.extname(p)) p += ".html";
      const f = path.join(ROOT, "public", p);
      if (!f.startsWith(path.join(ROOT, "public")) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return new Response("Not found", { status: 404 });
      const buf = fs.readFileSync(f);
      return new Response(buf, { status: 200, headers: { "content-type": TYPES[path.extname(f)] || "application/octet-stream", "content-length": String(buf.length) } });
    },
  };
}

export function r2() {
  const m = new Map();
  const obj = (key, v) => ({ key, size: v.buf.byteLength, uploaded: v.uploaded, httpEtag: '"e"', body: new Response(v.buf).body, writeHttpMetadata(h) { if (v.type) h.set("content-type", v.type); } });
  return {
    _map: m,
    async put(key, val, opts = {}) { const buf = val instanceof ArrayBuffer ? new Uint8Array(val) : typeof val === "string" ? new TextEncoder().encode(val) : new Uint8Array(val.buffer || val); m.set(key, { buf, type: opts.httpMetadata && opts.httpMetadata.contentType, uploaded: new Date() }); },
    async get(key) { const v = m.get(key); return v ? obj(key, v) : null; },
    async delete(key) { m.delete(key); },
    async list({ prefix = "" } = {}) { return { objects: [...m.keys()].filter(k => k.startsWith(prefix)).map(k => ({ key: k, size: m.get(k).buf.byteLength, uploaded: m.get(k).uploaded })), truncated: false }; },
  };
}

// Just enough of D1 for the statements the worker uses.
export function d1() {
  const t = { access_log: [], evidence: [], case_views: [] };
  const run = (sql, args) => {
    const s = sql.replace(/\s+/g, " ").trim();
    if (s.startsWith("INSERT INTO access_log")) { const [ts, email, ip, action, detail] = args; t.access_log.push({ id: t.access_log.length + 1, ts, email, ip, action, detail }); return []; }
    if (s.startsWith("INSERT INTO evidence")) { const [slug, h, name, size, sha256, ts, by, prev, row] = args; t.evidence.push({ id: t.evidence.length + 1, slug, h, name, size, sha256, ts, by, prev, row }); return []; }
    if (s === "SELECT row FROM evidence ORDER BY id DESC LIMIT 1") return t.evidence.slice(-1);
    if (s === "SELECT h,size,sha256,ts,by FROM evidence WHERE slug=? ORDER BY id") return t.evidence.filter(r => r.slug === args[0]);
    if (s === "SELECT sha256,ts FROM evidence WHERE slug=? AND h=? ORDER BY id LIMIT 1") return t.evidence.filter(r => r.slug === args[0] && r.h === args[1]).slice(0, 1);
    if (s === "SELECT id,slug,h,name,size,sha256,ts,by,prev,row FROM evidence ORDER BY id") return t.evidence.slice();
    if (s === "SELECT ts,email,ip,action,detail FROM access_log ORDER BY id DESC LIMIT 300") return t.access_log.slice().reverse();
    if (s === "INSERT INTO case_views (ts,slug,who,role,action,what) VALUES (?,?,?,?,?,?)") { const [ts, slug, who, role, action, what] = args; t.case_views.push({ id: t.case_views.length + 1, ts, slug, who, role, action, what }); return []; }
    if (s === "SELECT ts,who,role,action,what FROM case_views WHERE slug=? AND ts>=? ORDER BY id DESC LIMIT 500") return t.case_views.filter(r => r.slug === args[0] && r.ts >= args[1]).reverse().slice(0, 500);
    if (s === "DELETE FROM case_views WHERE ts < ?") { t.case_views = t.case_views.filter(r => !(r.ts < args[0])); return []; }
    if (s === "DELETE FROM access_log WHERE ts < ?") { t.access_log = t.access_log.filter(r => !(r.ts < args[0])); return []; }
    if (s === "DELETE FROM case_views WHERE slug=?") { t.case_views = t.case_views.filter(r => r.slug !== args[0]); return []; }
    throw new Error("mock D1 does not know: " + s);
  };
  const stmt = (sql, args = []) => ({
    bind: (...a) => stmt(sql, a),
    run: async () => { run(sql, args); return { success: true }; },
    first: async () => run(sql, args)[0] || null,
    all: async () => ({ results: run(sql, args) }),
  });
  return { _t: t, prepare: sql => stmt(sql) };
}

export function makeEnv(extra = {}) {
  const calls = [];
  return {
    COMMENTS: kv(), ASSETS: assets(), FILES: r2(), DB: d1(),
    AI: { _calls: calls, async run(model, input) { calls.push({ model, input }); return { response: "A test answer from the mock AI." }; } },
    ADMIN_EMAILS: "admin@example.org", MAIL_DOMAIN: "mail.example.org", TRAINING_REQUIRED: "off", // the training gate has its own tests (tests/training.test.mjs)
    ...extra,
  };
}

export function ctx() { const ps = []; return { waitUntil(p) { ps.push(Promise.resolve(p).catch(() => { })); }, done: () => Promise.all(ps) }; }

// A tiny browser: keeps the session cookie and talks to the worker directly.
export function client(worker, env) {
  let cookie = "";
  const c = ctx();
  const go = async (method, p, body, headers = {}) => {
    const h = new Headers(headers);
    if (cookie) h.set("Cookie", cookie);
    let b = body;
    if (body && typeof body === "object" && !(body instanceof ArrayBuffer) && !(body instanceof Uint8Array)) { b = JSON.stringify(body); h.set("content-type", "application/json"); }
    const res = await worker.fetch(new Request("http://localhost:8787" + p, { method, headers: h, body: b, redirect: "manual" }), env, c);
    const sc = res.headers.get("set-cookie"); if (sc) cookie = sc.split(";")[0];
    return res;
  };
  return { get: (p, h) => go("GET", p, null, h), post: (p, b, h) => go("POST", p, b, h), hasCookie: () => !!cookie && !cookie.endsWith("="), ctx: c };
}
