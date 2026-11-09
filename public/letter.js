// SPDX-License-Identifier: AGPL-3.0-only
// The page for "What is this letter?" (public/letter.html). Everything happens on the phone:
//   photo -> OCR in this browser -> the rules in letter-check.mjs -> what the page shows.
// The photo and its words stay in memory only. They are never written to browser storage, and nothing is sent
// anywhere unless the person chooses "Save this to my case". Numbers that look like a Social Security number are
// blacked out on the picture and hidden in the text before anything is shown or saved.
// Paper text is put on the page with textContent only, never as HTML.
import { analyzeLetter, ssnBoxes, redactSsn, sharpness, UI, HELPERS } from "/letter-check.mjs";
import { DONT_KNOW } from "/grounding.mjs";
import { buildIcs, icsName, CAL } from "/calendar-file.mjs";
import { saveIcs } from "/calendar-save.mjs";

const $ = id => document.getElementById(id);
const lang = () => (document.documentElement.getAttribute("data-lang") === "es" ? "es" : "en");
const L = () => UI[lang()].labels;
const N = () => UI[lang()].notes;
const IDLE_MS = 10 * 60 * 1000;

// In memory only. Dropped by clearAll().
let state = null;   // { canvas, ocr (hidden numbers already removed), result, checked: Set(iso) }
let idleTimer = 0;
const made = [];    // every canvas made, so they can be emptied

function el(tag, props = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) { if (k === "class") e.className = v; else if (k === "text") e.textContent = v; else e.setAttribute(k, v); }
  for (const k of kids) if (k) e.append(k);
  return e;
}
const say = t => { $("la-status").textContent = t || ""; };
const bump = () => { clearTimeout(idleTimer); idleTimer = setTimeout(() => { if (state) clearAll(true); }, IDLE_MS); };

function newCanvas(w, h) { const c = document.createElement("canvas"); c.width = w; c.height = h; made.push(c); return c; }

function clearAll(announce) {
  clearTimeout(idleTimer);
  state = null;
  for (const c of made.splice(0)) { c.width = 0; c.height = 0; }
  $("la-result").replaceChildren(); $("la-result").hidden = true;
  $("la-actions").hidden = true;
  $("la-file").value = ""; $("la-file2").value = "";
  say(announce ? L().deleted : "");
}

// ---------- the photo ----------
async function toCanvas(file) {
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  const k = Math.min(1, 2200 / Math.max(bmp.width, bmp.height));
  const c = newCanvas(Math.round(bmp.width * k), Math.round(bmp.height * k));
  c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
  if (bmp.close) bmp.close();
  return c;
}
function measureSharpness(c) {
  const w = Math.min(640, c.width), h = Math.max(1, Math.round(c.height * w / c.width));
  const t = newCanvas(w, h), g = t.getContext("2d");
  g.drawImage(c, 0, 0, w, h);
  const d = g.getImageData(0, 0, w, h).data, gray = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) gray[i] = (d[4 * i] * 0.299 + d[4 * i + 1] * 0.587 + d[4 * i + 2] * 0.114) | 0;
  t.width = t.height = 0;
  return sharpness(gray, w, h);
}
function loadScript(src) { return new Promise((res, rej) => { const s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = () => rej(new Error("Could not load " + src)); document.head.appendChild(s); }); }
// The photo reader (tesseract.js, Apache-2.0) is fetched from a public CDN the first time. Only the program and its
// English and Spanish language data are fetched; the photo is not sent anywhere.
async function reader() {
  if (!window.Tesseract) await loadScript("https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js");
  return window.Tesseract.createWorker(["eng", "spa"], 1, { workerPath: "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/worker.min.js", corePath: "https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1" });
}
const plainLines = data => (data.lines || []).map(l => ({ text: String(l.text || "").replace(/\s+$/, ""), bbox: l.bbox, words: (l.words || []).map(w => ({ text: w.text, bbox: w.bbox })) }));

