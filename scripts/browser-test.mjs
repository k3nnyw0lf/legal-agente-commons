// SPDX-License-Identifier: AGPL-3.0-only
// Real-browser test with no server: headless Chrome loads the real pages, and every request to
// http://localhost:8787 is answered by the real worker running in this Node process, with in-memory
// stand-ins for KV, R2, D1 and AI (tests/helpers.mjs). Nothing listens for web traffic, nothing is deployed.
//
// Needs Chrome or Edge, and Node 22+. Set CHROME to the program path if it is not found.
//   node scripts/browser-test.mjs [out-folder]      (ONLY="name one|name two" runs just those scenarios)
//         (screenshots go to the out-folder, default: your temp folder)
// Fictional sample data only.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import worker from "../src/index.js";
import { makeEnv, ctx as makeCtx } from "../tests/helpers.mjs";
import { SCENARIOS } from "./browser-scenarios.mjs";

const ORIGIN = "http://localhost:8787";
const OUT = path.resolve(process.argv[2] || path.join(os.tmpdir(), "la-browser-test"));
fs.mkdirSync(OUT, { recursive: true });

function findChrome() {
  const c = [process.env.CHROME, "C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
    "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"].filter(Boolean);
  const f = c.find(p => fs.existsSync(p));
  if (!f) throw new Error("Chrome or Edge not found. Set CHROME to its path.");
  return f;
}

// ---- the worker side: one environment, one signed-in session ----
export const env = makeEnv();
const wctx = makeCtx();
let jar = "";
async function toWorker(method, p, headers, body) {
  const h = new Headers(headers || {});
  h.delete("cookie");
  if (jar) h.set("Cookie", jar);
  const res = await worker.fetch(new Request(ORIGIN + p, { method, headers: h, body: body && method !== "GET" && method !== "HEAD" ? body : undefined, redirect: "manual" }), env, wctx);
  const sc = res.headers.get("set-cookie"); if (sc) jar = sc.split(";")[0];
  return res;
}
// A second person in the same browser: an invited helper (not an administrator). Returns { use(), restore() }.
export async function helperLogin(email = "helper@example.org", code = "22222222") {
  const admin = jar, tok = [...Array(24)].map((_, i) => ((i * 7 + 3) % 256).toString(16).padStart(2, "0")).join("");
  await env.COMMENTS.put("auth:invite:" + tok, JSON.stringify({ email, role: "counsel", codes: [code], by: "admin@example.org", created: new Date().toISOString(), expires: Date.now() + 864e5 }));
  jar = "";
  const r = await toWorker("POST", "/api/auth/setup", { "content-type": "application/json", "x-invite": "1" }, JSON.stringify({ invite: tok, password: "a long test password 1" }));
  if (r.status !== 200) throw new Error("helper setup failed: " + await r.text());
  const helper = jar; jar = admin;
  return { use() { jar = helper; }, restore() { jar = admin; } };
}
export async function signIn(email = "admin@example.org", password = "a long test password 1", code = "11111111") {
  await env.COMMENTS.put("auth:setup_until", String(Date.now() + 60000));
  const r = await toWorker("POST", "/api/auth/setup", { "content-type": "application/json" }, JSON.stringify({ email, password, code }));
  if (r.status !== 200) throw new Error("setup failed: " + await r.text());
}

// ---- a tiny Chrome DevTools client (Node's built-in WebSocket) ----
async function launch() {
  const prof = fs.mkdtempSync(path.join(os.tmpdir(), "la-chrome-"));
  const args = ["--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", "--remote-debugging-port=0", "--user-data-dir=" + prof, "--hide-scrollbars", "about:blank"];
  const child = spawn(findChrome(), args, { stdio: "ignore" });
  let port = 0;
  for (let i = 0; i < 100 && !port; i++) {
    await new Promise(r => setTimeout(r, 150));
    try { port = Number(fs.readFileSync(path.join(prof, "DevToolsActivePort"), "utf8").split("\n")[0]); } catch { }
  }
  if (!port) { child.kill(); throw new Error("Chrome did not start"); }
  const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const page = list.find(t => t.type === "page");
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0; const wait = new Map(), handlers = [];
  ws.onmessage = ev => {
    const m = JSON.parse(ev.data);
    if (m.id && wait.has(m.id)) { const { res, rej } = wait.get(m.id); wait.delete(m.id); m.error ? rej(new Error(m.error.message)) : res(m.result); }
    else if (m.method) handlers.forEach(h => h(m));
  };
  const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; wait.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
  const on = h => handlers.push(h);
  const close = async () => { try { await send("Browser.close"); } catch { } try { ws.close(); } catch { } child.kill(); try { fs.rmSync(prof, { recursive: true, force: true }); } catch { } };
  return { send, on, close };
}

