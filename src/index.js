// SPDX-License-Identifier: AGPL-3.0-only
// Legal Agente Commons: the case organizer's Cloudflare Worker (sign-in, roles, case data, files, search, email in).
// Built from a private case app with every real case removed. The only case in this repo is made up: src/sample-case.js.
// Email parser (postal-mime 4.1.4, vendored; see src/vendor/postal-mime-4.1.4/LICENSE.txt).
import PostalMime from "./vendor/postal-mime-4.1.4/postal-mime.js";
// Passkeys (@simplewebauthn/server 14.0.3, MIT, bundled into one file; see src/vendor/simplewebauthn-server-14.0.3/README.txt).
import { generateRegistrationOptions, verifyRegistrationResponse, generateAuthenticationOptions, verifyAuthenticationResponse, isoBase64URL } from "./vendor/simplewebauthn-server-14.0.3/swa-server.min.mjs";
// Case data. Real cases never go in this repo: they live in the private store of a deployment (KV "case:<code>").
import { SAMPLE_CASES, SAMPLE_COUNSEL_CODES } from "./sample-case.js";
// Ask AI rules enforced in code (cited pages only, advice notice) and dates found in the papers.
import { adviceAsked, isSpanish, checkCites, ADVICE_NOTICE } from "./grounding.js";
import { paperDates, PAPER_DATES_PHASE } from "./paper-dates.js";

const CASES = SAMPLE_CASES;

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}
// Counsel-only codes: the same case with the owner's private parts removed
// (Counsel & fees assessments, private notes, request rows marked priv). Own storage slug.
const COUNSEL_CODES = SAMPLE_COUNSEL_CODES;
function counselView(code) {
  const cfg = COUNSEL_CODES[code]; if (!cfg) return null;
  const b = CASES[cfg.base]; if (!b) return null;
  const d = JSON.parse(JSON.stringify(b.data));
  delete d.fees;
  if (d.requests && Array.isArray(d.requests.rows)) d.requests.rows = d.requests.rows.filter(r => !r.priv);
  d.hideTabs = cfg.hideTabs;
  // Files marked "Private (owner only)" never show in the counsel view, nor do links that point at them.
  if (d.files && Array.isArray(d.files.groups)) {
    const privIds = new Set();
    d.files.groups.filter(g => /^private/i.test(g.group)).forEach(g => g.items.forEach(it => { const m = /\/d\/([A-Za-z0-9_-]{10,})/.exec(it.u || ""); if (m) privIds.add(m[1]); }));
    d.files.groups = d.files.groups.filter(g => !/^private/i.test(g.group));
    const isPriv = u => { const m = /\/d\/([A-Za-z0-9_-]{10,})/.exec(u || ""); return !!(m && privIds.has(m[1])); };
    (d.timeline || []).forEach(ph => ph.events.forEach(ev => { if (isPriv(ev.u)) delete ev.u; }));
  }
  return { slug: b.slug + "-counsel", data: d };
}
// Cases added from the admin page live in KV as "case:<code>" = { slug, data, owner, created }.
// The wrapper loads the one a request names into DYN before the app code runs.
const DYN = new Map();
async function loadDyn(env, code) {
  const k = String(code == null ? "" : code).trim();
  if (!k || CASES[k] || COUNSEL_CODES[k]) return;
  const raw = await env.COMMENTS.get("case:" + k);
  if (raw) DYN.set(k, JSON.parse(raw)); else DYN.delete(k);
}
function caseByCode(code) {
  if (typeof code !== "string") return null;
  const k = code.trim();
  return CASES[k] || counselView(k) || DYN.get(k) || null;
}
const baseSlug = s => String(s || "").replace(/-counsel$/, "");
function laUser(request) { const v = request.headers.get("X-LA-User") || ""; const i = v.lastIndexOf("|"); return i > 0 ? { email: v.slice(0, i), role: v.slice(i + 1) } : null; }
async function textFor(env, request, c) {
  // Page text for a case: the built index (static cases) plus anything uploaded since (KV "text:<slug>").
  const out = { files: [], chunks: [] };
  if (c.data.textIndex && c.data.textIndex !== "@kv" && c.data.cf) {
    try { const r = await env.ASSETS.fetch(new Request(new URL(c.data.cf + c.data.textIndex, request.url), request)); if (r.ok) { const t = await r.json(); out.files = t.files; out.chunks = t.chunks; } } catch { }
  }
  const extra = JSON.parse((await env.COMMENTS.get("text:" + baseSlug(c.slug))) || "null");
  if (extra) { const off = out.files.length; out.files = out.files.concat(extra.files); out.chunks = out.chunks.concat(extra.chunks.map(ch => ({ f: ch.f + off, p: ch.p, t: ch.t }))); }
  if (ownerView(request, c)) mergeText(out, JSON.parse((await env.COMMENTS.get("textp:" + baseSlug(c.slug))) || "null"));
  return out;
}
async function aiJson(env, system, user, maxTokens) {
  const MODELS = ["@cf/meta/llama-4-scout-17b-16e-instruct", "@cf/meta/llama-3.3-70b-instruct-fp8-fast", "@cf/mistralai/mistral-small-3.1-24b-instruct"];
  let last = "";
  for (const m of MODELS) {
    try {
      const out = await env.AI.run(m, { messages: [{ role: "system", content: system }, { role: "user", content: user }], max_tokens: maxTokens || 1500 });
      const txt = String((out && (out.response || (out.choices && out.choices[0] && out.choices[0].message && out.choices[0].message.content))) || "");
      const a = txt.indexOf("{"), b = txt.lastIndexOf("}");
      if (a >= 0 && b > a) return JSON.parse(txt.slice(a, b + 1));
      last = "no JSON";
    } catch (e) { last = (e && e.message) || String(e); }
  }
  throw new Error(last || "AI unavailable");
}
function caseCorpus(d) {
  const strip = s => String(s).replace(/<[^>]+>/g, "");
  let s = "CASE: " + d.title + " — " + d.cn + "\n\nPARTIES & FACTS:\n";
  for (const id in d.nodes) { const n = d.nodes[id]; s += "- " + n.nm + " (" + n.role + "): " + n.facts.map(f => f[0] + " [" + f[1] + "]").join("  ") + "\n"; }
  s += "\nCONTACTS:\n";
  for (const k in (d.contacts || {})) { const c = d.contacts[k]; s += "- " + c.who + " (" + (c.role || "") + "): " + [].concat(c.emails || [], c.phones || [], c.address || "", c.note || "").filter(Boolean).join("; ") + "\n"; }
  s += "\nTIMELINE:\n"; (d.timeline || []).forEach(p => p.events.forEach(ev => s += "- " + ev.d + ": " + ev.t + "\n"));
  s += "\nMONEY TRAIL:\n"; (d.money || []).forEach(r => s += "- " + r[0] + ": " + strip(r[2]) + "\n");
  s += "\nLAWS & DAMAGES MAP:\n"; ((d.laws && d.laws.sections) || []).forEach(sec => { s += "* " + sec.name + "\n"; sec.rows.forEach(r => { s += "  - " + strip(r.law) + ": " + strip(r.did) + (r.money ? "  WORTH: " + strip(r.money) : "") + (r.caveat ? "  CAVEAT: " + strip(r.caveat) : "") + "\n"; }); });
  if (d.laws && d.laws.gates) { s += "CAUTIONS:\n"; d.laws.gates.forEach(g => s += "  - " + strip(g) + "\n"); }
  s += "\nLETTERS:\n"; (d.letters || []).forEach(l => s += "- " + l.date + " " + l.title + " (" + l.party + "): " + l.body + "\n");
  s += "\nCOUNSEL & FEES (" + ((d.fees && d.fees.total) || "") + "):\n"; ((d.fees && d.fees.rows) || []).forEach(r => s += "- " + r.who + " (" + r.firm + ", " + r.role + "): " + (r.amount || "none located") + " — " + (r.paid || "") + "\n");
  s += "\nREQUESTS & RESPONSES:\n"; ((d.requests && d.requests.rows) || []).forEach(r => s += "- " + r.who + " " + r.date + ": " + r.ask + "  => " + r.resp + "\n");
  s += "\nDISCOVERY RESPONSES:\n"; ((d.responses && d.responses.docs) || []).forEach(dc => { s += "* " + dc.doc + ": " + dc.summary + "\n"; (dc.items || []).forEach(it => s += "   - " + it.k + ": " + it.v + "\n"); });
  if (d.invest) { s += "\nINVESTIGATIONS (public records; [violation] = possible violation to raise with counsel, [review], [info], [cleared]):\n";
    d.invest.parties.forEach(p => { s += "* " + p.nm + " - " + p.role + (p.ids ? " (" + p.ids + ")" : "") + "\n";
      (p.findings || []).forEach(f => s += "  - [" + f[0] + "] " + f[1] + ": " + f[2] + " [" + f[3] + "]\n");
      if ((p.todo || []).length) s += "  - still to check: " + p.todo.join("; ") + "\n"; }); }
  s += "\nPUBLIC RECORDS / PORTALS:\n"; (d.portals || []).forEach(g => g.items.forEach(it => s += "- " + it.t + ": " + it.d + "\n"));
  return s;
}
function keyFor(slug, thread) {
  return thread && thread !== "main" ? "comments:" + slug + ":" + thread : "comments:" + slug;
}
async function readComments(env, slug, thread) {
  const raw = await env.COMMENTS.get(keyFor(slug, thread));
  return raw ? JSON.parse(raw) : [];
}
async function readStore(env, ns, slug) {
  const raw = await env.COMMENTS.get(ns + ":" + slug);
  return raw ? JSON.parse(raw) : {};
}

// ==== Added 5 Nov 2026: who sees owner-only items, file fingerprints, citation checks, email into a case ====

// Owner-only items (mail sent to the case's private address) show only to an admin in the owner's own view,
// never in a lawyer view and never to an invited user.
function ownerView(request, c) { const me = laUser(request); return !!(me && me.role === "admin" && c && c.slug === baseSlug(c.slug)); }
async function visibleUploads(env, request, c) {
  const ups = JSON.parse((await env.COMMENTS.get("uploads:" + baseSlug(c.slug))) || "[]");
  return ownerView(request, c) ? ups : ups.filter(u => u.vis !== "owner");
}
async function visibleMail(env, request, c) {
  const list = JSON.parse((await env.COMMENTS.get("mail:" + baseSlug(c.slug))) || "[]");
  return ownerView(request, c) ? list : list.filter(m => m.vis !== "owner");
}
// Every file this view can see: handle -> title.
async function visibleFileMap(env, request, c) {
  const m = new Map();
  ((c.data.files || {}).groups || []).forEach(g => (g.items || []).forEach(it => { if (it.h) m.set(it.h, it.t); }));
  (await visibleUploads(env, request, c)).forEach(u => m.set("up/" + u.key, u.n));
  return m;
}
function mergeText(t, p) {
  if (!p || !Array.isArray(p.files)) return t;
  const off = t.files.length; t.files = t.files.concat(p.files); t.chunks = t.chunks.concat(p.chunks.map(ch => ({ f: ch.f + off, p: ch.p, t: ch.t })));
  return t;
}

// ---- File fingerprints (SHA-256). One append-only log in D1 for every case, each row chained to the one before:
//   CREATE TABLE evidence (id INTEGER PRIMARY KEY AUTOINCREMENT, slug TEXT NOT NULL, h TEXT NOT NULL, name TEXT, size INTEGER,
//     sha256 TEXT NOT NULL, ts TEXT NOT NULL, by TEXT, prev TEXT NOT NULL, row TEXT NOT NULL);
//   row = SHA-256 of prev|slug|h|name|size|sha256|ts|by. Changing or deleting any row breaks every row after it.
const EV_ZERO = "0".repeat(64);
function evRowText(prev, r) { return [prev, r.slug, r.h, r.name || "", Number(r.size) || 0, r.sha256, r.ts, r.by || ""].join("|"); }
async function __shaBuf(buf) { return __hex(await crypto.subtle.digest("SHA-256", buf)); }
async function __shaBody(body) {
  if (typeof crypto.DigestStream === "function" && body && typeof body.pipeTo === "function") { const ds = new crypto.DigestStream("SHA-256"); await body.pipeTo(ds); return __hex(await ds.digest); }
  return __shaBuf(await new Response(body).arrayBuffer());
}
async function evRecord(env, rec) {
  if (!env.DB) return null;
  const last = await env.DB.prepare("SELECT row FROM evidence ORDER BY id DESC LIMIT 1").first();
  const prev = (last && last.row) || EV_ZERO;
  const r = { slug: rec.slug, h: rec.h, name: String(rec.name || "").slice(0, 200), size: Number(rec.size) || 0, sha256: rec.sha, ts: new Date().toISOString(), by: String(rec.by || "").slice(0, 120) };
  const row = await __sha(evRowText(prev, r));
  await env.DB.prepare("INSERT INTO evidence (slug,h,name,size,sha256,ts,by,prev,row) VALUES (?,?,?,?,?,?,?,?,?)").bind(r.slug, r.h, r.name, r.size, r.sha256, r.ts, r.by, prev, row).run();
  return { ts: r.ts, row };
}
async function fileSha(env, request, c, h) {
  const bs = baseSlug(c.slug);
  if (h.startsWith("up/")) {
    const key = h.slice(3); if (!key.startsWith("cases/" + bs + "/") || !env.FILES) return null;
    const o = await env.FILES.get(key); return o ? { sha: await __shaBody(o.body), size: o.size } : null;
  }
  const r = await env.ASSETS.fetch(new Request(new URL((c.data.cf || "/cf/" + bs + "/") + h, request.url)));
  if (!r.ok) return null;
  const size = Number(r.headers.get("content-length")) || 0;
  return { sha: await __shaBody(r.body), size };
}

