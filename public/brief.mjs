// SPDX-License-Identifier: AGPL-3.0-only
// One-page summary for a volunteer: the case on one printable page, so a volunteer can help in a short session.
// Built only from what is already in the case file. No AI, nothing calculated, no advice.
// Leaves out phone numbers and addresses: only the person's own note on how they like to be reached.
// Used by the app ("📄 One-page summary") and by the tests (no browser needed).

const L = {
  en: {
    title: "One-page summary for a volunteer", fiction: "FICTIONAL SAMPLE: not a real case",
    note: "Made from the case file to help a volunteer get up to speed. Not legal advice. Check every fact against the papers.",
    people: "Who's who", events: "What happened (key events)", found: n => n + " more dates were found in the papers. See the timeline in the app.",
    letters: "Letters", sent: "Sent", received: "Received", money: "Money",
    calendar: "Dates already on the case calendar (a lawyer confirms each one)", confirm: "to confirm",
    asks: "Open requests from the lawyer", gaps: "Still missing a page", contact: "How the person likes to be reached",
    papers: n => "Papers in the file (" + n + ")", print: "Print", made: "Made", none: "Nothing here yet.", more: n => "and " + n + " more",
    footer: "Legal Agente · free tools to put a case in order · not a law firm, not legal advice.",
  },
  es: {
    title: "Resumen de una página para el voluntario", fiction: "EJEMPLO FICTICIO: no es un caso real",
    note: "Hecho con el expediente para que un voluntario se ponga al día. No es asesoría legal. Revise cada dato con los papeles.",
    people: "Quién es quién", events: "Qué pasó (hechos clave)", found: n => "Se encontraron " + n + " fechas más en los papeles. Vea la línea de tiempo en la app.",
    letters: "Cartas", sent: "Enviada", received: "Recibida", money: "Dinero",
    calendar: "Fechas ya en el calendario del caso (un abogado confirma cada una)", confirm: "por confirmar",
    asks: "Pedidos abiertos del abogado", gaps: "Todavía falta una página", contact: "Cómo prefiere que lo contacten",
    papers: n => "Papeles en el expediente (" + n + ")", print: "Imprimir", made: "Hecho", none: "Nada todavía.", more: n => "y " + n + " más",
    footer: "Legal Agente · herramientas gratis para poner un caso en orden · no es un bufete, no es asesoría legal.",
  },
};

const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const strip = s => String(s == null ? "" : s).replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
const when = d => { const t = Date.parse(d); return isNaN(t) ? 9e15 : t; };
const isoLabel = iso => { const t = Date.parse(iso + "T00:00:00Z"); return isNaN(t) ? String(iso) : new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }); };

