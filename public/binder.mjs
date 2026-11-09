// SPDX-License-Identifier: AGPL-3.0-only
// Lawyer-ready binder: one tap makes a PDF a lawyer can use at once:
//   cover  ·  index with page numbers  ·  one-page summary  ·  timeline  ·  (contacts, only if turned on)  ·  every paper in the case.
// Every page says "Binder page N of M". The index lists each paper with the page it starts on and the pages it covers.
// Built on brief.mjs (the one-page summary). Made on the person's own device from the case file: nothing is sent.
// No phone numbers, email addresses or street addresses are written by the binder unless the person turns that on
// (the papers themselves are added as they are). No AI, nothing calculated, no advice.
//
// planBinder() decides what goes in (pure, testable). renderBinder() draws it with pdf-lib, which is passed in:
// the page loads /vendor/pdf-lib-1.17.1.min.js and the tests load the same file.
import { buildBrief } from "./brief.mjs";

export const BL = {
  en: {
    title: "Lawyer-ready binder", cn: "Case", made: "Made", papersCount: (n, p) => n + " papers, " + p + " pages of papers",
    notAdvice: "Not legal advice. Made from the case file to help a lawyer get up to speed. Check every fact against the papers.",
    device: "Made on the device that opened the case. Nothing was sent anywhere.",
    contactsOff: "Phone numbers and addresses: left out of the summary, timeline and cover. The papers are added as they are.",
    contactsOn: "Phone numbers and addresses: included, because the person turned them on. The papers are added as they are.",
    fiction: "FICTIONAL SAMPLE: not a real case",
    index: "Index", indexMore: "Index (continued)", page: "p.", notAdded: "not added", notIncluded: "not included",
    summary: "One-page summary", timeline: "Timeline", contacts: "Contacts (turned on by the person)", papers: "Papers",
    people: "Who's who", reach: "How the person likes to be reached", events: "What happened (key events)", moreFound: n => n + " more dates were found in the papers. See the Timeline.",
    calendar: "Dates already on the case calendar (a lawyer confirms each one)", confirm: "to confirm", money: "Money", letters: "Letters", sent: "Sent", received: "Received",
    asks: "Open requests from the lawyer", gaps: "Still missing a page",
    tlNote: "Every event with its source. Dates found in the papers were read by a computer; whether the person checked each one against the page is shown.",
    found: "Dates found in the papers", checkedYes: "checked by the person", checkedNo: "not checked yet",
    footer: (n, m) => "Binder page " + n + " of " + m,
    missing: "This paper could not be added to the binder. It is still in the case.", missingFor: "Could not be added:", skipNote: "Not a PDF or a photo, so it is not in the binder. Open it in the app.",
    none: "Nothing here yet.", more: n => "and " + n + " more",
    contactsNote: "Written because the person turned this on.",
  },
  es: {
    title: "Carpeta lista para el abogado", cn: "Caso", made: "Hecha", papersCount: (n, p) => n + " papeles, " + p + " páginas de papeles",
    notAdvice: "No es asesoría legal. Hecha con el expediente para que un abogado se ponga al día. Revise cada dato con los papeles.",
    device: "Hecha en el dispositivo que abrió el caso. No se envió nada a ningún lado.",
    contactsOff: "Teléfonos y direcciones: omitidos del resumen, la cronología y la portada. Los papeles se agregan tal como están.",
    contactsOn: "Teléfonos y direcciones: incluidos, porque la persona lo activó. Los papeles se agregan tal como están.",
    fiction: "EJEMPLO FICTICIO: no es un caso real",
    index: "Índice", indexMore: "Índice (continuación)", page: "p.", notAdded: "no agregado", notIncluded: "no incluido",
    summary: "Resumen de una página", timeline: "Cronología", contacts: "Contactos (activados por la persona)", papers: "Papeles",
    people: "Quién es quién", reach: "Cómo prefiere que lo contacten", events: "Qué pasó (hechos clave)", moreFound: n => "Se encontraron " + n + " fechas más en los papeles. Vea la Cronología.",
    calendar: "Fechas ya en el calendario del caso (un abogado confirma cada una)", confirm: "por confirmar", money: "Dinero", letters: "Cartas", sent: "Enviada", received: "Recibida",
    asks: "Pedidos abiertos del abogado", gaps: "Todavía falta una página",
    tlNote: "Cada hecho con su fuente. Las fechas encontradas en los papeles las leyó una computadora; se indica si la persona revisó cada una con la página.",
    found: "Fechas encontradas en los papeles", checkedYes: "revisada por la persona", checkedNo: "aún sin revisar",
    footer: (n, m) => "Carpeta página " + n + " de " + m,
    missing: "Este papel no se pudo agregar a la carpeta. Sigue en el caso.", missingFor: "No se pudo agregar:", skipNote: "No es un PDF ni una foto, así que no está en la carpeta. Ábralo en la app.",
    none: "Nada todavía.", more: n => "y " + n + " más",
    contactsNote: "Escrito porque la persona lo activó.",
  },
};