// ---- Citation checks: find case citations locally, send only the citations to CourtListener (Free Law Project) ----
const CL_LOOKUP = "https://www.courtlistener.com/api/rest/v4/citation-lookup/";
async function clToken(env) { return env.COURTLISTENER_TOKEN || (await env.COMMENTS.get("cfg:courtlistener")) || ""; }
function citeLink(f) { return "https://www.courtlistener.com/c/" + encodeURIComponent(f.rep) + "/" + f.vol + "/" + encodeURIComponent(f.page) + "/"; }
function citeName(before) {
  // The case name written just before the citation: "Smith v. Jones, " or "In re Estate of Smith, ".
  const s = before.replace(/\s+/g, " ");
  let m = /(?:^|[\s(;])((?:In re|Ex parte|In the Matter of)\s[^;:()]{2,90}?),?\s*$/.exec(s);
  if (m) return m[1].trim();
  const vi = Math.max(s.lastIndexOf(" v. "), s.lastIndexOf(" vs. "), s.lastIndexOf(" v "));
  if (vi < 0 || s.length - vi > 140) return "";
  // Parallel citations ("Iqbal, 556 U.S. 662, 678, 129 S. Ct. 1937") share the name written before the first one.
  const right = s.slice(vi).replace(/^\s(?:v\.|vs\.|v)\s/, "").replace(/,\s*\d.*$/, "").replace(/,\s*$/, "").trim();
  if (!right || /[;()]/.test(right)) return "";
  const words = s.slice(0, vi).split(" "), left = [];
  const SMALL = /^(of|the|and|de|del|la|el|for|in|on|ex|rel\.?|&)$/i, SIGNAL = /^(See|Cf\.?|But|Accord|Also|E\.g\.,?|Compare|Contra|citing|quoting|In|see)$/;
  for (let i = words.length - 1; i >= 0 && left.length < 8; i--) {
    const w = words[i]; if (!w) break;
    if (/[;:()]/.test(w)) break;
    if (/[.:]$/.test(w) && left.length && !/^[A-Z][a-z]{0,3}\.$|^[A-Z]\.[A-Z]?\.?$/.test(w)) break;
    if (SIGNAL.test(w) && left.length) break;
    if (/^[A-Z0-9&]/.test(w) || SMALL.test(w)) left.unshift(w); else break;
  }
  while (left.length && SMALL.test(left[0])) left.shift();
  return left.length ? (left.join(" ") + " v. " + right).replace(/,$/, "") : "";
}
function citeFind(text) {
  const s = String(text || "");
  const RE = /\b(\d{1,4})\s+([A-Z][A-Za-z.']*(?:\s?(?:[A-Z][A-Za-z.']*|\d{1,2}(?:d|nd|rd|th|st)\b))*)\s+([A-Z]?\d{1,5})\b/g;
  const out = [], seen = new Set(); let m;
  while ((m = RE.exec(s)) && out.length < 150) {
    const rep = m[2].replace(/\s+/g, " ").trim();
    if (!rep.includes(".") || rep.length > 32 || /\bStat\b|\bCode\b|\bConst\b|\bAdmin\b|\bR\.\s?Civ|\bU\.S\.C/.test(rep) || /\b(?:St|Ave|Rd|Blvd|Dr|Ste|Apt|No|Nos|Vol|Ex|Doc|Pg|Pp|Sec)\.?$/i.test(rep)) continue;
    const cite = m[1] + " " + rep + " " + m[3];
    if (seen.has(cite)) continue; seen.add(cite);
    out.push({ cite, vol: m[1], rep, page: m[3], name: citeName(s.slice(Math.max(0, m.index - 200), m.index)) });
  }
  return out;
}
function nameMatch(written, found) {
  const STOP = new Set(["the", "and", "inc", "llc", "corp", "company", "corporation", "ltd", "state", "florida", "united", "states", "estate", "matter", "parte", "city", "county", "dept", "department", "bank", "national", "association", "ins", "insurance"]);
  const toks = x => String(x || "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter(w => w.length >= 3 && !STOP.has(w));
  const a = toks(written), b = new Set(toks(found));
  if (!a.length || !b.size) return null;
  return a.some(w => b.has(w)) ? "match" : "differs";
}

// ---- Email into a case. Each case has two private addresses: one shared with the lawyer view, one only for the owner.
// KV: "mailcfg:<slug>" = { shared, owner, senders: [] }, "mailin:<token>" = { slug, vis }, "mail:<slug>" = list of filed emails.
// The mail domain comes from the MAIL_DOMAIN setting (wrangler.toml [vars]); the default is a placeholder.
const mailDomain = env => String((env && env.MAIL_DOMAIN) || "mail.example.org").trim().toLowerCase();
const mailAddr = (env, t) => "in-" + t + "@" + mailDomain(env);
async function mailCfg(env, bs) {
  let cfg = JSON.parse((await env.COMMENTS.get("mailcfg:" + bs)) || "null") || { senders: [] }, changed = false;
  for (const vis of ["shared", "owner"]) if (!cfg[vis]) {
    const t = __hex(crypto.getRandomValues(new Uint8Array(12)));
    await env.COMMENTS.put("mailin:" + t, JSON.stringify({ slug: bs, vis, created: new Date().toISOString() }));
    cfg[vis] = t; changed = true;
  }
  if (changed) await env.COMMENTS.put("mailcfg:" + bs, JSON.stringify(cfg));
  return cfg;
}
async function mailSenderOk(env, box, from) {
  from = String(from || "").toLowerCase().trim(); if (!from) return false;
  const cfg = JSON.parse((await env.COMMENTS.get("mailcfg:" + box.slug)) || "{}");
  if ((cfg.senders || []).includes(from)) return true;
  const u = await __getUser(env, from); if (!u) return false;
  if (u.role === "admin") return true;
  if (box.vis !== "shared") return false;
  for (const code of (u.codes || [])) { await loadDyn(env, code); const c = caseByCode(code); if (c && baseSlug(c.slug) === box.slug) return true; }
  return false;
}
function parseForward(body) {
  // The header block of the message that was forwarded (Gmail, Outlook, Apple Mail; English or Spanish).
  const s = String(body || "");
  const mk = /-{2,}\s*(?:Forwarded message|Original Message|Mensaje reenviado|Mensaje original)\s*-{2,}|Begin forwarded message:|Inicio del mensaje reenviado:/i.exec(s);
  let rest;
  if (mk) rest = s.slice(mk.index + mk[0].length, mk.index + mk[0].length + 3000);
  else { const o = /^[ \t>*]*(?:From|De):[ \t].+\r?\n(?:.*\r?\n){0,6}?[ \t>*]*(?:Sent|Date|Enviado|Fecha):[ \t].+/im.exec(s); if (!o) return null; rest = s.slice(o.index, o.index + 3000); }
  const field = names => { const m = new RegExp("^[ \\t>*]*(?:" + names + ")\\*?:[ \\t]*(.+)$", "im").exec(rest); return m ? m[1].replace(/\*+\s*$/, "").trim() : ""; };
  const out = { from: field("From|De"), date: field("Date|Sent|Fecha|Enviado(?: el)?"), subject: field("Subject|Asunto"), to: field("To|Para"), cc: field("Cc") };
  return out.from || out.date ? out : null;
}
function toIsoDay(t) {
  let s = String(t || "").trim(); if (!s) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  s = s.replace(/\(.*?\)/g, " ").replace(/\s+at\s+/i, " ").replace(/^[A-Za-z]{3,9}\.?,\s*/, "").replace(/\s+/g, " ").trim();
  const d = Date.parse(s);
  if (!isNaN(d)) {
    // With a time zone: the day in Florida. Without one: the day exactly as written.
    const hasZone = /\s[+-]\d{4}\b|[+-]\d{2}:\d{2}$|\bGMT\b|\bUTC\b|\b[ECMP][SD]T\b|\dZ$/.test(s);
    const x = new Date(d);
    if (!hasZone) return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0") + "-" + String(x.getDate()).padStart(2, "0");
    try { return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(x); } catch (e) { return x.toISOString().slice(0, 10); }
  }
  const MES = { ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6, jul: 7, ago: 8, sep: 9, set: 9, oct: 10, nov: 11, dic: 12 };
  const m = /(\d{1,2})\s+(?:de\s+)?([A-Za-zÁÉÍÓÚáéíóú]{3,})\.?\s+(?:de\s+)?(\d{4})/.exec(s);
  if (m && MES[m[2].slice(0, 3).toLowerCase()]) return m[3] + "-" + String(MES[m[2].slice(0, 3).toLowerCase()]).padStart(2, "0") + "-" + m[1].padStart(2, "0");
  return "";
}
const shortWho = s => { const t = String(s || "").split(/[,;]/)[0].replace(/<[^>]*>/g, "").replace(/["']/g, "").trim(); return (t || String(s || "")).slice(0, 60); };
async function mailIngest(env, box, raw, sender) {
  const bs = box.slug, vis = box.vis;
  const em = await PostalMime.parse(raw, { attachmentEncoding: "arraybuffer" });
  const mid = String(em.messageId || "").slice(0, 300);
  const prior = JSON.parse((await env.COMMENTS.get("mail:" + bs)) || "[]");
  if (mid && prior.some(x => x.mid === mid && x.vis === vis)) return { dup: true };
  const body = String(em.text || "").replace(/\r\n/g, "\n");
  const addr = a => a ? (a.name ? a.name + " <" + (a.address || "") + ">" : a.address || "") : "";
  const hdr = { from: addr(em.from), to: (em.to || []).map(addr).join(", "), cc: (em.cc || []).map(addr).join(", "), date: em.date || "", subject: em.subject || "(no subject)" };
  const fwd = parseForward(body);
  const orig = fwd
    ? { from: fwd.from || hdr.from, to: fwd.to, cc: fwd.cc, subject: fwd.subject || hdr.subject.replace(/^\s*(?:(?:fwd?|fw|rv|reenv[ií]o)\s*:\s*)+/i, ""), dateText: fwd.date }
    : { from: hdr.from, to: hdr.to, cc: hdr.cc, subject: hdr.subject, dateText: hdr.date };
  let date = toIsoDay(orig.dateText), dateSrc = fwd ? "original" : "sent";
  if (!date) { date = toIsoDay(hdr.date); dateSrc = "forwarded"; }
  const now = new Date().toISOString(), day = now.slice(0, 10), id = "m" + Date.now().toString(36) + __hex(crypto.getRandomValues(new Uint8Array(3)));
  const safe = s => String(s || "").replace(/[\\/:*?"<>|\r\n\t#%]+/g, "-").replace(/\s+/g, "-").slice(0, 80) || "file";
  const subj = String(orig.subject || "(no subject)").replace(/[\r\n]+/g, " ").slice(0, 120);
  const saved = [];
  const put = async (name, buf, type, note, needText) => {
    const key = "cases/" + bs + "/" + day + "-" + __hex(crypto.getRandomValues(new Uint8Array(4))) + "-" + safe(name);
    const sha = await __shaBuf(buf);
    await env.FILES.put(key, buf, { httpMetadata: { contentType: type }, sha256: sha });
    const rec = { key, n: name, size: buf.byteLength, type, by: sender, ts: now, src: "email", vis, mail: id, note, sha };
    if (needText) rec.needText = true;
    saved.push(rec);
    try { await evRecord(env, { slug: bs, h: "up/" + key, name, size: buf.byteLength, sha, by: sender + " (email)" }); } catch (e) { }
    return rec;
  };
  const emlRec = await put("Email " + (date || day) + " - " + subj + " (original).eml", raw, "message/rfc822", "the email exactly as it arrived", false);
  const atts = [];
  for (const a of (em.attachments || []).slice(0, 40)) {
    const buf = a.content instanceof ArrayBuffer ? a.content : (a.content && a.content.buffer instanceof ArrayBuffer ? a.content.buffer.slice(a.content.byteOffset, a.content.byteOffset + a.content.byteLength) : null);
    if (!buf || !buf.byteLength || buf.byteLength > 60 * 1024 * 1024) continue;
    if (a.related || (a.disposition === "inline" && /^image\//i.test(a.mimeType || "") && buf.byteLength < 30000)) continue; // logos in signatures
    const nm = String(a.filename || "attachment-" + (atts.length + 1)).replace(/[\r\n]+/g, " ").slice(0, 140);
    const doc = /pdf$/i.test(a.mimeType || "") || /\.pdf$/i.test(nm) || /^image\/(jpe?g|png)/i.test(a.mimeType || "") || /^audio\//i.test(a.mimeType || "") || AUDIO_RE.test(nm); // read (or transcribed) in the browser later
    const r = await put(nm, buf, a.mimeType || "application/octet-stream", "attached to the email: " + subj, doc);
    atts.push({ h: "up/" + r.key, n: nm });
  }
  const lines = ["Email filed in Legal Agente", "Received " + now.replace("T", " ").slice(0, 16) + " UTC, sent in by " + sender, ""];
  if (fwd) lines.push("The forwarded message:");
  lines.push("From: " + orig.from, "To: " + (orig.to || ""));
  if (orig.cc) lines.push("Cc: " + orig.cc);
  lines.push("Date: " + (orig.dateText || hdr.date), "Subject: " + subj);
  if (atts.length) lines.push("Attachments: " + atts.map(x => x.n).join(", "));
  lines.push("", "----------", "", body.slice(0, 400000));
  const txt = lines.join("\n");
  const txtRec = await put("Email " + (date || day) + " - " + subj + ".txt", new TextEncoder().encode(txt).buffer, "text/plain; charset=utf-8", "readable copy of the email", false);
  const ups = JSON.parse((await env.COMMENTS.get("uploads:" + bs)) || "[]");
  await env.COMMENTS.put("uploads:" + bs, JSON.stringify(ups.concat(saved)));
  const tkey = (vis === "owner" ? "textp:" : "text:") + bs;
  const t = JSON.parse((await env.COMMENTS.get(tkey)) || '{"files":[],"chunks":[]}');
  const fi = t.files.length; t.files.push({ n: txtRec.n, h: "up/" + txtRec.key, g: "Emailed in" });
  for (let i = 0, p = 1; i < txt.length && p <= 200; i += 6000, p++) t.chunks.push({ f: fi, p, t: txt.slice(i, i + 6000) });
  await env.COMMENTS.put(tkey, JSON.stringify(t));
  const list = JSON.parse((await env.COMMENTS.get("mail:" + bs)) || "[]");
  list.push({ id, mid, vis, sender, received: now, from: orig.from, to: orig.to || "", subject: subj, date, dateText: orig.dateText || "", dateSrc, txt: txtRec.key, eml: emlRec.key, atts });
  await env.COMMENTS.put("mail:" + bs, JSON.stringify(list.slice(-3000)));
  return { id, files: saved.length, attachments: atts.length, date, subject: subj };
}

// ==== Added 5 Nov 2026 (late): search by meaning · audio transcripts ====

// ---- Search by meaning (English and Spanish). Model: Workers AI @cf/baai/bge-m3, 1024 numbers per window of text.
// Static cases: public/cf/<slug>/_vec.bin, built once from _text.json by a build script that is not in this repo yet (same windows as vecWindows).
//   Layout "LAV1" | dims u32 | count u32 | chunks in _text.json u32 | count×u32 chunk index | count×f32 scale | count×dims int8.
// Uploaded, emailed and transcribed text: KV "vec:<slug>" (shared) and "vecp:<slug>" (owner only), a map "<h>#<page>" -> [{s, q}],
//   filled in the background after text is added and topped up on each search. A lawyer view never reads vecp.
const VEC_MODEL = "@cf/baai/bge-m3", VEC_DIMS = 1024;
function vecWindows(t, max = 1200, overlap = 150) {
  t = String(t || "").replace(/\s+/g, " ").trim();
  if (t.length < 20) return [];
  const out = [];
  let i = 0;
  while (i < t.length) {
    let end = Math.min(t.length, i + max);
    if (end < t.length) { const s = t.lastIndexOf(". ", end); const sp = t.lastIndexOf(" ", end); const cut = s > i + max * 0.6 ? s + 1 : sp > i + max * 0.6 ? sp : end; end = cut; }
    out.push(t.slice(i, end).trim());
    if (end >= t.length) break;
    i = Math.max(end - overlap, i + 1);
    const sp = t.indexOf(" ", i); if (sp > 0 && sp < end) i = sp + 1;
  }
  return out;
}
function vecParse(buf) {
  if (!buf || buf.byteLength < 16 || new TextDecoder().decode(new Uint8Array(buf, 0, 4)) !== "LAV1") return null;
  const dv = new DataView(buf), dims = dv.getUint32(4, true), n = dv.getUint32(8, true), chunks = dv.getUint32(12, true);
  if (dims !== VEC_DIMS || buf.byteLength !== 16 + 8 * n + dims * n) return null;
  return { dims, n, chunks, ci: new Uint32Array(buf, 16, n), sc: new Float32Array(buf, 16 + 4 * n, n), q: new Int8Array(buf, 16 + 8 * n, dims * n) };
}
const __vecStatic = new Map();
async function vecStatic(env, request, c) {
  if (!c.data.textIndex || c.data.textIndex === "@kv" || !c.data.cf) return null;
  if (__vecStatic.has(c.data.cf)) return __vecStatic.get(c.data.cf);
  let v = null;
  try { const r = await env.ASSETS.fetch(new Request(new URL(c.data.cf + "_vec.bin", request.url))); if (r.ok) v = vecParse(await r.arrayBuffer()); } catch (e) { v = null; }
  __vecStatic.set(c.data.cf, v);
  return v;
}
async function vecEmbed(env, texts) {
  const out = await env.AI.run(VEC_MODEL, { text: texts });
  const d = out && (out.data || out.response);
  if (!Array.isArray(d) || d.length !== texts.length) throw new Error("embedding failed");
  return d;
}
function vecQuant(v) {
  let n = 0; for (const x of v) n += x * x; n = Math.sqrt(n) || 1;
  let m = 0; for (const x of v) m = Math.max(m, Math.abs(x / n));
  const s = m / 127 || 1, q = new Uint8Array(v.length);
  for (let i = 0; i < v.length; i++) q[i] = Math.round(v[i] / n / s) & 255;
  let bin = ""; for (let i = 0; i < q.length; i++) bin += String.fromCharCode(q[i]);
  return { s, q: btoa(bin) };
}
function vecUnq(b64) { const bin = atob(b64), a = new Int8Array(bin.length); for (let i = 0; i < bin.length; i++) a[i] = (bin.charCodeAt(i) << 24) >> 24; return a; }
// Embed text not yet embedded ("text" = shared, "textp" = owner only). At most maxWin windows per call; the rest wait for the next call.
async function vecFill(env, which, bs, maxWin) {
  const t = JSON.parse((await env.COMMENTS.get(which + ":" + bs)) || "null");
  const vkey = (which === "textp" ? "vecp:" : "vec:") + bs;
  const m = JSON.parse((await env.COMMENTS.get(vkey)) || "{}");
  if (!t || !t.chunks || !t.chunks.length || !env.AI) return { m, pending: 0 };
  const todo = []; let changed = false;
  for (const ch of t.chunks) {
    const f = t.files[ch.f]; if (!f) continue;
    const k = f.h + "#" + ch.p; if (m[k]) continue;
    const ws = vecWindows(ch.t); if (!ws.length) { m[k] = []; changed = true; continue; }
    const nm = String(f.n || "").replace(/\.[a-z0-9]+$/i, "").slice(0, 80);
    todo.push({ k, ws: ws.map(w => nm + ": " + w) });
  }
  const pick = []; let used = 0;
  for (const it of todo) { if (used && used + it.ws.length > maxWin) break; pick.push(it); used += it.ws.length; }
  const flat = []; pick.forEach(it => it.ws.forEach(w => flat.push(w)));
  const vecs = [];
  for (let i = 0; i < flat.length; i += 24) { try { (await vecEmbed(env, flat.slice(i, i + 24))).forEach(v => vecs.push(vecQuant(v))); } catch (e) { break; } }
  let at = 0;
  for (const it of pick) { if (at + it.ws.length > vecs.length) break; m[it.k] = vecs.slice(at, at + it.ws.length); at += it.ws.length; changed = true; }
  if (changed) await env.COMMENTS.put(vkey, JSON.stringify(m));
  return { m, pending: todo.filter(it => !m[it.k]).length };
}
async function meaningSearch(env, request, c, q, k) {
  const raw = (await vecEmbed(env, [q]))[0];
  let nn = 0; for (const x of raw) nn += x * x; nn = Math.sqrt(nn) || 1;
  const qv = new Float32Array(raw.length); for (let i = 0; i < raw.length; i++) qv[i] = raw[i] / nn;
  const out = [];
  const sv = await vecStatic(env, request, c);
  if (sv) {
    const best = new Map();
    for (let j = 0; j < sv.n; j++) { let d = 0; const o = j * sv.dims; for (let i = 0; i < sv.dims; i++) d += qv[i] * sv.q[o + i]; d *= sv.sc[j]; const ci = sv.ci[j]; const b = best.get(ci); if (b === undefined || d > b) best.set(ci, d); }
    for (const [i, s] of best) out.push({ i, s });
  }
  const bs = baseSlug(c.slug); let pending = 0;
  for (const which of ownerView(request, c) ? ["text", "textp"] : ["text"]) {
    const r = await vecFill(env, which, bs, 96); pending += r.pending;
    for (const key in r.m) {
      let best = -1;
      for (const w of r.m[key]) { const a = vecUnq(w.q); let d = 0; for (let i = 0; i < a.length; i++) d += qv[i] * a[i]; d *= w.s; if (d > best) best = d; }
      if (best > -1) { const cut = key.lastIndexOf("#"); out.push({ h: key.slice(0, cut), p: Number(key.slice(cut + 1)) || 1, s: best }); }
    }
  }
  out.sort((a, b) => b.s - a.s);
  return { hits: out.slice(0, k).map(x => Object.assign(x, { s: Math.round(x.s * 1000) / 1000 })), staticChunks: sv ? sv.chunks : 0, pending };
}

// ---- Audio: transcripts made in the browser, a few minutes at a time, by Workers AI @cf/openai/whisper-large-v3-turbo.
// Saved in KV "tx:<slug>" as { "<h>": { lines: [[seconds, text]], duration, lang, by, ts } } and added to the case text,
// one "page" per minute, so search, Ask AI and meaning search find what was said. Owner-only recordings keep owner-only transcripts.
const AUDIO_RE = /\.(mp3|m4a|wav|ogg|oga|opus|webm|aac|amr|3gp|flac|wma|caf)$/i;
async function saveTranscript(env, request, c, b) {
  const bs = baseSlug(c.slug), h = String(b.h || "");
  if (!h.startsWith("up/cases/" + bs + "/")) return { ok: false, error: "Bad file." };
  const ups = JSON.parse((await env.COMMENTS.get("uploads:" + bs)) || "[]"), urec = ups.find(u => "up/" + u.key === h);
  if (!urec) return { ok: false, error: "Bad file." };
  if (urec.vis === "owner" && !ownerView(request, c)) return { ok: false, error: "Bad file." };
  const lines = (Array.isArray(b.lines) ? b.lines : []).slice(0, 20000).map(x => [Math.max(0, Math.round((Number(x && x[0]) || 0) * 10) / 10), String((x && x[1]) || "").replace(/\s+/g, " ").trim().slice(0, 2000)]).filter(x => x[1]);
  if (!lines.length) return { ok: false, error: "Nothing was heard in this recording." };
  lines.sort((a, b2) => a[0] - b2[0]);
  const me = laUser(request);
  const rec = { lines, duration: Math.max(0, Number(b.duration) || 0), lang: String(b.lang || "").slice(0, 8), by: me ? me.email : "", ts: new Date().toISOString(), n: urec.n, vis: urec.vis || "" };
  const tx = JSON.parse((await env.COMMENTS.get("tx:" + bs)) || "{}"); tx[h] = rec;
  await env.COMMENTS.put("tx:" + bs, JSON.stringify(tx));
  // Text index: replace any earlier transcript of this file.
  const which = urec.vis === "owner" ? "textp" : "text", tkey = which + ":" + bs;
  const t = JSON.parse((await env.COMMENTS.get(tkey)) || '{"files":[],"chunks":[]}');
  let fi = t.files.findIndex(f => f.h === h);
  if (fi < 0) { fi = t.files.length; t.files.push({ n: urec.n + " (transcript)", h, g: urec.src === "email" ? "Emailed in" : "Uploaded", audio: 1 }); }
  else t.chunks = t.chunks.filter(ch => ch.f !== fi);
  const mm = s => { s = Math.floor(s); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); };
  const byMin = new Map(); lines.forEach(([s, txt]) => { const p = Math.floor(s / 60) + 1; byMin.set(p, (byMin.get(p) || "") + "[" + mm(s) + "] " + txt + " "); });
  for (const [p, txt] of byMin) t.chunks.push({ f: fi, p, t: txt.trim() });
  await env.COMMENTS.put(tkey, JSON.stringify(t));
  const vkey = (which === "textp" ? "vecp:" : "vec:") + bs, vm = JSON.parse((await env.COMMENTS.get(vkey)) || "{}");
  let dropped = false; for (const k in vm) if (k.startsWith(h + "#")) { delete vm[k]; dropped = true; }
  if (dropped) await env.COMMENTS.put(vkey, JSON.stringify(vm));
  if (urec.needText) { const cur = JSON.parse((await env.COMMENTS.get("uploads:" + bs)) || "[]"); const u = cur.find(x => x.key === urec.key); if (u) { delete u.needText; await env.COMMENTS.put("uploads:" + bs, JSON.stringify(cur)); } }
  return { ok: true, lines: lines.length, which };
}

const __app = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // --- unlock a case: code in, case data out (only on valid code) ---
    if (url.pathname === "/api/case" && request.method === "POST") {
      let body;
      try { body = await request.json(); } catch { return json({ ok: false, error: "Bad request." }, 400); }
      const c = caseByCode(body.code);
      if (!c) return json({ ok: false, error: "No case matches that code." }, 403);
      const data = JSON.parse(JSON.stringify(c.data));
      data.cf = data.cf || "/cf/" + baseSlug(c.slug) + "/";
      data.textIndex = data.textIndex || "@kv"; // uploaded documents are searchable in every case
      const ups = await visibleUploads(env, request, c);
      if (ups.length) {
        const item = u => Object.assign({ t: u.n, h: "up/" + u.key, d: [u.by, (u.ts || "").slice(0, 10), u.vis === "owner" ? "only you" : "", u.note].filter(Boolean).join(" · ") }, u.needText ? { x: 1 } : {});
        const plain = ups.filter(u => u.src !== "email"), mailed = ups.filter(u => u.src === "email");
        data.files = data.files || { intro: "Documents for this case.", groups: [] };
        data.files.groups = (data.files.groups || []).concat(
          plain.length ? [{ group: "Uploaded (requests and phone)", items: plain.slice().reverse().map(item) }] : [],
          mailed.length ? [{ group: "Emailed in", items: mailed.slice().reverse().map(item) }] : []);
      }
      // Emails filed into the case appear on the timeline, dated by the original message when it was forwarded.
      const mails = await visibleMail(env, request, c);
      if (mails.length) {
        const ev = mails.map(m => ({
          d: m.date || m.dateText || String(m.received || "").slice(0, 10),
          t: "Email from " + shortWho(m.from) + (m.to ? " to " + shortWho(m.to) : "") + ": " + m.subject + (m.atts && m.atts.length ? " (" + m.atts.length + " attachment" + (m.atts.length > 1 ? "s" : "") + ")" : ""),
          s: "Emailed in" + (m.dateSrc === "forwarded" ? " · date it was forwarded; check the original" : "") + (m.vis === "owner" ? " · only you" : ""),
          u: data.cf + "up/" + m.txt,
        }));
        ev.sort((a, b) => { const x = Date.parse(a.d), y = Date.parse(b.d); return (isNaN(x) ? 9e15 : x) - (isNaN(y) ? 9e15 : y); });
        data.timeline = (data.timeline || []).concat([{ phase: "Emails filed into the case", events: ev }]);
      }
      // Dates written in the papers (the built page text plus uploads this person may see), each linked to its page.
      // Dates already on the timeline for the same file are left out. Nothing is calculated: people check each one.
      try {
        // A plain GET copy of the request: this POST's body has already been read, and the file fetch reuses the request.
        const pt = await textFor(env, new Request(request.url, { headers: request.headers }), c);
        const found = paperDates(pt.files, pt.chunks, { cf: data.cf, timeline: data.timeline });
        if (found.length) data.timeline = (data.timeline || []).concat([{ phase: PAPER_DATES_PHASE, auto: true, events: found }]);
      } catch { }
      data.dynamic = !CASES[String(body.code).trim()] && !COUNSEL_CODES[String(body.code).trim()];
      return json({ ok: true, slug: c.slug, case: data });
    }

    // --- AI: answer a question grounded in the case file (code-gated) ---
    if (url.pathname === "/api/ask" && request.method === "POST") {
      let body;
      try { body = await request.json(); } catch { return json({ ok: false, error: "Bad request." }, 400); }
      const c = caseByCode(body.code);
      if (!c) return json({ ok: false, error: "Locked." }, 403);
      const q = String(body.q || "").slice(0, 500).trim();
      if (!q) return json({ ok: false, error: "Ask a question." }, 400);
      if (!env.AI) return json({ ok: false, error: "AI is not enabled on this deployment." });
      // Page excerpts found by the browser's search over the case documents, cited back as [n].
      const exList = (Array.isArray(body.excerpts) ? body.excerpts : []).slice(0, 12);
      const lang = isSpanish(q) ? "es" : "en";
      const notice = adviceAsked(q) ? ADVICE_NOTICE[lang] : "";
      const ex = exList.map((e, i) => "[" + (i + 1) + "] " + String(e.n || "").slice(0, 160) + ", page " + (Number(e.p) || 1) + ":\n" + String(e.t || "").slice(0, 1500)).join("\n\n");
      const messages = [
        { role: "system", content: "You are the case-file assistant for \"" + c.data.title + "\" (" + c.data.cn + "). Answer ONLY using the CASE FILE and the DOCUMENT EXCERPTS below. Be concise, factual and neutral; quote figures and dates exactly as written. " + (ex ? "Whenever a fact comes from an excerpt, cite it right after the sentence like [2] (several: [1][3]). Prefer the excerpts over the summary when they are more specific. " : "") + "If the answer is not in the file, say so and suggest which section to check. Never invent facts, names, numbers or citations. You organize and find; you never give legal advice. If asked what someone should do, whether they will win, or what the law requires of them, say that a licensed lawyer must answer that, and point to the facts in the file that the lawyer will need. Answer in the language of the question (" + (lang === "es" ? "Spanish, using usted" : "English") + ").\n\n=== CASE FILE ===\n" + caseCorpus(c.data) + (ex ? "\n\n=== DOCUMENT EXCERPTS ===\n" + ex : "") },
        { role: "user", content: q },
      ];
      const MODELS = [
        "@cf/meta/llama-4-scout-17b-16e-instruct",
        "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
        "@cf/meta/llama-3.1-8b-instruct-fast",
        "@cf/mistralai/mistral-small-3.1-24b-instruct",
        "@cf/qwen/qwen2.5-coder-32b-instruct",
        "@cf/meta/llama-3-8b-instruct",
      ];
      let lastErr = "";
      for (const m of MODELS) {
        try {
          const out = await env.AI.run(m, { messages, max_tokens: 700 });
          const ans = out && (out.response || (out.choices && out.choices[0] && out.choices[0].message && out.choices[0].message.content));
          if (ans && String(ans).trim()) {
            // Only pages the AI was given may be cited; an answer with no cited page is flagged for the reader.
            const g = checkCites(ans, exList.length);
            return json({ ok: true, answer: g.text, model: m, cited: g.cited, grounded: g.grounded, notice, lang });
          }
        } catch (e) { lastErr = (e && e.message) || String(e); }
      }
      return json({ ok: false, error: "AI temporarily unavailable (" + (lastErr || "no model responded") + "). Keyword search still works.", notice, lang });
    }

    // --- AI: rewrite a rough answer into a formal discovery response ---
    if (url.pathname === "/api/rewrite" && request.method === "POST") {
      let body;
      try { body = await request.json(); } catch { return json({ ok: false, error: "Bad request." }, 400); }
      const c = caseByCode(body.code);
      if (!c) return json({ ok: false, error: "Locked." }, 403);
      const q = String(body.q || "").slice(0, 2500);
      const draft = String(body.draft || "").slice(0, 4000).trim();
      const kind = String(body.kind || "");
      if (String(env.AI_DRAFTING || "") !== "on") return json({ ok: false, error: "AI drafting is switched off on this deployment. A lawyer decides whether to turn it on (AI_DRAFTING = \"on\")." });
      if (!draft) return json({ ok: false, error: "Write a rough answer first, then Rewrite." });
      if (!env.AI) return json({ ok: false, error: "AI is not enabled on this deployment." });
      const guide = kind === "admission"
        ? "This is a Request for Admission. Begin the response with ADMITTED, DENIED, or \"Admitted in part and denied in part,\" matching what the client's rough answer indicates, then give a concise supporting explanation."
        : kind === "production"
        ? "This is a Request for Production. State whether responsive documents will be produced, are not in the client's possession/custody/control, or are objected to (and why) — matching the rough answer."
        : "This is an Interrogatory. Give a clear, complete, professionally-phrased narrative answer.";
      const messages = [
        { role: "system", content: "You are a Florida litigation paralegal drafting formal discovery responses for the client in \"" + c.data.title + "\" (" + c.data.cn + "). Rewrite the client's ROUGH ANSWER to the REQUEST into a clean, professional, legally-phrased response. " + guide + " Use ONLY the facts contained in the client's rough answer — do NOT invent facts, dates, dollar amounts, names, or documents, and do not add legal conclusions the client did not state. Keep it concise. This is a draft for the supervising lawyer to review; never add advice. Output ONLY the response text, with no preamble, labels, or quotation marks." },
        { role: "user", content: "REQUEST:\n" + q + "\n\nROUGH ANSWER (client's own words):\n" + draft + "\n\nRewrite the rough answer as a formal response:" },
      ];
      const RWMODELS = ["@cf/meta/llama-4-scout-17b-16e-instruct", "@cf/meta/llama-3.3-70b-instruct-fp8-fast", "@cf/mistralai/mistral-small-3.1-24b-instruct", "@cf/meta/llama-3-8b-instruct"];
      let lastErr = "";
      for (const m of RWMODELS) {
        try {
          const out = await env.AI.run(m, { messages, max_tokens: 600 });
          const ans = out && (out.response || (out.choices && out.choices[0] && out.choices[0].message && out.choices[0].message.content));
          if (ans && String(ans).trim()) return json({ ok: true, answer: String(ans).trim() });
        } catch (e) { lastErr = (e && e.message) || String(e); }
      }
      return json({ ok: false, error: "AI temporarily unavailable (" + (lastErr || "no model") + ")." });
    }

    // --- editable stores (responses, requests, answers): code-gated, shared, saved to KV ---
    if (url.pathname === "/api/store") {
      // 2 = shared between the owner's view and the lawyer view (stored under the base slug).
      const NS = { responses: 1, requests: 1, answers: 1, layout: 1, proof: 2, deadlines: 2, docreqs: 2 };
      const sslug = (c, ns) => NS[ns] === 2 ? baseSlug(c.slug) : c.slug;
      if (request.method === "GET") {
        const c = caseByCode(url.searchParams.get("code"));
        if (!c) return json({ ok: false, error: "Locked." }, 403);
        const ns = String(url.searchParams.get("ns") || "");
        if (!NS[ns]) return json({ ok: false, error: "Bad store." }, 400);
        return json({ ok: true, docs: await readStore(env, ns, sslug(c, ns)) });
      }
      if (request.method === "POST") {
        let body;
        try { body = await request.json(); } catch { return json({ ok: false, error: "Bad request." }, 400); }
        const c = caseByCode(body.code);
        if (!c) return json({ ok: false, error: "Locked." }, 403);
        const ns = String(body.ns || "");
        if (!NS[ns]) return json({ ok: false, error: "Bad store." }, 400);
        const id = String(body.id || "").slice(0, 32).replace(/[^a-z0-9_-]/gi, "");
        if (!id) return json({ ok: false, error: "Bad id." }, 400);
        const text = String(body.text == null ? "" : body.text).slice(0, 40000);
        const me = laUser(request);
        const by = (me && me.email) || String(body.by || "").slice(0, 60).trim() || "Anonymous";
        const ts = new Date().toISOString().replace("T", " ").slice(0, 16) + " UTC";
        const obj = await readStore(env, ns, sslug(c, ns));
        if (text === "" && NS[ns] === 2) delete obj[id]; else obj[id] = { text, by, ts };
        await env.COMMENTS.put(ns + ":" + sslug(c, ns), JSON.stringify(obj));
        return json({ ok: true, by, ts });
      }
      return json({ ok: false, error: "Method not allowed." }, 405);
    }

    // --- uploads: private file bucket, one folder per case ---
    if (url.pathname === "/api/upload" && request.method === "POST") {
      const c = caseByCode(url.searchParams.get("code") || "");
      if (!c) return json({ ok: false, error: "Locked." }, 403);
      if (!env.FILES) return json({ ok: false, error: "Uploads are not set up." }, 500);
      const me = laUser(request);
      const name = String(url.searchParams.get("name") || "file").slice(0, 140).replace(/[\\/:*?"<>|]+/g, "-");
      const buf = await request.arrayBuffer();
      if (!buf.byteLength) return json({ ok: false, error: "Empty file." }, 400);
      if (buf.byteLength > 60 * 1024 * 1024) return json({ ok: false, error: "Files up to 60 MB." }, 413);
      const bs = baseSlug(c.slug), day = new Date().toISOString().slice(0, 10);
      const key = "cases/" + bs + "/" + day + "-" + __hex(crypto.getRandomValues(new Uint8Array(4))) + "-" + name.replace(/\s+/g, "-");
      const type = request.headers.get("Content-Type") || "application/octet-stream";
      // Fingerprint: worked out here from the bytes received; if the browser sent its own, they must agree.
      const sha = await __shaBuf(buf), want = String(url.searchParams.get("sha") || "").toLowerCase();
      if (want && want !== sha) return json({ ok: false, error: "The file changed on the way up. Please try again." }, 400);
      await env.FILES.put(key, buf, { httpMetadata: { contentType: type }, sha256: sha });
      const list = JSON.parse((await env.COMMENTS.get("uploads:" + bs)) || "[]");
      const rec = { key, n: name, size: buf.byteLength, type, by: me ? me.email : "", ts: new Date().toISOString(), req: String(url.searchParams.get("req") || "").slice(0, 32), note: String(url.searchParams.get("note") || "").slice(0, 200), sha };
      list.push(rec);
      await env.COMMENTS.put("uploads:" + bs, JSON.stringify(list));
      if (rec.req) {
        const obj = await readStore(env, "docreqs", bs);
        if (obj[rec.req]) { try { const r = JSON.parse(obj[rec.req].text); r.files = (r.files || []).concat([{ h: "up/" + key, n: name }]); if (url.searchParams.get("done") === "1") { r.status = "done"; r.doneAt = rec.ts; } obj[rec.req] = { text: JSON.stringify(r), by: rec.by, ts: obj[rec.req].ts }; await env.COMMENTS.put("docreqs:" + bs, JSON.stringify(obj)); } catch { } }
      }
      let fp = null; try { fp = await evRecord(env, { slug: bs, h: "up/" + key, name, size: buf.byteLength, sha, by: (me ? me.email : "") + " (upload)" }); } catch (e) { }
      return json({ ok: true, h: "up/" + key, n: name, sha, fingerprint: !!fp });
    }
    if (url.pathname === "/api/text" && request.method === "GET") {
      const c = caseByCode(url.searchParams.get("code") || "");
      if (!c) return json({ ok: false, error: "Locked." }, 403);
      const t = JSON.parse((await env.COMMENTS.get("text:" + baseSlug(c.slug))) || '{"files":[],"chunks":[]}');
      if (ownerView(request, c)) mergeText(t, JSON.parse((await env.COMMENTS.get("textp:" + baseSlug(c.slug))) || "null"));
      return json(t);
    }
    if (url.pathname === "/api/text-add" && request.method === "POST") {
      let body; try { body = await request.json(); } catch { return json({ ok: false, error: "Bad request." }, 400); }
      const c = caseByCode(body.code);
      if (!c) return json({ ok: false, error: "Locked." }, 403);
      const h = String(body.h || ""), bs = baseSlug(c.slug);
      if (!h.startsWith("up/cases/" + bs + "/")) return json({ ok: false, error: "Bad file." }, 400);
      const ups = JSON.parse((await env.COMMENTS.get("uploads:" + bs)) || "[]"), urec = ups.find(u => "up/" + u.key === h);
      if (urec && urec.vis === "owner" && !ownerView(request, c)) return json({ ok: false, error: "Bad file." }, 400);
      const tkey = (urec && urec.vis === "owner" ? "textp:" : "text:") + bs;
      const done = async () => { if (urec && urec.needText) { const cur = JSON.parse((await env.COMMENTS.get("uploads:" + bs)) || "[]"); const u = cur.find(x => x.key === urec.key); if (u) { delete u.needText; await env.COMMENTS.put("uploads:" + bs, JSON.stringify(cur)); } } };
      const pages = (Array.isArray(body.pages) ? body.pages : []).slice(0, 2000).map(t => String(t || "").slice(0, 20000));
      const t = JSON.parse((await env.COMMENTS.get(tkey)) || '{"files":[],"chunks":[]}');
      if (t.files.some(f => f.h === h)) { await done(); return json({ ok: true, already: true }); }
      const fi = t.files.length; t.files.push({ n: String(body.n || h.split("/").pop()).slice(0, 160), h, g: urec && urec.src === "email" ? "Emailed in" : "Uploaded" });
      pages.forEach((txt, i) => { if (txt.trim()) t.chunks.push({ f: fi, p: i + 1, t: txt }); });
      const out = JSON.stringify(t);
      if (out.length > 24 * 1024 * 1024) return json({ ok: false, error: "The text index for this case is full." }, 413);
      await env.COMMENTS.put(tkey, out);
      await done();
      if (ctx && ctx.waitUntil) ctx.waitUntil(vecFill(env, tkey.split(":")[0], bs, 240).catch(() => { })); // ready for search by meaning
      return json({ ok: true, pages: pages.length });
    }

    // --- search by meaning: the closest pages to a question, in any language ---
    if (url.pathname === "/api/meaning" && request.method === "POST") {
      let body; try { body = await request.json(); } catch { return json({ ok: false, error: "Bad request." }, 400); }
      const c = caseByCode(body.code);
      if (!c) return json({ ok: false, error: "Locked." }, 403);
      const q = String(body.q || "").replace(/\s+/g, " ").trim().slice(0, 500);
      if (!q) return json({ ok: false, error: "Ask a question." }, 400);
      if (!env.AI) return json({ ok: false, error: "AI is not enabled on this deployment." });
      try { const r = await meaningSearch(env, request, c, q, Math.min(30, Math.max(1, Number(body.k) || 12))); return json({ ok: true, ...r }); }
      catch (e) { return json({ ok: false, error: "Search by meaning is not available right now." }); }
    }

    // --- audio: turn a few minutes of speech into text (the browser cuts long recordings into parts) ---
    if (url.pathname === "/api/transcribe" && request.method === "POST") {
      const c = caseByCode(url.searchParams.get("code") || "");
      if (!c) return json({ ok: false, error: "Locked." }, 403);
      if (!env.AI) return json({ ok: false, error: "AI is not enabled on this deployment." });
      const b64 = (await request.text()).replace(/^data:[^,]*,/, "").replace(/\s+/g, "");
      if (b64.length < 200) return json({ ok: false, error: "No sound was sent." }, 400);
      if (b64.length > 16 * 1024 * 1024) return json({ ok: false, error: "Send shorter parts (under 10 MB)." }, 413);
      if (!/^[A-Za-z0-9+/]+=*$/.test(b64)) return json({ ok: false, error: "Bad audio." }, 400);
      const lang = url.searchParams.get("lang");
      const opts = { audio: b64, task: "transcribe", vad_filter: true, condition_on_previous_text: false };
      if (lang === "en" || lang === "es") opts.language = lang;
      try {
        const out = await env.AI.run("@cf/openai/whisper-large-v3-turbo", opts);
        const segs = ((out && out.segments) || []).map(s => ({ start: Math.round((Number(s.start) || 0) * 10) / 10, end: Math.round((Number(s.end) || 0) * 10) / 10, text: String(s.text || "").trim() })).filter(s => s.text);
        return json({ ok: true, text: String((out && out.text) || "").trim(), segments: segs, lang: (out && out.transcription_info && out.transcription_info.language) || lang || "" });
      } catch (e) { return json({ ok: false, error: "This part could not be transcribed (" + String((e && e.message) || e).slice(0, 120) + ")." }, 502); }
    }
    if (url.pathname === "/api/transcript") {
      if (request.method === "GET") {
        const c = caseByCode(url.searchParams.get("code") || "");
        if (!c) return json({ ok: false, error: "Locked." }, 403);
        const tx = JSON.parse((await env.COMMENTS.get("tx:" + baseSlug(c.slug))) || "{}"), own = ownerView(request, c), items = {};
        for (const h in tx) if (own || tx[h].vis !== "owner") items[h] = tx[h];
        return json({ ok: true, items });
      }
      if (request.method === "POST") {
        let body; try { body = await request.json(); } catch { return json({ ok: false, error: "Bad request." }, 400); }
        const c = caseByCode(body.code);
        if (!c) return json({ ok: false, error: "Locked." }, 403);
        const r = await saveTranscript(env, request, c, body);
        if (r.ok && ctx && ctx.waitUntil) ctx.waitUntil(vecFill(env, r.which, baseSlug(c.slug), 240).catch(() => { }));
        return json(r, r.ok ? 200 : 400);
      }
      return json({ ok: false, error: "Method not allowed." }, 405);
    }

    // --- file fingerprints: the first record of every file this view can see ---
    if (url.pathname === "/api/evidence" && request.method === "GET") {
      const c = caseByCode(url.searchParams.get("code") || "");
      if (!c) return json({ ok: false, error: "Locked." }, 403);
      const vis = await visibleFileMap(env, request, c);
      const rows = env.DB ? ((await env.DB.prepare("SELECT h,size,sha256,ts,by FROM evidence WHERE slug=? ORDER BY id").bind(baseSlug(c.slug)).all()).results || []) : [];
      const first = {};
      rows.forEach(x => { if (!vis.has(x.h)) return; if (!first[x.h]) first[x.h] = { h: x.h, sha: x.sha256, ts: x.ts, by: x.by, size: x.size }; });
      return json({ ok: true, files: vis.size, items: Object.values(first) });
    }
    // --- check files against their first fingerprint (worked out again here, from the stored bytes) ---
    if (url.pathname === "/api/evidence/check" && request.method === "POST") {
      let body; try { body = await request.json(); } catch { return json({ ok: false, error: "Bad request." }, 400); }
      const c = caseByCode(body.code);
      if (!c) return json({ ok: false, error: "Locked." }, 403);
      const me = laUser(request), bs = baseSlug(c.slug), vis = await visibleFileMap(env, request, c);
      const record = !!body.record && me && me.role === "admin";
      const hs = [...new Set((Array.isArray(body.hs) ? body.hs : []).map(String))].slice(0, 8);
      const out = []; let changed = 0, added = 0;
      for (const h of hs) {
        if (!vis.has(h)) { out.push({ h, status: "unknown" }); continue; }
        const rec = env.DB ? await env.DB.prepare("SELECT sha256,ts FROM evidence WHERE slug=? AND h=? ORDER BY id LIMIT 1").bind(bs, h).first() : null;
        let cur = null; try { cur = await fileSha(env, request, c, h); } catch (e) { cur = null; }
        if (!cur) { out.push({ h, status: "missing" }); continue; }
        if (!rec && record) { const r = await evRecord(env, { slug: bs, h, name: vis.get(h), size: cur.size, sha: cur.sha, by: me.email + " (first record)" }); added++; out.push({ h, status: "same", sha: cur.sha, first: r ? r.ts : null, recorded: true }); continue; }
        const st = !rec ? "new" : rec.sha256 === cur.sha ? "same" : "changed";
        if (st === "changed") changed++;
        out.push({ h, status: st, sha: cur.sha, first: rec ? rec.ts : null, was: st === "changed" ? rec.sha256 : undefined });
      }
      __log(env, ctx, request, me && me.email, "checked fingerprints", out.length + " files" + (changed ? ", " + changed + " CHANGED" : "") + (added ? ", " + added + " recorded" : "") + " · " + (body.code || ""));
      return json({ ok: true, results: out });
    }

    // --- citation check: only the citations go to CourtListener, never the rest of the text ---
    if (url.pathname === "/api/cite-check" && request.method === "POST") {
      let body; try { body = await request.json(); } catch { return json({ ok: false, error: "Bad request." }, 400); }
      const c = caseByCode(body.code);
      if (!c) return json({ ok: false, error: "Locked." }, 403);
      let text = String(body.text || "").slice(0, 400000);
      if (body.h) {
        const h = String(body.h), T = await textFor(env, request, c), fi = T.files.findIndex(f => f.h === h);
        if (fi < 0) return json({ ok: false, error: "No readable text for that document yet." }, 400);
        text = T.chunks.filter(ch => ch.f === fi).map(ch => ch.t).join("\n").slice(0, 400000);
      }
      const found = citeFind(text);
      if (!found.length) return json({ ok: true, cites: [] });
      const token = await clToken(env);
      const base = f => ({ cite: f.cite, name: f.name, link: citeLink(f) });
      if (!token) return json({ ok: true, needsToken: true, cites: found.map(f => ({ ...base(f), status: "not_checked" })) });
      const joined = found.map(f => f.cite).join("\n"), starts = []; let o = 0; found.forEach(f => { starts.push(o); o += f.cite.length + 1; });
      let res;
      try {
        const r = await fetch(CL_LOOKUP, { method: "POST", headers: { Authorization: "Token " + token, "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "LegalAgenteCommons/0.1" }, body: "text=" + encodeURIComponent(joined) });
        if (r.status === 401 || r.status === 403) return json({ ok: false, error: "CourtListener did not accept the saved token. Save a new one in Admin, Settings." });
        if (r.status === 429) return json({ ok: false, error: "CourtListener says too many checks right now. Wait a minute and try again." });
        if (!r.ok) return json({ ok: false, error: "CourtListener did not answer (" + r.status + "). Try again later." });
        res = await r.json();
      } catch (e) { return json({ ok: false, error: "Could not reach CourtListener. Try again later." }); }
      const byIdx = new Map();
      (Array.isArray(res) ? res : []).forEach(x => { const i = starts.findIndex((st, k) => x.start_index >= st && x.start_index < st + found[k].cite.length); if (i >= 0 && !byIdx.has(i)) byIdx.set(i, x); });
      const ST = { 200: "found", 300: "several", 404: "not_found", 400: "bad", 429: "limit" };
      const cites = found.map((f, i) => {
        const x = byIdx.get(i);
        if (!x) return { ...base(f), status: "not_case" };
        const cases = (x.clusters || []).slice(0, 5).map(k => ({ name: k.case_name || k.case_name_full || "", date: k.date_filed || "", url: k.absolute_url ? "https://www.courtlistener.com" + k.absolute_url : "" }));
        const nc = f.name && cases.length ? (cases.some(k => nameMatch(f.name, k.name) === "match") ? "match" : cases.every(k => nameMatch(f.name, k.name) === null) ? null : "differs") : null;
        return { ...base(f), status: ST[x.status] || "error", cases, nameCheck: nc, msg: String(x.error_message || "").slice(0, 300) };
      });
      const me = laUser(request);
      __log(env, ctx, request, me && me.email, "checked citations", cites.length + " citations, " + cites.filter(x => x.status === "not_found" || x.status === "bad" || x.nameCheck === "differs").length + " flagged · " + (body.code || ""));
      return json({ ok: true, cites });
    }

    // --- email into the case: the two private addresses, and who may send to them ---
    if (url.pathname === "/api/mailin") {
      const me = laUser(request), isAdm = !!(me && me.role === "admin");
      let body = {}; if (request.method === "POST") { try { body = await request.json(); } catch { return json({ ok: false, error: "Bad request." }, 400); } }
      const c = caseByCode(request.method === "POST" ? body.code : url.searchParams.get("code"));
      if (!c) return json({ ok: false, error: "Locked." }, 403);
      const bs = baseSlug(c.slug); let cfg = await mailCfg(env, bs);
      if (request.method === "POST") {
        if (!isAdm || !ownerView(request, c)) return json({ ok: false, error: "Only the case owner can change this." }, 403);
        if (body.op === "rotate" && (body.which === "shared" || body.which === "owner")) {
          await env.COMMENTS.delete("mailin:" + cfg[body.which]); cfg[body.which] = null;
          await env.COMMENTS.put("mailcfg:" + bs, JSON.stringify(cfg)); cfg = await mailCfg(env, bs);
          __log(env, ctx, request, me.email, "email address replaced", body.which + " · " + bs);
        } else if (body.op === "senders") {
          cfg.senders = [...new Set((Array.isArray(body.senders) ? body.senders : []).map(s => String(s).trim().toLowerCase()).filter(s => __EMAIL_RE.test(s)))].slice(0, 12);
          await env.COMMENTS.put("mailcfg:" + bs, JSON.stringify(cfg));
          __log(env, ctx, request, me.email, "email senders changed", cfg.senders.join(", ").slice(0, 250));
        } else return json({ ok: false, error: "Unknown change." }, 400);
      }
      const own = ownerView(request, c);
      return json({ ok: true, shared: mailAddr(env, cfg.shared), owner: own ? mailAddr(env, cfg.owner) : null, senders: own ? cfg.senders || [] : null, me: me ? me.email : null });
    }
    if (url.pathname === "/api/extract" && request.method === "POST") {
      const me = laUser(request);
      if (!me || me.role !== "admin") return json({ ok: false, error: "Admins only." }, 403);
      let body; try { body = await request.json(); } catch { return json({ ok: false, error: "Bad request." }, 400); }
      const c = caseByCode(body.code);
      if (!c) return json({ ok: false, error: "Locked." }, 403);
      if (!env.AI) return json({ ok: false, error: "AI is not enabled on this deployment." });
      const T = await textFor(env, request, c);
      const fi = T.files.findIndex(f => f.h === String(body.h || ""));
      if (fi < 0) return json({ ok: false, error: "No readable text for that document yet. Scanned photos need text first." }, 400);
      let doc = ""; for (const ch of T.chunks) if (ch.f === fi && doc.length < 24000) doc += "\n[page " + ch.p + "]\n" + ch.t.slice(0, 4000);
      try {
        const out = await aiJson(env,
          "You read one legal-case document and list what is in it. Reply with JSON only, no prose: {\"events\":[{\"date\":\"YYYY-MM-DD if certain, else the date exactly as written\",\"what\":\"one plain sentence\",\"page\":N}],\"people\":[{\"name\":\"...\",\"role\":\"how they relate to the case\"}],\"money\":[{\"amount\":\"$...\",\"what\":\"one plain sentence\",\"page\":N}]}. Only include things the text actually says. Never guess dates, names or amounts. At most 25 events, 15 people, 15 money items.",
          "DOCUMENT: " + T.files[fi].n + "\n" + doc, 1800);
        const clean = a => Array.isArray(a) ? a : [];
        return json({ ok: true, doc: T.files[fi].n, h: T.files[fi].h, events: clean(out.events).slice(0, 25), people: clean(out.people).slice(0, 15), money: clean(out.money).slice(0, 15) });
      } catch (e) { return json({ ok: false, error: "AI could not read it right now (" + ((e && e.message) || e) + ")." }); }
    }
    if (url.pathname === "/api/case-edit" && request.method === "POST") {
      const me = laUser(request);
      if (!me || me.role !== "admin") return json({ ok: false, error: "Admins only." }, 403);
      let body; try { body = await request.json(); } catch { return json({ ok: false, error: "Bad request." }, 400); }
      const code = String(body.code || "").trim();
      const raw = await env.COMMENTS.get("case:" + code);
      if (!raw) return json({ ok: false, error: "Only cases added from the admin page can be edited here." }, 400);
      const rec = JSON.parse(raw), d = rec.data, op = String(body.op || "");
      const str = (v, n) => String(v == null ? "" : v).slice(0, n);
      if (op === "addEvents") {
        const ph = d.timeline[0] || (d.timeline[0] = { phase: "Timeline", events: [] });
        (Array.isArray(body.events) ? body.events : []).slice(0, 60).forEach(e => ph.events.push({ d: str(e.d, 60), t: str(e.t, 1200), s: str(e.s, 200), u: e.u ? str(e.u, 600) : undefined, f: e.f === "*" ? "*" : undefined }));
        ph.events.sort((a, b) => { const x = Date.parse(a.d), y = Date.parse(b.d); return (isNaN(x) ? 9e15 : x) - (isNaN(y) ? 9e15 : y); });
      } else if (op === "addPeople") {
        const ids = Object.keys(d.nodes);
        (Array.isArray(body.people) ? body.people : []).slice(0, 30).forEach(pp => {
          const nm = str(pp.name, 80).trim(); if (!nm) return;
          let id = nm.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 16) || "p"; while (d.nodes[id]) id += "x";
          d.nodes[id] = { nm, rl: str(pp.role, 80), role: str(pp.role, 200), facts: [], x: 0, y: 0, w: Math.max(120, Math.min(260, nm.length * 8 + 34)) }; ids.push(id);
        });
        ids.forEach((id, i) => { const a = (i / Math.max(1, ids.length)) * Math.PI * 2, n = d.nodes[id]; n.w = n.w || 140; n.x = Math.round(540 + 380 * Math.cos(a) - n.w / 2); n.y = Math.round(290 + 220 * Math.sin(a)); });
      } else if (op === "addMoney") {
        (Array.isArray(body.money) ? body.money : []).slice(0, 40).forEach(m => d.money.push([str(m.amount, 40), "", str(m.what, 600)]));
      } else if (op === "setInfo") {
        if (body.title) d.title = str(body.title, 160); if (body.cn != null) d.cn = str(body.cn, 300); if (body.note != null) d.moneyNote = str(body.note, 600);
      } else return json({ ok: false, error: "Unknown change." }, 400);
      rec.updated = new Date().toISOString();
      await env.COMMENTS.put("case:" + code, JSON.stringify(rec));
      return json({ ok: true });
    }

    // --- comments: require a valid code on every call ---
    if (url.pathname === "/api/comments") {
      if (request.method === "GET") {
        const c = caseByCode(url.searchParams.get("code"));
        if (!c) return json({ ok: false, error: "Locked." }, 403);
        const thread = (url.searchParams.get("thread") || "main").slice(0, 32);
        return json({ ok: true, comments: await readComments(env, c.slug, thread) });
      }
      if (request.method === "POST") {
        let body;
        try { body = await request.json(); } catch { return json({ ok: false, error: "Bad request." }, 400); }
        const c = caseByCode(body.code);
        if (!c) return json({ ok: false, error: "Locked." }, 403);
        const text = String(body.body || "").slice(0, 4000).trim();
        if (!text) return json({ ok: false, error: "Write a note first." }, 400);
        const who = String(body.who || "").slice(0, 60).trim() || "Anonymous";
        const thread = (typeof body.thread === "string" && body.thread ? body.thread : "main").slice(0, 32);
        const list = await readComments(env, c.slug, thread);
        const ts = new Date().toISOString().replace("T", " ").slice(0, 16) + " UTC";
        list.push({ who, body: text, ts });
        if (list.length > 2000) list.splice(0, list.length - 2000);
        await env.COMMENTS.put(keyFor(c.slug, thread), JSON.stringify(list));
        return json({ ok: true, comments: list });
      }
      return json({ ok: false, error: "Method not allowed." }, 405);
    }

    // --- static shell (no case data), never edge-cached stale ---
    // Hosted case files: only with a case code that owns this folder (owner or counsel code).
    if (url.pathname.startsWith("/cf/")) {
      const slug = url.pathname.split("/")[2] || "";
      const c = caseByCode(url.searchParams.get("code") || "");
      if (!c || (c.slug !== slug && c.slug !== slug + "-counsel")) return new Response("Locked", { status: 403 });
      const parts = url.pathname.split("/");
      if (parts[3] === "up") {
        const key = decodeURIComponent(parts.slice(4).join("/"));
        if (!env.FILES || !key.startsWith("cases/" + slug + "/")) return new Response("Not found", { status: 404 });
        if (!ownerView(request, c)) { const ups = JSON.parse((await env.COMMENTS.get("uploads:" + slug)) || "[]"), u = ups.find(x => x.key === key); if (u && u.vis === "owner") return new Response("Not found", { status: 404 }); }
        const range = request.headers.get("range");
        const obj = await env.FILES.get(key, range ? { range: request.headers } : undefined);
        if (!obj) return new Response("Not found", { status: 404 });
        const hh = new Headers(); obj.writeHttpMetadata(hh); hh.set("etag", obj.httpEtag); hh.set("cache-control", "private, max-age=3600"); hh.set("x-robots-tag", "noindex"); hh.set("accept-ranges", "bytes");
        if (range && obj.range) { const off = obj.range.offset || 0, len = obj.range.length != null ? obj.range.length : obj.size - off; hh.set("content-range", "bytes " + off + "-" + (off + len - 1) + "/" + obj.size); return new Response(obj.body, { status: 206, headers: hh }); }
        return new Response(obj.body, { status: 200, headers: hh });
      }
      const r = await env.ASSETS.fetch(new Request(new URL(url.pathname, url.origin), request));
      const hh = new Headers(r.headers); hh.set("cache-control", "private, max-age=3600"); hh.set("x-robots-tag", "noindex"); hh.set("accept-ranges", "bytes");
      const range = request.headers.get("range");
      if (range && r.status === 200) {
        const m = /bytes=(\d*)-(\d*)/.exec(range);
        if (m && (m[1] !== "" || m[2] !== "")) {
          const buf = await r.arrayBuffer(), size = buf.byteLength;
          const start = m[1] === "" ? Math.max(0, size - Number(m[2])) : Number(m[1]);
          const end = m[1] === "" ? size - 1 : (m[2] ? Math.min(Number(m[2]), size - 1) : size - 1);
          if (start >= size || start > end) return new Response(null, { status: 416, headers: { "content-range": "bytes */" + size } });
          hh.set("content-range", "bytes " + start + "-" + end + "/" + size); hh.set("content-length", String(end - start + 1));
          return new Response(buf.slice(start, end + 1), { status: 206, headers: hh });
        }
      }
      return new Response(r.body, { status: r.status, statusText: r.statusText, headers: hh });
    }
    const res = await env.ASSETS.fetch(request);
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("text/html")) {
      const h = new Headers(res.headers);
      h.set("Cache-Control", "no-store, must-revalidate");
      return new Response(res.body, { status: res.status, headers: h });
    }
    return res;
  },
};


// ---- Sign-in ----
// Public (no sign-in): the home page, /login, /setup, the reading-aid script.
// Everything else (the app, case data, files) needs a signed-in session cookie.
// Accounts live in KV (COMMENTS binding) as "auth:user:<email>"; passwords are PBKDF2-SHA256, 100k rounds, random salt.
// Creating or resetting a login only works while "auth:setup_until" (a ms timestamp) is in the future,
// only for an email listed in ADMIN_EMAILS, and only with a valid case code. Open that window with:
//   npx wrangler kv key put "auth:setup_until" "<ms>" --namespace-id <your KV namespace id> --local
// Creating the login closes the window at once.
const __PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
};
const __AUTH = {
  // Who may create their own admin login (setup window + case code): the ADMIN_EMAILS setting, comma-separated.
  // See docs/access-model.md: an admin today can open every case. That must change before any real case is added.
  roles: ["counsel"], // roles an admin can invite; invited people only open the case codes on their invite
  cookie: "la_session", days: 30, iter: 100000, maxFails: 10, minLen: 10,
};
// The letter check ("What is this letter?") is public: it works on the phone and sends nothing to the server.
const __PUBLIC = new Set(["/", "/login", "/setup", "/read-aid.js", "/la.css", "/favicon.ico", "/robots.txt", "/vendor/simplewebauthn-browser-14.0.0/index.umd.min.js",
  "/letter", "/letter.js", "/letter-check.mjs", "/grounding.mjs", "/paper-dates.mjs"]);
// Passkeys belong to one site name: PASSKEY_RP_ID and PUBLIC_ORIGIN in the settings (default: the address the request came to).
function __pkFor(env, url) { return { rpID: String(env.PASSKEY_RP_ID || url.hostname), origin: String(env.PUBLIC_ORIGIN || url.origin) }; }
if (typeof globalThis.SubtleCrypto === "undefined" && globalThis.crypto && crypto.subtle) globalThis.SubtleCrypto = crypto.subtle.constructor; // the passkey library looks for it
const __CODE_ROUTES = new Set(["/api/case", "/api/ask", "/api/rewrite", "/api/store", "/api/comments", "/api/upload", "/api/text", "/api/text-add", "/api/extract", "/api/case-edit", "/api/evidence", "/api/evidence/check", "/api/cite-check", "/api/mailin", "/api/meaning", "/api/transcribe", "/api/transcript"]);
function __allowedCode(user, code) {
  if (!user) return false;
  if (user.role === "admin") return true;
  return Array.isArray(user.codes) && user.codes.includes(String(code == null ? "" : code).trim());
}
async function __codeOf(request, url) {
  let code = url.searchParams.get("code");
  if (code == null && request.method === "POST") { try { const b = await request.clone().json(); code = b && b.code; } catch { code = null; } }
  return code == null ? "" : String(code).trim();
}
const __EMAIL_RE = /^[^\s@<>"]+@[^\s@<>"]+\.[a-z]{2,}$/i;
function __adminRole(env, email) {
  const list = String((env && env.ADMIN_EMAILS) || "").split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
  return email && list.includes(String(email).trim().toLowerCase()) ? "admin" : null;
}

function __hex(buf) { return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join(""); }
function __unhex(h) { const a = new Uint8Array(h.length / 2); for (let i = 0; i < a.length; i++) a[i] = parseInt(h.substr(i * 2, 2), 16); return a; }
function __b64u(s) { return btoa(unescape(encodeURIComponent(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
function __unb64u(s) { s = s.replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4) s += "="; return decodeURIComponent(escape(atob(s))); }
async function __safeEqual(a, b) {
  const enc = new TextEncoder();
  const [ha, hb] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(String(a))),
    crypto.subtle.digest("SHA-256", enc.encode(String(b))),
  ]);
  const x = new Uint8Array(ha), y = new Uint8Array(hb);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}
async function __pbkdf2(password, saltHex, iter) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  return __hex(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: __unhex(saltHex), iterations: iter }, key, 256));
}
async function __authSecret(env) {
  let s = await env.COMMENTS.get("auth:secret");
  if (!s) { s = __hex(crypto.getRandomValues(new Uint8Array(32))); await env.COMMENTS.put("auth:secret", s); }
  return s;
}
async function __sign(env, msg) {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(await __authSecret(env)), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return __hex(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(msg)));
}
async function __getUser(env, email) { try { return JSON.parse((await env.COMMENTS.get("auth:user:" + email)) || "null"); } catch { return null; } }
function __cookie(request, name) {
  const c = request.headers.get("Cookie") || "";
  for (const part of c.split(/;\s*/)) { const i = part.indexOf("="); if (i > 0 && part.slice(0, i) === name) return part.slice(i + 1); }
  return "";
}
async function __sessionCookie(env, user) {
  const exp = Date.now() + __AUTH.days * 864e5;
  const body = __b64u(user.email) + "." + exp + "." + user.ver;
  const tok = body + "." + (await __sign(env, body));
  return `${__AUTH.cookie}=${tok}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${__AUTH.days * 86400}`;
}
async function __session(request, env) {
  const tok = __cookie(request, __AUTH.cookie);
  const p = tok.split(".");
  if (p.length !== 4) return null;
  const body = p.slice(0, 3).join(".");
  if (!(await __safeEqual(await __sign(env, body), p[3]))) return null;
  if (Date.now() > Number(p[1])) return null;
  let email; try { email = __unb64u(p[0]); } catch { return null; }
  const user = await __getUser(env, email);
  if (!user || user.ver !== p[2]) return null; // a new password signs out every old session
  return user;
}
function __ip(request) { return request.headers.get("CF-Connecting-IP") || "unknown"; }
// Access log (D1). Never blocks the response.
function __log(env, ctx, request, email, action, detail) { __logAt(env, ctx, __ip(request), email, action, detail); }
function __logAt(env, ctx, ip, email, action, detail) {
  if (!env.DB) return;
  const pr = env.DB.prepare("INSERT INTO access_log (ts,email,ip,action,detail) VALUES (?,?,?,?,?)").bind(new Date().toISOString(), email || null, ip, action, String(detail || "").slice(0, 300)).run().catch(() => { });
  if (ctx && ctx.waitUntil) ctx.waitUntil(pr);
}
// Two-step sign-in (authenticator app codes, RFC 6238) and one-time backup codes.
const __B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
function __b32enc(bytes) { let bits = 0, val = 0, out = ""; for (const b of bytes) { val = ((val << 8) | b) & 0xffff; bits += 8; while (bits >= 5) { out += __B32[(val >>> (bits - 5)) & 31]; bits -= 5; } } if (bits > 0) out += __B32[(val << (5 - bits)) & 31]; return out; }
function __b32dec(s) { s = String(s).replace(/=+$/, "").toUpperCase(); let bits = 0, val = 0; const out = []; for (const ch of s) { const i = __B32.indexOf(ch); if (i < 0) continue; val = ((val << 5) | i) & 0xffff; bits += 5; if (bits >= 8) { out.push((val >>> (bits - 8)) & 255); bits -= 8; } } return new Uint8Array(out); }
async function __totpAt(secret, counter) {
  const key = await crypto.subtle.importKey("raw", __b32dec(secret), { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const msg = new ArrayBuffer(8), dv = new DataView(msg); dv.setUint32(0, Math.floor(counter / 4294967296)); dv.setUint32(4, counter >>> 0);
  const h = new Uint8Array(await crypto.subtle.sign("HMAC", key, msg)); const o = h[19] & 15;
  return String((((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3]) % 1000000).padStart(6, "0");
}
async function __totpOk(secret, code) { code = String(code || "").replace(/\D/g, ""); if (code.length !== 6 || !secret) return false; const t = Math.floor(Date.now() / 30000); for (const d of [-1, 0, 1]) if (await __totpAt(secret, t + d) === code) return true; return false; }
async function __sha(s) { return __hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(s)))); }
async function __secondStep(env, user, code) {
  // true if the code is a current authenticator code or an unused backup code (which is then used up)
  if (await __totpOk(user.totp.secret, code)) return true;
  const bc = String(code || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  if (bc.length === 8 && Array.isArray(user.totp.backup)) { const hsh = await __sha(bc), i = user.totp.backup.indexOf(hsh); if (i >= 0) { user.totp.backup.splice(i, 1); await env.COMMENTS.put("auth:user:" + user.email, JSON.stringify(user)); return true; } }
  return false;
}
async function __failCount(env, request) { return Number((await env.COMMENTS.get("auth:fail:" + __ip(request))) || 0); }
async function __fail(env, request) { const n = (await __failCount(env, request)) + 1; await env.COMMENTS.put("auth:fail:" + __ip(request), String(n), { expirationTtl: 900 }); }
function __sameOrigin(request, url) { const o = request.headers.get("Origin"); return !o || o === url.origin; }
function __safeNext(n) { return typeof n === "string" && n.startsWith("/") && !n.startsWith("//") && !n.startsWith("/\\") ? n : "/app"; }
async function __setupUntil(env) { return Number((await env.COMMENTS.get("auth:setup_until")) || 0); }
function __authJson(obj, status = 200, extra = {}) {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json; charset=utf-8", ...__PRIVATE_HEADERS, ...extra } });
}

async function __authRoutes(request, env, url, ctx) {
  const p = url.pathname;
  const __PK = __pkFor(env, url);
  if (p === "/api/auth/status" && request.method === "GET") {
    const user = await __session(request, env);
    const until = await __setupUntil(env);
    return __authJson({ signedIn: !!user, email: user ? user.email : null, role: user ? user.role : null, codes: user && user.role !== "admin" ? (user.codes || []) : null, twofa: !!(user && user.totp && user.totp.on), passkeys: user ? (user.passkeys || []).map(k => ({ id: k.id, name: k.name, created: k.created, lastUsed: k.lastUsed || null, synced: !!k.backedUp })) : [], backupLeft: user && user.totp && user.totp.on ? (user.totp.backup || []).length : null, setupOpen: until > Date.now(), setupUntil: until > Date.now() ? until : null });
  }
  if (p === "/api/auth/invite" && request.method === "GET") {
    const tok = String(url.searchParams.get("token") || "").replace(/[^a-f0-9]/g, "");
    const inv = tok ? JSON.parse((await env.COMMENTS.get("auth:invite:" + tok)) || "null") : null;
    if (!inv) return __authJson({ ok: false, error: "This invite link is not valid or has expired." }, 404);
    return __authJson({ ok: true, email: inv.email, role: inv.role, expires: inv.expires });
  }
  if ((p === "/logout" || p === "/api/auth/logout") && (request.method === "GET" || request.method === "POST")) {
    const was = await __session(request, env); if (was) __log(env, ctx, request, was.email, "signed out", "");
    return new Response(null, { status: 302, headers: { Location: "/", "Set-Cookie": `${__AUTH.cookie}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`, ...__PRIVATE_HEADERS } });
  }
  if (p === "/api/auth/login" && request.method === "POST") {
    if (!__sameOrigin(request, url)) return __authJson({ ok: false, error: "Bad request." }, 403);
    if ((await __failCount(env, request)) >= __AUTH.maxFails) return __authJson({ ok: false, error: "Too many tries. Wait 15 minutes and try again." }, 429);
    let b; try { b = await request.json(); } catch { return __authJson({ ok: false, error: "Bad request." }, 400); }
    const email = String(b.email || "").trim().toLowerCase(), pw = String(b.password || "");
    const user = email && pw ? await __getUser(env, email) : null;
    const ok = !!user && (await __safeEqual(await __pbkdf2(pw, user.salt, user.iter), user.hash));
    if (!ok) { await __fail(env, request); __log(env, ctx, request, email, "sign-in failed", "wrong password"); return __authJson({ ok: false, error: "Wrong email or password." }, 401); }
    if (user.totp && user.totp.on) {
      if (!b.totp) return __authJson({ ok: false, need2fa: true, error: "Enter the 6-digit code from your authenticator app." }, 401);
      if (!(await __secondStep(env, user, b.totp))) { await __fail(env, request); __log(env, ctx, request, email, "sign-in failed", "wrong 2-step code"); return __authJson({ ok: false, need2fa: true, error: "That code is not right." }, 401); }
    }
    await env.COMMENTS.delete("auth:fail:" + __ip(request));
    __log(env, ctx, request, email, "signed in", user.totp && user.totp.on ? "with 2-step" : "");
    return __authJson({ ok: true, next: __safeNext(b.next) }, 200, { "Set-Cookie": await __sessionCookie(env, user) });
  }
  // Passkeys: sign in with the face, fingerprint or PIN that unlocks this device. The passkey must check the person
  // (user verification), so it stands in for both the password and the 2-step code.
  if (p === "/api/auth/passkey-options" && request.method === "POST") {
    if (!__sameOrigin(request, url)) return __authJson({ ok: false, error: "Bad request." }, 403);
    if (url.hostname !== __PK.rpID) return __authJson({ ok: false, error: "Passkeys work on " + __PK.rpID + "." }, 400);
    if ((await __failCount(env, request)) >= __AUTH.maxFails) return __authJson({ ok: false, error: "Too many tries. Wait 15 minutes and try again." }, 429);
    const options = await generateAuthenticationOptions({ rpID: __PK.rpID, userVerification: "required", timeout: 120000 });
    const id = __hex(crypto.getRandomValues(new Uint8Array(16)));
    await env.COMMENTS.put("auth:pkch:" + id, options.challenge, { expirationTtl: 300 });
    return __authJson({ ok: true, id, options });
  }
  if (p === "/api/auth/passkey-login" && request.method === "POST") {
    if (!__sameOrigin(request, url)) return __authJson({ ok: false, error: "Bad request." }, 403);
    if ((await __failCount(env, request)) >= __AUTH.maxFails) return __authJson({ ok: false, error: "Too many tries. Wait 15 minutes and try again." }, 429);
    let b; try { b = await request.json(); } catch { return __authJson({ ok: false, error: "Bad request." }, 400); }
    const id = String(b.id || "").replace(/[^a-f0-9]/g, "");
    const challenge = id ? await env.COMMENTS.get("auth:pkch:" + id) : null;
    if (id) await env.COMMENTS.delete("auth:pkch:" + id); // one use
    const resp = b.response || {}, credId = String(resp.id || "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 400);
    const email = credId ? await env.COMMENTS.get("auth:pk:" + credId) : null;
    const user = email ? await __getUser(env, email) : null;
    const pk = user && (user.passkeys || []).find(k => k.id === credId);
    let ok = false;
    if (challenge && pk) {
      try {
        const v = await verifyAuthenticationResponse({ response: resp, expectedChallenge: challenge, expectedOrigin: __PK.origin, expectedRPID: __PK.rpID, credential: { id: pk.id, publicKey: isoBase64URL.toBuffer(pk.pub), counter: pk.counter || 0, transports: pk.transports || [] }, requireUserVerification: true });
        if (v.verified) { ok = true; pk.counter = v.authenticationInfo.newCounter; pk.lastUsed = new Date().toISOString(); await env.COMMENTS.put("auth:user:" + user.email, JSON.stringify(user)); }
      } catch (e) { ok = false; }
    }
    if (!ok) {
      await __fail(env, request);
      __log(env, ctx, request, email || "", "sign-in failed", !challenge ? "passkey: request expired" : !pk ? "passkey not known here" : "passkey check failed");
      return __authJson({ ok: false, error: !challenge ? "That took too long. Try again." : !pk ? "This passkey is not set up for Legal Agente. Sign in with your password, then add it on the Security page." : "The passkey could not be checked. Try again." }, 401);
    }
    await env.COMMENTS.delete("auth:fail:" + __ip(request));
    __log(env, ctx, request, user.email, "signed in", "with a passkey (" + pk.name + ")");
    return __authJson({ ok: true, next: __safeNext(b.next) }, 200, { "Set-Cookie": await __sessionCookie(env, user) });
  }
  if (p === "/api/auth/setup" && request.method === "POST" && request.headers.get("X-Invite") === "1") {
    if (!__sameOrigin(request, url)) return __authJson({ ok: false, error: "Bad request." }, 403);
    if ((await __failCount(env, request)) >= __AUTH.maxFails) return __authJson({ ok: false, error: "Too many tries. Wait 15 minutes and try again." }, 429);
    let b; try { b = await request.json(); } catch { return __authJson({ ok: false, error: "Bad request." }, 400); }
    const tok = String(b.invite || "").replace(/[^a-f0-9]/g, ""), pw = String(b.password || "");
    const inv = tok ? JSON.parse((await env.COMMENTS.get("auth:invite:" + tok)) || "null") : null;
    if (!inv) { await __fail(env, request); return __authJson({ ok: false, error: "This invite link is not valid or has expired." }, 403); }
    if (pw.length < __AUTH.minLen) return __authJson({ ok: false, error: `Use at least ${__AUTH.minLen} characters.` }, 400);
    const salt = __hex(crypto.getRandomValues(new Uint8Array(16)));
    const user = { email: inv.email, role: inv.role, codes: inv.codes, salt, iter: __AUTH.iter, hash: await __pbkdf2(pw, salt, __AUTH.iter), ver: __hex(crypto.getRandomValues(new Uint8Array(8))), created: new Date().toISOString(), invitedBy: inv.by };
    await env.COMMENTS.put("auth:user:" + inv.email, JSON.stringify(user));
    await env.COMMENTS.delete("auth:invite:" + tok); // one use
    __log(env, ctx, request, inv.email, "login created", "from invite by " + inv.by);
    return __authJson({ ok: true, next: "/app" }, 200, { "Set-Cookie": await __sessionCookie(env, user) });
  }
  if (p === "/api/auth/setup" && request.method === "POST") {
    if (!__sameOrigin(request, url)) return __authJson({ ok: false, error: "Bad request." }, 403);
    if ((await __setupUntil(env)) <= Date.now()) return __authJson({ ok: false, error: "Creating a login is closed right now." }, 403);
    if ((await __failCount(env, request)) >= __AUTH.maxFails) return __authJson({ ok: false, error: "Too many tries. Wait 15 minutes and try again." }, 429);
    let b; try { b = await request.json(); } catch { return __authJson({ ok: false, error: "Bad request." }, 400); }
    const email = String(b.email || "").trim().toLowerCase(), pw = String(b.password || ""), code = String(b.code || "").replace(/\D/g, "");
    const role = __adminRole(env, email);
    if (!role || !caseByCode(code)) { await __fail(env, request); return __authJson({ ok: false, error: "That email or case code is not right." }, 403); }
    if (pw.length < __AUTH.minLen) return __authJson({ ok: false, error: `Use at least ${__AUTH.minLen} characters.` }, 400);
    const salt = __hex(crypto.getRandomValues(new Uint8Array(16)));
    const user = { email, role, salt, iter: __AUTH.iter, hash: await __pbkdf2(pw, salt, __AUTH.iter), ver: __hex(crypto.getRandomValues(new Uint8Array(8))), created: new Date().toISOString() };
    await env.COMMENTS.put("auth:user:" + email, JSON.stringify(user));
    await env.COMMENTS.delete("auth:setup_until"); // one use: the window closes now
    __log(env, ctx, request, email, "login created", "setup window");
    await env.COMMENTS.delete("auth:fail:" + __ip(request));
    return __authJson({ ok: true, next: "/app" }, 200, { "Set-Cookie": await __sessionCookie(env, user) });
  }
  if (p.startsWith("/api/me/")) {
    const me = await __session(request, env);
    if (!me) return __authJson({ ok: false, error: "Please sign in." }, 401);
    if (request.method === "POST" && !__sameOrigin(request, url)) return __authJson({ ok: false, error: "Bad request." }, 403);
    let b = {}; if (request.method === "POST") { try { b = await request.json(); } catch { b = {}; } }
    const save = () => env.COMMENTS.put("auth:user:" + me.email, JSON.stringify(me));
    if (p === "/api/me/2fa-start" && request.method === "POST") {
      const secret = __b32enc(crypto.getRandomValues(new Uint8Array(20)));
      me.totpPending = secret; await save();
      return __authJson({ ok: true, secret, uri: "otpauth://totp/Legal%20Agente:" + encodeURIComponent(me.email) + "?secret=" + secret + "&issuer=Legal%20Agente&digits=6&period=30" });
    }
    if (p === "/api/me/2fa-confirm" && request.method === "POST") {
      if (!me.totpPending || !(await __totpOk(me.totpPending, b.code))) return __authJson({ ok: false, error: "That code is not right. Check the time on your phone and try the newest code." }, 400);
      const codes = []; for (let i = 0; i < 8; i++) codes.push(__hex(crypto.getRandomValues(new Uint8Array(4))));
      me.totp = { on: true, secret: me.totpPending, backup: await Promise.all(codes.map(__sha)), since: new Date().toISOString() };
      delete me.totpPending; await save(); __log(env, ctx, request, me.email, "2-step turned on", "");
      return __authJson({ ok: true, backup: codes.map(c => c.slice(0, 4) + "-" + c.slice(4)) });
    }
    if (p === "/api/me/2fa-off" && request.method === "POST") {
      if (!me.totp || !me.totp.on) return __authJson({ ok: true });
      if (!(await __secondStep(env, me, b.code))) return __authJson({ ok: false, error: "That code is not right." }, 400);
      me.totp = null; await save(); __log(env, ctx, request, me.email, "2-step turned off", "");
      return __authJson({ ok: true });
    }
    if (p === "/api/me/calendar" && request.method === "POST") {
      if (b.reset && me.cal) { await env.COMMENTS.delete("auth:cal:" + me.cal); me.cal = null; }
      if (!me.cal) { me.cal = __hex(crypto.getRandomValues(new Uint8Array(20))); await env.COMMENTS.put("auth:cal:" + me.cal, me.email); await save(); }
      return __authJson({ ok: true, link: url.origin + "/cal/" + me.cal + ".ics" });
    }
    // Add a passkey: the password is asked again, so a stolen session alone cannot add one.
    if (p === "/api/me/passkey-options" && request.method === "POST") {
      if (url.hostname !== __PK.rpID) return __authJson({ ok: false, error: "Passkeys work on " + __PK.rpID + "." }, 400);
      if ((await __failCount(env, request)) >= __AUTH.maxFails) return __authJson({ ok: false, error: "Too many tries. Wait 15 minutes and try again." }, 429);
      if (!(await __safeEqual(await __pbkdf2(String(b.password || ""), me.salt, me.iter), me.hash))) { await __fail(env, request); __log(env, ctx, request, me.email, "passkey not added", "wrong password"); return __authJson({ ok: false, error: "That password is not right." }, 401); }
      if ((me.passkeys || []).length >= 10) return __authJson({ ok: false, error: "You have 10 passkeys. Remove one first." }, 400);
      if (!me.pkUser) { me.pkUser = __hex(crypto.getRandomValues(new Uint8Array(16))); await save(); }
      const options = await generateRegistrationOptions({ rpName: "Legal Agente", rpID: __PK.rpID, userName: me.email, userDisplayName: me.email, userID: __unhex(me.pkUser), attestationType: "none", timeout: 120000, excludeCredentials: (me.passkeys || []).map(k => ({ id: k.id, transports: k.transports || [] })), authenticatorSelection: { residentKey: "required", userVerification: "required" } });
      await env.COMMENTS.put("auth:pkreg:" + me.email, options.challenge, { expirationTtl: 300 });
      return __authJson({ ok: true, options });
    }
    if (p === "/api/me/passkey-add" && request.method === "POST") {
      const challenge = await env.COMMENTS.get("auth:pkreg:" + me.email);
      await env.COMMENTS.delete("auth:pkreg:" + me.email);
      if (!challenge) return __authJson({ ok: false, error: "That took too long. Start again." }, 400);
      let v; try { v = await verifyRegistrationResponse({ response: b.response || {}, expectedChallenge: challenge, expectedOrigin: __PK.origin, expectedRPID: __PK.rpID, requireUserVerification: true }); } catch (e) { v = null; }
      if (!v || !v.verified || !v.registrationInfo) return __authJson({ ok: false, error: "The passkey could not be checked. Try again." }, 400);
      const cred = v.registrationInfo.credential;
      const taken = await env.COMMENTS.get("auth:pk:" + cred.id);
      if (taken && taken !== me.email) return __authJson({ ok: false, error: "This passkey belongs to another login." }, 400);
      me.passkeys = (me.passkeys || []).filter(k => k.id !== cred.id);
      const name = String(b.name || "").replace(/[\r\n<>]+/g, " ").trim().slice(0, 60) || "Passkey " + (me.passkeys.length + 1);
      me.passkeys.push({ id: cred.id, pub: isoBase64URL.fromBuffer(cred.publicKey), counter: cred.counter || 0, transports: cred.transports || (b.response && b.response.response && b.response.response.transports) || [], name, created: new Date().toISOString(), lastUsed: null, backedUp: !!v.registrationInfo.credentialBackedUp });
      await save(); await env.COMMENTS.put("auth:pk:" + cred.id, me.email);
      __log(env, ctx, request, me.email, "passkey added", name);
      return __authJson({ ok: true, name });
    }
    if (p === "/api/me/passkey-remove" && request.method === "POST") {
      const id = String(b.id || ""), k = (me.passkeys || []).find(x => x.id === id);
      if (!k) return __authJson({ ok: false, error: "Not found." }, 404);
      me.passkeys = me.passkeys.filter(x => x.id !== id); await save();
      await env.COMMENTS.delete("auth:pk:" + id);
      __log(env, ctx, request, me.email, "passkey removed", k.name);
      return __authJson({ ok: true });
    }
    if (p === "/api/me/signout-all" && request.method === "POST") {
      me.ver = __hex(crypto.getRandomValues(new Uint8Array(8))); await save(); __log(env, ctx, request, me.email, "signed out everywhere", "");
      return __authJson({ ok: true }, 200, { "Set-Cookie": await __sessionCookie(env, me) });
    }
    return __authJson({ ok: false, error: "Not found." }, 404);
  }
  if (p.startsWith("/api/admin/")) {
    const me = await __session(request, env);
    if (!me || me.role !== "admin") return __authJson({ ok: false, error: "Admins only." }, 403);
    if (request.method === "POST" && !__sameOrigin(request, url)) return __authJson({ ok: false, error: "Bad request." }, 403);
    const listJson = async prefix => { const out = []; let cursor; do { const r = await env.COMMENTS.list({ prefix, cursor }); for (const k of r.keys) { const v = await env.COMMENTS.get(k.name); if (v) out.push([k.name, JSON.parse(v)]); } cursor = r.list_complete ? null : r.cursor; } while (cursor); return out; };
    if (p === "/api/admin/users" && request.method === "GET") {
      const users = (await listJson("auth:user:")).map(([, u]) => ({ email: u.email, role: u.role, codes: u.role === "admin" ? null : (u.codes || []), created: u.created, invitedBy: u.invitedBy || null, me: u.email === me.email }));
      const invites = (await listJson("auth:invite:")).map(([k, v]) => ({ token: k.slice("auth:invite:".length), email: v.email, role: v.role, codes: v.codes, expires: v.expires, created: v.created }));
      const dyn = (await listJson("case:")).map(([k, v]) => ({ code: k.slice(5), title: v.data.title + " (added " + String(v.created || "").slice(0, 10) + ")", added: true }));
      const cases = Object.keys(CASES).map(c => ({ code: c, title: CASES[c].data.title })).concat(Object.keys(COUNSEL_CODES).map(c => ({ code: c, title: (CASES[COUNSEL_CODES[c].base] || { data: { title: c } }).data.title + " — lawyer view (no fees or private notes)" }))).concat(dyn);
      return __authJson({ ok: true, users, invites, cases, roles: __AUTH.roles });
    }
    if (p === "/api/admin/invite" && request.method === "POST") {
      let b; try { b = await request.json(); } catch { return __authJson({ ok: false, error: "Bad request." }, 400); }
      const email = String(b.email || "").trim().toLowerCase(), role = String(b.role || "counsel");
      const codes = [...new Set((Array.isArray(b.codes) ? b.codes : []).map(c => String(c).trim()))];
      const days = Math.min(14, Math.max(1, Number(b.days) || 7));
      if (!__EMAIL_RE.test(email)) return __authJson({ ok: false, error: "That email does not look right." }, 400);
      if (!__AUTH.roles.includes(role)) return __authJson({ ok: false, error: "Unknown role." }, 400);
      for (const c of codes) await loadDyn(env, c);
      if (!codes.length || !codes.every(c => caseByCode(c))) return __authJson({ ok: false, error: "Pick at least one valid case." }, 400);
      if (__adminRole(env, email)) return __authJson({ ok: false, error: "That person is an admin; they use the setup page." }, 400);
      const tok = __hex(crypto.getRandomValues(new Uint8Array(24)));
      const expires = Date.now() + days * 864e5;
      await env.COMMENTS.put("auth:invite:" + tok, JSON.stringify({ email, role, codes, by: me.email, created: new Date().toISOString(), expires }), { expirationTtl: days * 86400 });
      __log(env, ctx, request, me.email, "invite created", email + " → " + codes.join(","));
      return __authJson({ ok: true, token: tok, link: url.origin + "/setup?invite=" + tok, expires });
    }
    if (p === "/api/admin/cancel-invite" && request.method === "POST") {
      let b; try { b = await request.json(); } catch { return __authJson({ ok: false, error: "Bad request." }, 400); }
      await env.COMMENTS.delete("auth:invite:" + String(b.token || "").replace(/[^a-f0-9]/g, ""));
      return __authJson({ ok: true });
    }
    if (p === "/api/admin/remove-user" && request.method === "POST") {
      let b; try { b = await request.json(); } catch { return __authJson({ ok: false, error: "Bad request." }, 400); }
      const email = String(b.email || "").trim().toLowerCase();
      if (email === me.email) return __authJson({ ok: false, error: "You cannot remove yourself." }, 400);
      const gone = await __getUser(env, email);
      for (const k of ((gone && gone.passkeys) || [])) await env.COMMENTS.delete("auth:pk:" + k.id);
      await env.COMMENTS.delete("auth:user:" + email);
      __log(env, ctx, request, me.email, "login removed", email);
      return __authJson({ ok: true });
    }
    if (p === "/api/admin/case" && request.method === "POST") {
      let b; try { b = await request.json(); } catch { return __authJson({ ok: false, error: "Bad request." }, 400); }
      const title = String(b.title || "").trim().slice(0, 160);
      if (!title) return __authJson({ ok: false, error: "Give the case a name." }, 400);
      let code = ""; for (let i = 0; i < 20; i++) { const c = String(10000000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 89999999)); if (!CASES[c] && !COUNSEL_CODES[c] && !(await env.COMMENTS.get("case:" + c))) { code = c; break; } }
      if (!code) return __authJson({ ok: false, error: "Try again." }, 500);
      const slug = (title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "case") + "-" + code.slice(-4);
      const data = { title, cn: String(b.cn || "").slice(0, 300), moneyNote: String(b.note || "").slice(0, 600), nodes: {}, edges: [], money: [], timeline: [{ phase: "Timeline", events: [] }], letters: [], portals: [], files: { intro: "Documents for this case. Upload them from the Requests tab or the Case files tab.", groups: [] }, cf: "/cf/" + slug + "/", textIndex: "@kv" };
      await env.COMMENTS.put("case:" + code, JSON.stringify({ slug, data, owner: me.email, created: new Date().toISOString() }));
      __log(env, ctx, request, me.email, "case created", title + " (" + code + ")");
      return __authJson({ ok: true, code, slug });
    }
    if (p === "/api/admin/delete-case" && request.method === "POST") {
      let b; try { b = await request.json(); } catch { return __authJson({ ok: false, error: "Bad request." }, 400); }
      const code = String(b.code || "").trim(), raw = await env.COMMENTS.get("case:" + code);
      if (!raw) return __authJson({ ok: false, error: "Only cases added here can be deleted." }, 400);
      const rec = JSON.parse(raw), slug = rec.slug;
      if (env.FILES) { let cur; do { const l = await env.FILES.list({ prefix: "cases/" + slug + "/", cursor: cur }); for (const o of l.objects) await env.FILES.delete(o.key); cur = l.truncated ? l.cursor : null; } while (cur); }
      const mcfg = JSON.parse((await env.COMMENTS.get("mailcfg:" + slug)) || "{}");
      for (const t of [mcfg.shared, mcfg.owner]) if (t) await env.COMMENTS.delete("mailin:" + t);
      for (const k of ["case:" + code, "uploads:" + slug, "text:" + slug, "textp:" + slug, "vec:" + slug, "vecp:" + slug, "tx:" + slug, "mail:" + slug, "mailcfg:" + slug, "proof:" + slug, "deadlines:" + slug, "docreqs:" + slug, "comments:" + slug]) await env.COMMENTS.delete(k);
      __log(env, ctx, request, me.email, "case deleted", rec.data.title + " (" + code + ")");
      return __authJson({ ok: true });
    }
    if (p === "/api/admin/log" && request.method === "GET") {
      if (!env.DB) return __authJson({ ok: true, rows: [] });
      const r = await env.DB.prepare("SELECT ts,email,ip,action,detail FROM access_log ORDER BY id DESC LIMIT 300").all();
      return __authJson({ ok: true, rows: r.results || [] });
    }
    if (p === "/api/admin/backups" && request.method === "GET") {
      if (!env.FILES) return __authJson({ ok: true, list: [] });
      const l = await env.FILES.list({ prefix: "backups/" });
      return __authJson({ ok: true, list: l.objects.map(o => ({ key: o.key, size: o.size, uploaded: o.uploaded })).sort((a, b) => a.key < b.key ? 1 : -1) });
    }
    if (p === "/api/admin/backup" && request.method === "GET") {
      const key = String(url.searchParams.get("key") || "");
      if (!/^backups\/\d{4}-\d{2}-\d{2}\.json$/.test(key)) return __authJson({ ok: false, error: "Bad key." }, 400);
      const o = await env.FILES.get(key); if (!o) return __authJson({ ok: false, error: "Not found." }, 404);
      __log(env, ctx, request, me.email, "backup downloaded", key);
      return new Response(o.body, { headers: { "Content-Type": "application/json", "Content-Disposition": "attachment; filename=\"legalagente-" + key.slice(8) + "\"", ...__PRIVATE_HEADERS } });
    }
    if (p === "/api/admin/backup-now" && request.method === "POST") {
      const key = await __backup(env); __log(env, ctx, request, me.email, "backup made", key);
      return __authJson({ ok: true, key });
    }
    if (p === "/api/admin/settings" && request.method === "GET") {
      return __authJson({ ok: true, courtlistener: !!(await clToken(env)), courtlistenerFromSecret: !!env.COURTLISTENER_TOKEN });
    }
    if (p === "/api/admin/courtlistener-token" && request.method === "POST") {
      // Write-only: the token is never sent back to the browser.
      let b; try { b = await request.json(); } catch { return __authJson({ ok: false, error: "Bad request." }, 400); }
      if (b.clear) { await env.COMMENTS.delete("cfg:courtlistener"); __log(env, ctx, request, me.email, "CourtListener token removed", ""); return __authJson({ ok: true }); }
      const t = String(b.token || "").trim();
      if (!/^[A-Za-z0-9]{20,80}$/.test(t)) return __authJson({ ok: false, error: "That does not look like a CourtListener token. Copy it from courtlistener.com, Profile, Developer Tools." }, 400);
      let st = 0; try { st = (await fetch(CL_LOOKUP, { method: "POST", headers: { Authorization: "Token " + t, "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "LegalAgenteCommons/0.1" }, body: "text=" + encodeURIComponent("347 U.S. 483") })).status; } catch (e) { st = 0; }
      if (st === 401 || st === 403) return __authJson({ ok: false, error: "CourtListener did not accept that token." }, 400);
      if (!st) return __authJson({ ok: false, error: "Could not reach CourtListener to test the token. Try again." }, 502);
      await env.COMMENTS.put("cfg:courtlistener", t);
      __log(env, ctx, request, me.email, "CourtListener token saved", "");
      return __authJson({ ok: true });
    }
    if (p === "/api/admin/evidence-chain" && request.method === "GET") {
      // Re-works every row of the fingerprint log and checks each one still links to the one before.
      if (!env.DB) return __authJson({ ok: true, n: 0, broken: null });
      const rows = (await env.DB.prepare("SELECT id,slug,h,name,size,sha256,ts,by,prev,row FROM evidence ORDER BY id").all()).results || [];
      let prev = EV_ZERO, broken = null;
      for (const x of rows) {
        if (x.prev !== prev) { broken = { id: x.id, h: x.h, ts: x.ts, why: "it no longer links to the record before it (a record was removed or changed)" }; break; }
        if ((await __sha(evRowText(prev, x))) !== x.row) { broken = { id: x.id, h: x.h, ts: x.ts, why: "this record was changed after it was written" }; break; }
        prev = x.row;
      }
      __log(env, ctx, request, me.email, "checked fingerprint log", rows.length + " records" + (broken ? ", BROKEN at " + broken.id : ", all linked"));
      return __authJson({ ok: true, n: rows.length, broken, first: rows.length ? rows[0].ts : null, last: rows.length ? rows[rows.length - 1].ts : null, head: prev });
    }
    return __authJson({ ok: false, error: "Not found." }, 404);
  }
  return null;
}

// Daily backup (cron, 08:00 UTC): logins, added cases, notes, boards, uploads lists and uploaded text → private bucket. Keeps 30 days.
async function __backup(env) {
  if (!env.FILES) return null;
  const prefixes = ["auth:user:", "auth:pk:", "case:", "uploads:", "text:", "textp:", "tx:", "mail:", "mailcfg:", "mailin:", "comments:", "responses:", "requests:", "answers:", "layout:", "proof:", "deadlines:", "docreqs:"];
  const out = { made: new Date().toISOString(), keys: {} };
  for (const pf of prefixes) { let cursor; do { const r = await env.COMMENTS.list({ prefix: pf, cursor }); for (const k of r.keys) out.keys[k.name] = await env.COMMENTS.get(k.name); cursor = r.list_complete ? null : r.cursor; } while (cursor); }
  const key = "backups/" + new Date().toISOString().slice(0, 10) + ".json";
  await env.FILES.put(key, JSON.stringify(out), { httpMetadata: { contentType: "application/json" } });
  const l = await env.FILES.list({ prefix: "backups/" });
  for (const k of l.objects.map(o => o.key).sort().slice(0, -30)) await env.FILES.delete(k);
  return key;
}

// Calendar feed (no sign-in: the long random link is the key). Every dated deadline in the cases this person can open.
async function __calendar(env, request, token) {
  const email = token ? await env.COMMENTS.get("auth:cal:" + token) : null;
  const user = email ? await __getUser(env, email) : null;
  if (!user || user.cal !== token) return new Response("Not found", { status: 404 });
  const here = new URL(request.url);
  let codes = user.role === "admin" ? Object.keys(CASES) : (user.codes || []);
  if (user.role === "admin") { let cursor; do { const r = await env.COMMENTS.list({ prefix: "case:", cursor }); r.keys.forEach(k => codes.push(k.name.slice(5))); cursor = r.list_complete ? null : r.cursor; } while (cursor); }
  const esc = t => String(t).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
  const stamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Legal Agente//Deadlines//EN", "CALSCALE:GREGORIAN", "X-WR-CALNAME:Legal Agente deadlines", "REFRESH-INTERVAL;VALUE=DURATION:PT6H"];
  const seen = new Set();
  for (const code of codes) {
    await loadDyn(env, code);
    const c = caseByCode(code); if (!c) continue;
    const bs = baseSlug(c.slug); if (seen.has(bs)) continue; seen.add(bs);
    const items = (c.data.deadlines || []).map((x, i) => ({ id: "seed" + i, ...x }));
    const st = JSON.parse((await env.COMMENTS.get("deadlines:" + bs)) || "{}");
    for (const id in st) { try { const x = JSON.parse(st[id].text); items.push({ id, ...x }); } catch { } }
    for (const x of items) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(x.d || "") || x.done) continue;
      const d = x.d.replace(/-/g, ""), next = new Date(Date.parse(x.d + "T12:00:00Z") + 864e5).toISOString().slice(0, 10).replace(/-/g, "");
      lines.push("BEGIN:VEVENT", "UID:" + bs + "-" + x.id + "@" + here.hostname, "DTSTAMP:" + stamp, "DTSTART;VALUE=DATE:" + d, "DTEND;VALUE=DATE:" + next,
        "SUMMARY:" + esc(c.data.title.split(" — ")[0] + ": " + x.what), "DESCRIPTION:" + esc((x.confirm ? "Confirm this date with counsel. " : "") + here.origin + "/app"),
        "BEGIN:VALARM", "TRIGGER:-P3D", "ACTION:DISPLAY", "DESCRIPTION:" + esc(x.what), "END:VALARM",
        "BEGIN:VALARM", "TRIGGER:-P1D", "ACTION:DISPLAY", "DESCRIPTION:" + esc(x.what), "END:VALARM", "END:VEVENT");
    }
  }
  lines.push("END:VCALENDAR");
  return new Response(lines.join("\r\n") + "\r\n", { headers: { "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "private, max-age=900", "X-Robots-Tag": "noindex" } });
}

export default {
  async fetch(request, env, ctx) {
    const u = new URL(request.url);
    const authRes = await __authRoutes(request, env, u, ctx);
    if (authRes) return authRes;
    const calm = /^\/cal\/([a-f0-9]{40})\.ics$/.exec(u.pathname);
    if (calm && (request.method === "GET" || request.method === "HEAD")) return __calendar(env, request, calm[1]);

    const isGet = request.method === "GET" || request.method === "HEAD";
    if (isGet && __PUBLIC.has(u.pathname)) {
      if (u.pathname === "/login" && (await __session(request, env))) return Response.redirect(u.origin + __safeNext(u.searchParams.get("next")), 302);
      const r = await env.ASSETS.fetch(new Request(new URL(u.pathname, u.origin), request));
      const h = new Headers(r.headers);
      h.set("Cache-Control", "no-cache");
      h.set("X-Robots-Tag", "noindex, nofollow"); // public, but kept out of search engines
      return new Response(r.body, { status: r.status, statusText: r.statusText, headers: h });
    }

    const user = await __session(request, env);
    if (!user) {
      const wantsPage = isGet && ((request.headers.get("Accept") || "").includes("text/html") || !/\.[a-z0-9]{2,5}$/i.test(u.pathname));
      if (wantsPage && !u.pathname.startsWith("/api/")) {
        return new Response(null, { status: 302, headers: { Location: "/login?next=" + encodeURIComponent(u.pathname + u.search), ...__PRIVATE_HEADERS } });
      }
      return __authJson({ ok: false, error: "Please sign in." }, 401);
    }
    const reqCode = (__CODE_ROUTES.has(u.pathname) || u.pathname.startsWith("/cf/") || u.pathname.startsWith("/api/")) ? await __codeOf(request, u) : "";
    if (reqCode) await loadDyn(env, reqCode);
    if (user.role !== "admin") {
      if (u.pathname === "/admin") return new Response(null, { status: 302, headers: { Location: "/app", ...__PRIVATE_HEADERS } });
      if (__CODE_ROUTES.has(u.pathname) || u.pathname.startsWith("/cf/")) {
        if (!__allowedCode(user, await __codeOf(request, u))) {
          if (u.pathname.startsWith("/cf/")) return new Response("Locked", { status: 403, headers: __PRIVATE_HEADERS });
          return __authJson({ ok: false, error: "Your login cannot open that case." }, 403);
        }
      }
    }
    if (u.pathname === "/api/case" && request.method === "POST" && reqCode) __log(env, ctx, request, user.email, "opened case", reqCode);
    if (u.pathname.startsWith("/cf/") && request.method === "GET" && !/_text\.json$|_audio\.json$/.test(u.pathname)) { const rg = request.headers.get("range") || ""; if (!rg || /^bytes=0-/.test(rg)) __log(env, ctx, request, user.email, "opened file", decodeURIComponent(u.pathname.split("/").slice(3).join("/")).slice(0, 250)); }
    if (u.pathname === "/api/upload") __log(env, ctx, request, user.email, "uploaded", (u.searchParams.get("name") || "") + " → " + reqCode);
    const fh = new Headers(request.headers); fh.set("X-LA-User", user.email + "|" + user.role);
    const res = await __app.fetch(new Request(request, { headers: fh }), env, ctx);
    const h = new Headers(res.headers);
    for (const [k, v] of Object.entries(__PRIVATE_HEADERS)) h.set(k, v);
    return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
  },
  async scheduled(event, env, ctx) { ctx.waitUntil(__backup(env)); },
  // Email Routing sends mail for *@<MAIL_DOMAIN> here. Only "in-<token>@" addresses of a case are taken,
  // only from people on that case (or senders the owner listed); everything else is turned away.
  async email(message, env, ctx) {
    const to = String(message.to || "").toLowerCase().trim(), from = String(message.from || "").toLowerCase().trim();
    const at = "@" + mailDomain(env), m = to.endsWith(at) ? /^in-([a-f0-9]{24})$/.exec(to.slice(0, -at.length)) : null;
    const box = m ? JSON.parse((await env.COMMENTS.get("mailin:" + m[1])) || "null") : null;
    if (!box) { message.setReject("This address does not exist."); return; }
    if (!(await mailSenderOk(env, box, from))) { __logAt(env, ctx, "email", from, "email turned away", "sender is not on the case · " + box.slug); message.setReject("This address only takes email from people on the case."); return; }
    const ar = (message.headers && message.headers.get("authentication-results")) || "";
    if (/\bdmarc=fail\b/i.test(ar)) { __logAt(env, ctx, "email", from, "email turned away", "failed sender check (DMARC) · " + box.slug); message.setReject("The sending server could not prove it sent this email."); return; }
    if ((message.rawSize || 0) > 25 * 1024 * 1024) { message.setReject("This email is too big (over 25 MB). Upload the files instead."); return; }
    try {
      const raw = await new Response(message.raw).arrayBuffer();
      const r = await mailIngest(env, box, raw, from);
      __logAt(env, ctx, "email", from, r.dup ? "email already filed" : "email filed", (r.dup ? "" : r.files + " files · ") + box.slug + (box.vis === "owner" ? " (only you)" : ""));
      if (!r.dup && ctx && ctx.waitUntil) ctx.waitUntil(vecFill(env, box.vis === "owner" ? "textp" : "text", box.slug, 240).catch(() => { }));
    } catch (e) {
      __logAt(env, ctx, "email", from, "email failed", String((e && e.message) || e).slice(0, 200));
      message.setReject("Legal Agente could not file this email. Please upload it instead.");
    }
  },
};