async function handleFile(file) {
  if (!file) return;
  clearAll(); bump();
  try {
    say(L().loadingReader);
    const canvas = await toCanvas(file);
    const sh = measureSharpness(canvas);
    const w = await reader();
    say(L().reading);
    const { data } = await w.recognize(canvas);
    await w.terminate();
    const ocr = { text: data.text || "", confidence: data.confidence, lines: plainLines(data), sharpness: sh };
    // Black out anything that looks like a Social Security number, on the picture and in the words.
    const g = canvas.getContext("2d"); g.fillStyle = "#000";
    for (const b of ssnBoxes(ocr)) g.fillRect(Math.max(0, b.x0), Math.max(0, b.y0), b.x1 - b.x0, b.y1 - b.y0);
    const safe = { text: redactSsn(ocr.text).text, confidence: ocr.confidence, sharpness: sh, lines: ocr.lines.map(l => ({ text: redactSsn(l.text).text, bbox: l.bbox })) };
    state = { canvas, ocr: safe, result: null, checked: new Set() };
    say(""); render(); bump();
  } catch (e) {
    say(e && /Could not load/.test(e.message || "") ? (lang() === "es" ? "No se pudo preparar el lector de fotos. Revise la conexión a internet e intente otra vez." : "Could not get the photo reader ready. Check the internet connection and try again.") : (lang() === "es" ? "No se pudo leer esta foto. Una foto nueva podría ayudar." : "Could not read this photo. A new photo may help."));
  }
}

// ---------- what the page shows ----------
function crop(canvas, box) {
  const pad = { x: 16, y: 12 };
  const x0 = Math.max(0, Math.floor(box.x0 - pad.x)), y0 = Math.max(0, Math.floor(box.y0 - pad.y));
  const x1 = Math.min(canvas.width, Math.ceil(box.x1 + pad.x)), y1 = Math.min(canvas.height, Math.ceil(box.y1 + pad.y));
  const w = Math.max(1, x1 - x0), h = Math.max(1, y1 - y0), k = Math.min(1, 560 / w);
  const c = newCanvas(Math.round(w * k), Math.round(h * k));
  c.getContext("2d").drawImage(canvas, x0, y0, w, h, 0, 0, c.width, c.height);
  c.className = "crop";
  return c;
}
const quote = (label, text) => el("p", { class: "quote" }, el("b", { text: label + " " }), el("span", { text: "“" + text + "”" }));

function render() {
  if (!state) return;
  const lg = lang(), r = state.result = analyzeLetter(state.ocr, { lang: lg }), n = N(), l = L();
  const out = $("la-result"); out.replaceChildren(); out.hidden = false; $("la-actions").hidden = false;
  out.classList.add("result");
  const note = id => el("p", { text: n[id] });

  if (r.status !== "read") {
    out.append(el("div", { class: "callout", role: "alert" }, el("p", { text: n[r.status === "unreadable" ? "noText" : "newPhoto"] })), el("p", { class: "notadvice", text: n.notAdvice }));
    return;
  }
  // what kind of paper
  out.append(el("h2", { text: l.kindHeading }));
  if (r.kind) {
    out.append(el("p", { class: "kind", text: r.kind.name }), el("p", { text: r.kind.what }));
    if (r.why.length) { out.append(note("why"), el("ul", {}, ...r.why.map(w => el("li", { text: "“" + w + "”" })))); }
  } else out.append(el("p", { class: "kind", text: DONT_KNOW[lg] }));

  // dates, each with the photo next to it
  out.append(el("h2", { text: l.datesHeading }));
  let allBtn = null;
  if (r.dates.length) {
    out.append(note("datesCheck"));
    const ol = el("ol", { class: "dates" });
    for (const d of r.dates) {
      const id = "la-chk-" + d.iso;
      const cb = el("input", { type: "checkbox", id }); cb.checked = state.checked.has(d.iso);
      const calBtn = el("button", { type: "button", class: "btn secondary small", text: CAL[lg].button }); calBtn.disabled = !cb.checked;
      calBtn.addEventListener("click", () => addToCalendar([d]));
      cb.addEventListener("change", () => { cb.checked ? state.checked.add(d.iso) : state.checked.delete(d.iso); calBtn.disabled = !cb.checked; allBtn && (allBtn.disabled = !state.checked.size); bump(); });
      const fig = d.box ? el("figure", { class: "cropfig" }, crop(state.canvas, d.box), el("figcaption", { class: "cropcap", text: l.dateOnPhoto })) : null;
      if (fig) fig.querySelector("canvas").setAttribute("role", "img"), fig.querySelector("canvas").setAttribute("aria-label", l.dateOnPhoto + ": " + d.raw);
      ol.append(el("li", { "data-iso": d.iso },
        el("div", { class: "dateBig", text: d.label }),
        el("div", { class: "small", text: d.snippet }),
        fig,
        d.more ? el("div", { class: "small", text: l.alsoAgain.replace("{n}", d.more) }) : null,
        el("label", { class: "chk", for: id }, cb, el("span", { text: l.checked })), calBtn));
    }
    out.append(ol);
    // one file with every checked date, and the plain note: what it does, and that nothing is sent
    allBtn = el("button", { type: "button", class: "btn secondary", id: "la-cal-all", text: CAL[lg].buttonAll }); allBtn.disabled = !state.checked.size;
    allBtn.addEventListener("click", () => addToCalendar(r.dates.filter(x => state.checked.has(x.iso))));
    out.append(el("div", { class: "calbox" }, allBtn, el("p", { class: "small", id: "la-cal-msg", role: "status", "aria-live": "polite", text: CAL[lg].needCheck }), el("p", { class: "small", text: CAL[lg].note })));
  } else out.append(note("noDates"));

  if (r.periods.length) {
    out.append(el("h2", { text: l.periodsHeading }), note("periods"));
    for (const p of r.periods) out.append(quote(l.quoteLabel, p.snippet));
  }

  // who can help (approved list only)
  out.append(el("h2", { text: l.helpHeading }), note(r.kind ? "help" : "helpAny"));
  const ul = el("ul", { class: "help" });
  for (const h of r.helpers) { if (!HELPERS[h.id]) continue; ul.append(el("li", {}, el("a", { href: h.url, target: "_blank", rel: "noopener", text: h.name }), el("div", { text: h.what }))); }
  out.append(ul, el("p", { class: "notadvice", text: n.notAdvice }));

  // save (only on purpose)
  out.append(saveBlock());
}