// Links into the case's own files need the case code; everything else stays as it is.
function linker(CASE, origin, code) {
  const cf = CASE.cf || "";
  return u => {
    if (!u) return "";
    const s = String(u);
    if (/^https?:\/\//i.test(s)) return s;
    const [base, hash] = s.split("#");
    const own = base.startsWith("/cf/") || (cf && base.startsWith(cf));
    return (origin || "") + base + (own && code ? (base.includes("?") ? "&" : "?") + "code=" + encodeURIComponent(code) : "") + (hash ? "#" + hash : "");
  };
}

export function buildBrief(CASE, { origin = "", code = "", max = 8 } = {}) {
  const C = CASE || {}, link = linker(C, origin, code);
  const people = Object.values(C.nodes || {}).map(n => ({ name: strip(n.nm), role: strip(n.rl) })).filter(p => p.name);
  const all = (C.timeline || []).filter(ph => !ph.auto).flatMap(ph => ph.events || []);
  const found = (C.timeline || []).filter(ph => ph.auto).reduce((a, ph) => a + (ph.events || []).length, 0);
  // Key events: starred and disputed ones first, then the latest others; shown in date order.
  const key = all.filter(e => e.f === "*" || e.f === "!");
  const rest = all.filter(e => !(e.f === "*" || e.f === "!")).sort((a, b) => when(b.d) - when(a.d));
  const pick = key.concat(rest).slice(0, max).sort((a, b) => when(a.d) - when(b.d));
  const events = pick.map(e => ({ d: strip(e.d), t: strip(e.t), src: strip(e.s), href: link(e.u), flag: e.f === "!" ? "!" : e.f === "*" ? "*" : "" }));
  const letters = (C.letters || []).slice(0, 6).map(l => ({ date: strip(l.date), title: strip(l.title), party: strip(l.party), body: strip(l.body), dir: l.dir === "sent" ? "sent" : "received" }));
  const money = (C.money || []).slice(0, 5).map(r => ({ amount: strip(r[0]), note: strip(r[2]) }));
  const calendar = (C.deadlines || []).map(x => ({ d: x.d, label: isoLabel(x.d), what: strip(x.what), confirm: !!x.confirm })).sort((a, b) => String(a.d).localeCompare(String(b.d)));
  const asks = ((C.requests && C.requests.rows) || []).filter(r => !/^\s*done\b/i.test(String(r.resp || ""))).slice(0, 6).map(r => ({ who: strip(r.who), date: strip(r.date), ask: strip(r.ask), resp: strip(r.resp) }));
  const gaps = ((C.proof && C.proof.claims) || []).flatMap(c => (c.elements || []).filter(e => !(e.ev || []).length).map(e => ({ claim: strip(c.name), el: strip(e.el) }))).slice(0, 6);
  // Only the person's own note on how to reach them: never their phone number or address.
  const contactNote = Object.values(C.contacts || {}).filter(c => /client|cliente/i.test(String(c.role || ""))).map(c => strip(c.note)).filter(Boolean).join(" ");
  const files = ((C.files && C.files.groups) || []).flatMap(g => g.items || []);
  const papers = files.slice(0, 12).map(f => ({ t: strip(f.t), href: f.h ? link((C.cf || "") + f.h) : "" }));
  return {
    fictional: !!C.fictional, title: strip(C.title), cn: strip(C.cn), people, events, found, letters, money,
    calendar, asks, gaps, contactNote, papers, papersTotal: files.length, made: new Date().toISOString().slice(0, 10),
  };
}

export function renderBrief(b, lang = "en") {
  const T = L[lang === "es" ? "es" : "en"];
  const sec = (h, body) => `<section><h2>${esc(h)}</h2>${body || `<p class="muted">${esc(T.none)}</p>`}</section>`;
  const ul = (items, f) => items.length ? `<ul>${items.map(x => `<li>${f(x)}</li>`).join("")}</ul>` : "";
  const a = (href, text) => href ? `<a href="${esc(href)}" target="_blank" rel="noopener">${esc(text)}</a>` : esc(text);
  return `<!doctype html>
<html lang="${lang === "es" ? "es" : "en"}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow"><title>${esc(T.title)}: ${esc(b.title)}</title>
<style>
:root{color-scheme:light}
body{font:14px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#111;background:#fff;margin:0 auto;max-width:820px;padding:16px}
h1{font-size:20px;margin:0 0 2px}h2{font-size:13px;text-transform:uppercase;letter-spacing:.04em;color:#374151;margin:14px 0 4px;border-bottom:1px solid #e5e7eb;padding-bottom:2px}
.cn{color:#4b5563;margin:0 0 8px}.note{background:#f3f4f6;border-left:3px solid #6b7280;padding:6px 10px;margin:8px 0}
.fiction{background:#fee2e2;color:#991b1b;font-weight:700;text-align:center;padding:4px;margin-bottom:8px;border-radius:4px}
ul{margin:4px 0;padding-left:18px}li{margin:2px 0}.muted{color:#6b7280}.src{color:#4b5563;font-size:12px}.flag{font-weight:700}
.cols{display:grid;grid-template-columns:1fr 1fr;gap:0 18px}@media (max-width:640px){.cols{grid-template-columns:1fr}}
.bar{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:6px}
button{font:inherit;padding:6px 12px;border:1px solid #9ca3af;border-radius:6px;background:#fff;cursor:pointer}
a{color:#1d4ed8}footer{margin-top:14px;color:#6b7280;font-size:12px;border-top:1px solid #e5e7eb;padding-top:6px}
@media print{button{display:none}body{padding:0;font-size:12px}a{color:#111;text-decoration:none}@page{margin:12mm}}
</style></head><body>
${b.fictional ? `<div class="fiction">${esc(T.fiction)}</div>` : ""}
<div class="bar"><div><h1>${esc(b.title)}</h1><p class="cn">${esc(b.cn)}</p></div><button type="button" onclick="window.print()">${esc(T.print)}</button></div>
<p class="note"><b>${esc(T.title)}.</b> ${esc(T.note)}</p>
<div class="cols">
${sec(T.people, ul(b.people, p => `<b>${esc(p.name)}</b>${p.role ? `: ${esc(p.role)}` : ""}`))}
${sec(T.contact, b.contactNote ? `<p>${esc(b.contactNote)}</p>` : "")}
</div>
${sec(T.events, ul(b.events, e => `<b>${esc(e.d)}</b> ${e.flag === "!" ? '<span class="flag">⚠</span> ' : e.flag === "*" ? '<span class="flag">★</span> ' : ""}${esc(e.t)}${e.src ? ` <span class="src">(${a(e.href, e.src)})</span>` : ""}`) + (b.found ? `<p class="muted">${esc(T.found(b.found))}</p>` : ""))}
<div class="cols">
${sec(T.calendar, ul(b.calendar, c => `<b>${esc(c.label)}</b> ${esc(c.what)}${c.confirm ? ` <span class="src">(${esc(T.confirm)})</span>` : ""}`))}
${sec(T.money, ul(b.money, m => `<b>${esc(m.amount)}</b> ${esc(m.note)}`))}
</div>
${sec(T.letters, ul(b.letters, l => `<b>${esc(l.date)}</b> ${esc(l.title)} <span class="src">(${esc(l.dir === "sent" ? T.sent : T.received)}; ${esc(l.party)})</span><br>${esc(l.body)}`))}
<div class="cols">
${sec(T.asks, ul(b.asks, r => `${esc(r.ask)} <span class="src">(${esc(r.who)}, ${esc(r.date)}${r.resp ? "; " + esc(r.resp) : ""})</span>`))}
${sec(T.gaps, ul(b.gaps, g => `${esc(g.el)} <span class="src">(${esc(g.claim)})</span>`))}
</div>
${sec(T.papers(b.papersTotal), ul(b.papers, p => a(p.href, p.t)) + (b.papersTotal > b.papers.length ? `<p class="muted">${esc(T.more(b.papersTotal - b.papers.length))}</p>` : ""))}
<footer>${esc(T.footer)} ${esc(T.made)}: ${esc(b.made)}</footer>
</body></html>`;
}