export async function startBrowser() {
  await signIn();
  const b = await launch();
  const { send, on } = b;
  const problems = [], requests = [];
  await send("Page.enable"); await send("Runtime.enable"); await send("Network.enable"); await send("DOM.enable");
  await send("Fetch.enable", { patterns: [{ urlPattern: ORIGIN + "/*" }] });
  on(async m => {
    if (m.method === "Runtime.exceptionThrown") problems.push("exception: " + (m.params.exceptionDetails.exception && m.params.exceptionDetails.exception.description || m.params.exceptionDetails.text));
    if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") problems.push("console.error: " + m.params.args.map(a => a.value || a.description || "").join(" ").slice(0, 300));
    if (m.method === "Fetch.requestPaused") {
      const { requestId, request } = m.params;
      try {
        const u = new URL(request.url);
        requests.push(request.method + " " + u.pathname);
        let body;
        if (request.postDataEntries && request.postDataEntries.length) body = Buffer.concat(request.postDataEntries.map(e => Buffer.from(e.bytes || "", "base64")));
        else if (request.postData) body = request.postData;
        const res = await toWorker(request.method, u.pathname + u.search, request.headers, body);
        const buf = Buffer.from(await res.arrayBuffer());
        const hdrs = []; res.headers.forEach((v, k) => { if (k !== "set-cookie" && k !== "content-length" && k !== "content-encoding") hdrs.push({ name: k, value: v }); });
        await send("Fetch.fulfillRequest", { requestId, responseCode: res.status, responseHeaders: hdrs, body: buf.toString("base64") });
      } catch (e) { try { await send("Fetch.failRequest", { requestId, errorReason: "Failed" }); } catch { } problems.push("worker error: " + (e && e.message)); }
    }
  });
  const page = {
    problems, requests, out: OUT, env, helperLogin,
    async resize(width, height, mobile = true, scale = 1) { await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: scale, mobile }); },
    async goto(p) { await send("Page.navigate", { url: /^(https?|data):/.test(p) ? p : ORIGIN + p }); await this.waitFor("document.readyState === 'complete'", 20000); },
    async eval(expr) {
      const r = await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true });
      if (r.exceptionDetails) throw new Error("eval: " + (r.exceptionDetails.exception && r.exceptionDetails.exception.description || r.exceptionDetails.text));
      return r.result.value;
    },
    async waitFor(expr, ms = 10000) {
      const t0 = Date.now();
      for (;;) {
        try { if (await this.eval(expr)) return true; } catch { }
        if (Date.now() - t0 > ms) throw new Error("timed out waiting for: " + expr);
        await new Promise(r => setTimeout(r, 120));
      }
    },
    async click(sel) { await this.eval(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});if(!e)throw new Error('no element ${sel.replace(/'/g, "")}');e.click();return 1})()`); },
    async type(sel, text) { await this.eval(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});e.focus();e.value=${JSON.stringify(text)};e.dispatchEvent(new Event('input',{bubbles:true}));return 1})()`); },
    async upload(sel, files) {
      const { root } = await send("DOM.getDocument", { depth: 0 });
      const { nodeId } = await send("DOM.querySelector", { nodeId: root.nodeId, selector: sel });
      await send("DOM.setFileInputFiles", { nodeId, files: [].concat(files) });
      await this.eval(`document.querySelector(${JSON.stringify(sel)}).dispatchEvent(new Event('change',{bubbles:true}))`);
    },
    async shot(name, full = true) {
      let clip; if (full) { const m = await send("Page.getLayoutMetrics"); clip = { x: 0, y: 0, width: Math.ceil(m.cssContentSize.width), height: Math.min(6000, Math.ceil(m.cssContentSize.height)), scale: 1 }; }
      const r = await send("Page.captureScreenshot", { format: "png", ...(clip ? { clip, captureBeyondViewport: true } : {}) }); const f = path.join(OUT, name + ".png"); fs.writeFileSync(f, Buffer.from(r.data, "base64")); return f; },
    async setHtml(html) { const { frameTree } = await send("Page.getFrameTree"); await send("Page.setDocumentContent", { frameId: frameTree.frame.id, html }); },
  };
  return { page, close: b.close, send };
}

// ---- run ----
if (import.meta.url === new URL(process.argv[1], "file:///").href || process.argv[1].endsWith("browser-test.mjs")) {
  const only = process.env.ONLY ? process.env.ONLY.split("|") : null;
  const { page, close } = await startBrowser();
  let failed = 0;
  try {
    for (const [name, fn] of Object.entries(SCENARIOS)) {
      if (only && !only.includes(name)) continue;
      const before = page.problems.length;
      try { await fn(page); const extra = page.problems.slice(before); if (extra.length) throw new Error("page problems: " + extra.join(" | ")); console.log("ok   " + name); }
      catch (e) { failed++; console.log("FAIL " + name + ": " + (e && e.message)); }
    }
  } finally { await close(); }
  console.log(failed ? `\n${failed} scenario(s) failed. Screenshots: ${OUT}` : `\nAll scenarios passed. Screenshots: ${OUT}`);
  process.exit(failed ? 1 : 0);
}