// ---------- text made safe for the PDF's built-in font (WinAnsi) ----------
const MAP = { "—": "-", "–": "-", "“": '"', "”": '"', "„": '"', "‘": "'", "’": "'", "…": "...", "★": "*", "⚠": "!", "✔": "yes", "•": "-", "→": "->", " ": " ", " ": " ", "​": "" };
export function toWinAnsi(s) {
  let out = "";
  for (const ch of String(s == null ? "" : s)) {
    if (MAP[ch] !== undefined) out += MAP[ch];
    else { const c = ch.codePointAt(0); out += c === 10 ? "\n" : c < 32 ? " " : c > 255 || (c >= 127 && c < 160) ? "?" : ch; }
  }
  return out;
}

// ---------- phone numbers, email addresses and street addresses ----------
const SCRUB = [
  /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g,
  /\(?\b\d{3}\)?[-. ]\d{3}[-. ]\d{4}\b/g,
  /\b\d{1,6}\s+(?:[A-Za-z0-9.'-]+\s+){1,3}(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Boulevard|Blvd|Lane|Ln|Court|Ct|Way|Place|Pl|Terrace|Circle)\b\.?(?:,?\s+(?:Suite|Ste|Unit|Apt|Apartment|#)\s*\w+)?/g,
  /\b[A-Z][a-z]+(?:\s[A-Z][a-z]+)*,?\s(?:FL|Florida)\s\d{5}(?:-\d{4})?\b/g,
];
export function scrub(text) {
  let s = String(text == null ? "" : text);
  for (const re of SCRUB) s = s.replace(re, m => (/[.]$/.test(m) && !/\d\.$/.test(m) && /(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Boulevard|Blvd|Lane|Ln|Court|Ct|Way|Place|Pl|Terrace|Circle)\.$/.test(m) ? "[hidden]." : "[hidden]"));
  return s;
}

const strip = s => String(s == null ? "" : s).replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

// ---------- the plan ----------
// opts: { lang, includeContacts (default false), isChecked(ev) for dates found in the papers, now }
export function planBinder(CASE, { lang = "en", includeContacts = false, isChecked = () => false, now = new Date() } = {}) {
  const C = CASE || {}, T = BL[lang === "es" ? "es" : "en"];
  const clean = x => includeContacts ? strip(x) : scrub(strip(x));
  const b = buildBrief(C, { origin: "", code: "" });
  const li = t => ({ k: "li", t }), h2 = t => ({ k: "h2", t }), p = t => ({ k: "p", t }), small = t => ({ k: "small", t });

  const sum = [p(T.notAdvice)];
  sum.push(h2(T.people), ...(b.people.length ? b.people.map(x => li(clean(x.name + (x.role ? ": " + x.role : "")))) : [small(T.none)]));
  if (b.contactNote) sum.push(h2(T.reach), p(clean(b.contactNote)));
  sum.push(h2(T.events), ...(b.events.length ? b.events.map(e => li(clean(e.d + "  " + (e.flag === "!" ? "[!] " : e.flag === "*" ? "[*] " : "") + e.t + (e.src ? " (" + e.src + ")" : ""))) ) : [small(T.none)]));
  if (b.found) sum.push(small(T.moreFound(b.found)));
  sum.push(h2(T.calendar), ...(b.calendar.length ? b.calendar.map(c => li(clean(c.label + "  " + c.what + (c.confirm ? " (" + T.confirm + ")" : "")))) : [small(T.none)]));
  sum.push(h2(T.money), ...(b.money.length ? b.money.map(m => li(clean(m.amount + "  " + m.note))) : [small(T.none)]));
  sum.push(h2(T.letters), ...(b.letters.length ? b.letters.map(l => li(clean(l.date + "  " + l.title + " (" + (l.dir === "sent" ? T.sent : T.received) + "; " + l.party + "): " + l.body))) : [small(T.none)]));
  sum.push(h2(T.asks), ...(b.asks.length ? b.asks.map(r => li(clean(r.ask + " (" + r.who + ", " + r.date + (r.resp ? "; " + r.resp : "") + ")"))) : [small(T.none)]));
  sum.push(h2(T.gaps), ...(b.gaps.length ? b.gaps.map(g => li(clean(g.el + " (" + g.claim + ")"))) : [small(T.none)]));

  const tl = [p(T.tlNote)];
  for (const ph of C.timeline || []) {
    tl.push(h2(clean(ph.auto ? T.found : ph.phase)));
    for (const ev of ph.events || []) {
      const line = strip(ev.d) + "  " + (ev.f === "!" ? "[!] " : ev.f === "*" ? "[*] " : "") + strip(ev.t) + (ev.s ? " (" + strip(ev.s) + ")" : "") + (ph.auto ? " [" + (isChecked(ev) ? T.checkedYes : T.checkedNo) + "]" : "");
      tl.push(li(clean(line)));
    }
  }

  const sections = [{ id: "summary", title: T.summary, blocks: sum }, { id: "timeline", title: T.timeline, blocks: tl }];
  if (includeContacts) {
    const cb = [small(T.contactsNote)];
    for (const c of Object.values(C.contacts || {})) {
      cb.push(h2(strip(c.who) + (c.role ? " (" + strip(c.role) + ")" : "")));
      for (const e of c.emails || []) cb.push(li(strip(e)));
      for (const ph of c.phones || []) cb.push(li(strip(ph)));
      if (c.address) cb.push(li(strip(c.address)));
      if (c.note) cb.push(small(strip(c.note)));
    }
    sections.push({ id: "contacts", title: T.contacts, blocks: cb });
  }

  const papers = [];
  for (const g of (C.files && C.files.groups) || []) for (const it of g.items || []) {
    const h = it.h ? String(it.h) : "", kind = /\.pdf$/i.test(h) ? "pdf" : /\.(png|jpe?g)$/i.test(h) ? "image" : "skip";
    papers.push({ title: clean(it.t), h, kind, group: strip(g.group) });
  }
  return { lang: lang === "es" ? "es" : "en", title: strip(C.title), cn: strip(C.cn), fictional: !!C.fictional, includeContacts: !!includeContacts, made: now.toISOString().slice(0, 10), sections, papers };
}

export function binderFileName(plan) {
  const t = (plan.title.split(" —")[0] || "case").replace(/[\\/:*?"<>|]+/g, "-").slice(0, 60).trim();
  return t + " - " + (plan.lang === "es" ? "carpeta para el abogado" : "lawyer-ready binder") + " " + plan.made + ".pdf";
}

// ---------- drawing ----------
const PG = { w: 612, h: 792, m: 54, foot: 34 };
const STYLE = { h1: { size: 18, bold: true, gap: 0, indent: 0 }, h2: { size: 12, bold: true, gap: 12, indent: 0 }, p: { size: 10, gap: 5, indent: 0 }, li: { size: 10, gap: 3, indent: 12, bullet: true }, small: { size: 8.5, gap: 4, indent: 0, gray: true } };
const ENTRIES_PER_INDEX_PAGE = 36;

function wrap(text, font, size, maxW) {
  const out = [];
  for (const para of toWinAnsi(text).split("\n")) {
    let cur = "";
    for (const word of para.split(/\s+/).filter(Boolean)) {
      let w = word;
      while (font.widthOfTextAtSize(w, size) > maxW) { // a word longer than a line
        let i = w.length; while (i > 1 && font.widthOfTextAtSize(w.slice(0, i), size) > maxW) i--;
        if (cur) { out.push(cur); cur = ""; }
        out.push(w.slice(0, i)); w = w.slice(i);
      }
      const t = cur ? cur + " " + w : w;
      if (font.widthOfTextAtSize(t, size) <= maxW) cur = t; else { out.push(cur); cur = w; }
    }
    out.push(cur);
  }
  return out;
}
function fitLine(text, font, size, maxW) {
  let t = toWinAnsi(text).replace(/\s+/g, " ");
  if (font.widthOfTextAtSize(t, size) <= maxW) return t;
  while (t.length > 1 && font.widthOfTextAtSize(t + "...", size) > maxW) t = t.slice(0, -1);
  return t.trimEnd() + "...";
}

// Lays blocks out into pages of text operations: [[{ t, x, y, size, bold, gray }]]
function layoutBlocks(blocks, F) {
  const top = PG.h - PG.m, bottom = PG.m + PG.foot, pages = [[]];
  let y = top;
  const fresh = () => { pages.push([]); y = top; };
  for (const b of blocks) {
    const st = STYLE[b.k] || STYLE.p, font = st.bold ? F.bold : F.reg, lh = st.size * 1.35;
    const lines = wrap((st.bullet ? "- " : "") + b.t, font, st.size, PG.w - 2 * PG.m - st.indent);
    const need = (y === top ? 0 : st.gap) + lines.length * lh + (b.k === "h2" ? 2 * lh : 0);
    if (y - need < bottom && y !== top) fresh();
    if (y !== top) y -= st.gap;
    lines.forEach((t, i) => { pages.at(-1).push({ t: i && st.bullet ? t : t, x: PG.m + st.indent + (i && st.bullet ? 8 : 0), y: y - st.size, size: st.size, bold: !!st.bold, gray: !!st.gray }); y -= lh; });
  }
  return pages;
}

// pdf-lib is passed in. fetchBytes(h) returns the bytes of a paper by its file name in the case.
// Returns { bytes, total, front, indexPages, index: [{ title, start, count, paper, status }] }.
export async function renderBinder(PDFLib, plan, fetchBytes, { now = new Date() } = {}) {
  const { PDFDocument, StandardFonts, rgb, degrees } = PDFLib, T = BL[plan.lang];
  const out = await PDFDocument.create();
  const reg = await out.embedFont(StandardFonts.Helvetica), bold = await out.embedFont(StandardFonts.HelveticaBold), F = { reg, bold };

  // 1. the papers: how many pages each one adds
  const loaded = [];
  for (const p of plan.papers) {
    if (p.kind === "skip") { loaded.push({ ...p, status: "skipped", count: 0 }); continue; }
    try {
      const bytes = await fetchBytes(p.h);
      if (p.kind === "pdf") { const src = await PDFDocument.load(bytes, { ignoreEncryption: true }); loaded.push({ ...p, src, status: "ok", count: src.getPageCount() }); }
      else loaded.push({ ...p, bytes, status: "ok", count: 1 });
    } catch { loaded.push({ ...p, status: "missing", count: 1 }); }
  }
  const paperPages = loaded.reduce((a, x) => a + x.count, 0);

  // 2. the front pages, laid out so every page number is known before anything is drawn
  const secPages = plan.sections.map(s => ({ id: s.id, title: s.title, pages: layoutBlocks(s.blocks, F) }));
  const entryCount = plan.sections.length + (loaded.length ? 1 : 0) + loaded.length;
  const indexPages = Math.max(1, Math.ceil(entryCount / ENTRIES_PER_INDEX_PAGE));
  let page = 1 + indexPages + 1;                       // cover is page 1, then the index; the first section follows
  const index = [];
  for (const s of secPages) { index.push({ title: s.title, start: page, count: s.pages.length, paper: false }); page += s.pages.length; }
  const front = page - 1;
  if (loaded.length) index.push({ title: T.papers, start: front + 1, count: paperPages, paper: false });
  let at = front + 1;
  for (const p of loaded) { index.push({ title: p.title, start: at, count: p.count, paper: true, status: p.status }); at += p.count; }
  const total = at - 1;

  // 3. draw: cover
  const draw = (pg, o) => pg.drawText(toWinAnsi(o.t), { x: o.x, y: o.y, size: o.size, font: o.bold ? bold : reg, color: o.gray ? rgb(0.33, 0.33, 0.33) : o.red ? rgb(0.6, 0.1, 0.1) : rgb(0, 0, 0) });
  const cover = out.addPage([PG.w, PG.h]);
  let y = PG.h - PG.m - 10;
  if (plan.fictional) { draw(cover, { t: T.fiction, x: PG.m, y, size: 11, bold: true, red: true }); y -= 30; }
  draw(cover, { t: T.title, x: PG.m, y, size: 22, bold: true }); y -= 34;
  for (const l of wrap(plan.title, bold, 16, PG.w - 2 * PG.m)) { draw(cover, { t: l, x: PG.m, y, size: 16, bold: true }); y -= 22; }
  for (const l of wrap(plan.cn, reg, 10, PG.w - 2 * PG.m)) { draw(cover, { t: l, x: PG.m, y, size: 10 }); y -= 14; }
  y -= 14;
  const facts = [T.made + ": " + plan.made, T.papersCount(loaded.filter(x => x.count).length, paperPages), (plan.lang === "es" ? "Páginas en total: " : "Pages in total: ") + total, plan.includeContacts ? T.contactsOn : T.contactsOff, T.device, T.notAdvice];
  for (const f of facts) for (const l of wrap(f, reg, 10, PG.w - 2 * PG.m)) { draw(cover, { t: l, x: PG.m, y, size: 10 }); y -= 14; }

  // index
  const rows = index.map(e => ({ e, label: e.paper ? "   " + e.title : e.title, bold: !e.paper }));
  for (let k = 0; k < indexPages; k++) {
    const pg = out.addPage([PG.w, PG.h]); let yy = PG.h - PG.m - 10;
    draw(pg, { t: k ? T.indexMore : T.index, x: PG.m, y: yy, size: 16, bold: true }); yy -= 30;
    for (const r of rows.slice(k * ENTRIES_PER_INDEX_PAGE, (k + 1) * ENTRIES_PER_INDEX_PAGE)) {
      const e = r.e;
      const range = e.status === "skipped" ? T.notIncluded : T.page + " " + (e.count > 1 ? e.start + "-" + (e.start + e.count - 1) : e.start);
      const right = e.status === "missing" ? T.notAdded + "  " + range : range, font = r.bold ? bold : reg, size = r.bold ? 10.5 : 9.5;
      const rw = font.widthOfTextAtSize(toWinAnsi(right), size);
      draw(pg, { t: fitLine(r.label, font, size, PG.w - 2 * PG.m - rw - 12), x: PG.m, y: yy, size, bold: r.bold });
      draw(pg, { t: right, x: PG.w - PG.m - rw, y: yy, size, bold: r.bold });
      yy -= 17;
    }
  }

  // sections
  for (const s of secPages) for (let i = 0; i < s.pages.length; i++) {
    const pg = out.addPage([PG.w, PG.h]);
    if (i === 0) draw(pg, { t: s.title, x: PG.m, y: PG.h - PG.m - 4, size: 18, bold: true });
    // text starts a little lower on the first page of a section, to leave room for the title
    s.pages[i].forEach(o => draw(pg, i === 0 ? { ...o, y: o.y - 26 } : o));
  }

  // papers
  const marks = []; // which paper each page belongs to, for the margin stamp
  for (const p of loaded) {
    if (p.status === "skipped") continue;
    if (p.status === "missing") {
      const pg = out.addPage([PG.w, PG.h]); let yy = PG.h - 160;
      draw(pg, { t: T.missingFor, x: PG.m, y: yy, size: 14, bold: true }); yy -= 24;
      for (const l of wrap(p.title, bold, 12, PG.w - 2 * PG.m)) { draw(pg, { t: l, x: PG.m, y: yy, size: 12, bold: true }); yy -= 18; }
      for (const l of wrap(T.missing, reg, 11, PG.w - 2 * PG.m)) { draw(pg, { t: l, x: PG.m, y: yy - 6, size: 11 }); yy -= 16; }
      marks.push(p.title); continue;
    }
    if (p.kind === "pdf") { for (const cp of await out.copyPages(p.src, p.src.getPageIndices())) { out.addPage(cp); marks.push(p.title); } }
    else {
      const img = /\.png$/i.test(p.h) ? await out.embedPng(p.bytes) : await out.embedJpg(p.bytes);
      const pg = out.addPage([PG.w, PG.h]), sc = Math.min(500 / img.width, 680 / img.height);
      pg.drawImage(img, { x: (PG.w - img.width * sc) / 2, y: (PG.h - img.height * sc) / 2, width: img.width * sc, height: img.height * sc }); marks.push(p.title);
    }
  }

  // every page says where it is
  out.getPages().forEach((pg, i) => {
    const label = T.footer(i + 1, total), size = 8, rot = pg.getRotation().angle % 360, { width } = pg.getSize();
    const mark = i >= front ? fitLine(marks[i - front] || "", reg, size, width - 220) : "";
    if (rot === 0) {
      pg.drawRectangle({ x: 0, y: 4, width, height: 15, color: rgb(1, 1, 1), opacity: 0.9 });
      pg.drawText(toWinAnsi(label), { x: width - reg.widthOfTextAtSize(toWinAnsi(label), size) - 22, y: 8, size, font: reg, color: rgb(0, 0, 0) });
      if (mark) pg.drawText(mark, { x: 22, y: 8, size, font: bold, color: rgb(0, 0, 0) });
    } else pg.drawText(toWinAnsi(label), { x: 18, y: 18, size, font: reg, color: rgb(0, 0, 0), rotate: degrees(rot) });
  });
  out.setTitle(toWinAnsi(T.title + ": " + plan.title)); out.setCreator("Legal Agente Commons"); out.setProducer("Legal Agente Commons (pdf-lib)");
  return { bytes: await out.save(), total, front, indexPages, index };
}