// A calendar file for the dates the person checked. Made and saved on this phone; nothing is sent.
function addToCalendar(dates) {
  if (!state || !dates.length) return;
  const lg = lang(), where = state.result && state.result.kind ? state.result.kind.name : "";
  const evs = dates.map(d => ({ iso: d.iso, where, quote: d.snippet }));
  const ics = buildIcs(evs, { lang: lg });
  if (!ics) return;
  saveIcs(ics, icsName(evs, lg));
  const m = $("la-cal-msg"); if (m) m.textContent = CAL[lg].saved;
  bump();
}

function saveBlock() {
  const l = L(), box = el("div", { class: "save", id: "la-save" });
  const code = el("input", { id: "la-code", type: "text", inputmode: "numeric", autocomplete: "off", "aria-label": lang() === "es" ? "Código de caso" : "Case code", placeholder: lang() === "es" ? "código de caso" : "case code" });
  const msg = el("p", { id: "la-save-msg", role: "status", "aria-live": "polite", class: "small" });
  const btn = el("button", { type: "button", class: "btn secondary", id: "la-savecase", text: l.saveCase });
  btn.addEventListener("click", async () => {
    if (!state || !code.value.trim()) { msg.textContent = l.needsSignIn; return; }
    btn.disabled = true; msg.textContent = "…";
    try {
      const blob = await new Promise(res => state.canvas.toBlob(res, "image/jpeg", 0.85));
      const name = "letter-" + new Date().toISOString().slice(0, 10) + "-" + (state.result.kind ? state.result.kind.id : "paper") + ".jpg";
      const up = await fetch("/api/upload?" + new URLSearchParams({ code: code.value.trim(), name }), { method: "POST", headers: { "content-type": "image/jpeg" }, body: blob });
      if (up.status === 401 || up.status === 403) { msg.textContent = l.needsSignIn; btn.disabled = false; return; }
      const j = await up.json();
      if (!j.ok) { msg.textContent = j.error || l.needsSignIn; btn.disabled = false; return; }
      await fetch("/api/text-add", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code: code.value.trim(), h: j.h, n: name, pages: [state.ocr.text] }) });
      msg.textContent = l.saved;
    } catch { msg.textContent = l.needsSignIn; btn.disabled = false; }
  });
  box.append(el("div", { class: "row" }, code, btn), msg, el("p", { class: "small", text: l.hidden }));
  return box;
}

// ---------- wiring ----------
$("la-file").addEventListener("change", e => handleFile(e.target.files[0]));
$("la-file2").addEventListener("change", e => handleFile(e.target.files[0]));
$("la-delete").addEventListener("click", () => clearAll(true));
$("la-another").addEventListener("click", () => { clearAll(); $("la-file").focus(); });
window.addEventListener("pagehide", () => clearAll());
document.addEventListener("pointerdown", () => { if (state) bump(); });
// The language switch redraws the answer in the other language from what is already in memory.
new MutationObserver(() => { if (state) render(); }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-lang"] });
