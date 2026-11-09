// SPDX-License-Identifier: AGPL-3.0-only
// Looks for things that must never be in this repo: real email addresses, account and namespace ids,
// Drive file ids, case email-in addresses, keys and tokens, phone numbers outside the 555-01xx fiction range.
// Optional: LA_DENYLIST=<path to a file OUTSIDE this repo, one term per line> also fails on any of those terms.
// Run: node scripts/check-clean.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SKIP_DIRS = new Set([".git", "node_modules", ".wrangler", "graphify-out"]); // the last one: a code-map tool's output, git-ignored
const VENDOR = /[\\/]vendor[\\/]/;
const BINARY = /\.(pdf|png|jpe?g|gif|wasm|pfb|ttf|ico)$/i;
const SELF = path.join(ROOT, "scripts", "check-clean.mjs");

const rules = [
  { name: "email address (only example.org/.com/.net allowed)", re: /[A-Za-z0-9._%+-]+@(?!example\.(?:org|com|net)\b)(?!mail\.example\.org\b)[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g },
  { name: "case email-in address", re: /\bin-[a-f0-9]{24}@/g },
  { name: "32-character hex id (KV, D1, account)", re: /\b[a-f0-9]{32}\b/g },
  { name: "Google Drive file id", re: /drive\.google\.com\/(?:file\/d\/|open\?id=|drive\/folders\/)[A-Za-z0-9_-]{10,}/g },
  { name: "private key", re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g },
  { name: "API token", re: /\b(?:sk-[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{30,}|xox[abp]-[A-Za-z0-9-]{10,}|AKIA[0-9A-Z]{16})\b/g },
  { name: "phone number outside 555-01xx", re: /\(\d{3}\)\s?(?!555-01\d\d)\d{3}-\d{4}/g },
];

const deny = process.env.LA_DENYLIST ? fs.readFileSync(process.env.LA_DENYLIST, "utf8").split(/\r?\n/).map(s => s.trim()).filter(s => s && !s.startsWith("#")) : [];
// Whole words only, ignoring case, so a short name does not match inside a longer one.
const denyRe = deny.map(t => {
  const e = t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return [t, new RegExp((/^\w/.test(t) ? "\\b" : "") + e + (/\w$/.test(t) ? "\\b" : ""), "i")];
});

const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (SKIP_DIRS.has(e.name)) continue;
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p); else files.push(p);
  }
})(ROOT);

let bad = 0;
for (const f of files) {
  const rel = path.relative(ROOT, f);
  if (path.resolve(f) === SELF) continue;
  const buf = fs.readFileSync(f);
  const txt = buf.toString("latin1");
  if (!BINARY.test(f) && !VENDOR.test(f)) {
    for (const r of rules) for (const m of txt.matchAll(r.re)) { bad++; console.log(`${rel}: ${r.name}: ${m[0].slice(0, 80)}`); }
  }
  for (const [t, re] of denyRe) if (re.test(txt)) { bad++; console.log(`${rel}: denylisted term (${t.length} chars)`); }
}
if (bad) { console.log(`\n${bad} problem(s) found.`); process.exit(1); }
console.log(`check-clean: ${files.length} files, no problems${deny.length ? `, ${deny.length} denylisted terms checked` : ""}.`);
