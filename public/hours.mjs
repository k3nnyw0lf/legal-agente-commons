// SPDX-License-Identifier: AGPL-3.0-only
// Pro bono hours tracker: pure code (no DOM, no network) used by the server, the page and the tests.
// A helper logs time per case and downloads a year-end report. Hours are private to the helper: nobody else sees them,
// and they are never used in a score or a match (docs/access-model.md). The report is made from the helper's own
// entries; it is not a certification, and nothing is reported to anyone.
//
// DRAFT: the English and Spanish texts are for a Florida lawyer and a Spanish speaker to review.

export const KINDS = [
  { id: "review", en: "Reviewing papers", es: "Revisar papeles" },
  { id: "research", en: "Research", es: "Investigación" },
  { id: "meeting", en: "Meeting", es: "Reunión" },
  { id: "drafting", en: "Drafting", es: "Redacción" },
  { id: "translating", en: "Translating", es: "Traducción" },
  { id: "travel", en: "Court visit or travel", es: "Visita al tribunal o viaje" },
  { id: "training", en: "Training", es: "Capacitación" },
  { id: "other", en: "Other", es: "Otro" },
];

// What the Florida Bar's own page says, found 2026-11-09 and nowhere else in this tool (a test checks that).
// Source: Rules Regulating The Florida Bar, Chapter 4 (Rules of Professional Conduct), Rule 4-6.1(b) and (d),
// RRTFB version dated October 22, 2026, from https://www.floridabar.org/rules/rrtfb/.
export const BAR_NOTE = {
  en: "For lawyers: Rule 4-6.1 of the Rules Regulating The Florida Bar describes an aspirational goal of at least 20 hours of pro bono legal service to the poor each year, or a contribution of at least $350 to a legal aid organization. Each member must report each year through the Bar's annual membership fees statement. Source: the Bar's Rules of Professional Conduct, Chapter 4 (RRTFB version dated October 22, 2026), https://www.floridabar.org/rules/rrtfb/ (checked 2026-11-09). Rules change: confirm on the Bar's page before relying on this note.",
  es: "Para abogados: la Regla 4-6.1 de las Reglas que Regulan el Colegio de Abogados de Florida (Rules Regulating The Florida Bar) describe una meta aspiracional de al menos 20 horas al año de servicio legal gratuito para personas pobres, o una contribución de al menos $350 a una organización de ayuda legal. Cada miembro debe informar cada año mediante la declaración anual de cuotas de membresía del Colegio. Fuente: las Reglas de Conducta Profesional del Colegio, Capítulo 4 (versión del 22 de octubre de 2026), https://www.floridabar.org/rules/rrtfb/ (revisado el 2026-11-09). Las reglas cambian: confirme en la página del Colegio antes de confiar en esta nota.",
};

const clean = (s, n) => String(s == null ? "" : s).replace(/\u0000/g, "").replace(/[\u0001-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, n);
function validDate(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || "")); if (!m) return false;
  const y = +m[1], mo = +m[2], d = +m[3], t = new Date(Date.UTC(y, mo - 1, d));
  return y >= 2000 && t.getUTCFullYear() === y && t.getUTCMonth() === mo - 1 && t.getUTCDate() === d;
}

// Checks one entry from the form. Returns { ok: true, entry } or { ok: false, error }.
export function cleanEntry(b, { today = new Date().toISOString().slice(0, 10) } = {}) {
  b = b || {};
  const date = String(b.date || "");
  if (!validDate(date)) return { ok: false, error: "That date does not look right." };
  if (date > today) return { ok: false, error: "Hours are logged after the work is done: that date is in the future." };
  const h = Number(String(b.hours == null ? "" : b.hours).replace(",", "."));
  const minutes = Math.round(h * 60);
  if (!Number.isFinite(h) || minutes < 5 || minutes > 1440) return { ok: false, error: "Hours must be between 5 minutes and 24 hours." };
  const kind = String(b.kind || "");
  if (!KINDS.some(k => k.id === kind)) return { ok: false, error: "Pick one of the kinds of work." };
  return { ok: true, entry: { date, minutes, kind, caseRef: clean(b.caseRef, 60), note: clean(b.note, 200) } };
}

const label = (id, lang) => { const k = KINDS.find(x => x.id === id); return k ? k[lang === "es" ? "es" : "en"] : id; };
const hrs = m => (m / 60).toFixed(2);

export function totals(entries) {
  const k = new Map(), c = new Map(); let minutes = 0;
  for (const e of entries || []) {
    minutes += e.minutes;
    k.set(e.kind, (k.get(e.kind) || 0) + e.minutes);
    c.set(e.caseRef || "", (c.get(e.caseRef || "") || 0) + e.minutes);
  }
  return { minutes, hours: hrs(minutes), byKind: [...k].map(([id, m]) => ({ id, minutes: m })), byCase: [...c].map(([caseRef, m]) => ({ caseRef, minutes: m })) };
}

const inYear = (e, year) => !year || String(e.date).startsWith(String(year) + "-");
const byDate = (a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : String(a.id).localeCompare(String(b.id)));

// A file for a spreadsheet. A cell that starts with = + - @ is made harmless, so opening it cannot run a formula.
const HEAD = { en: ["Date", "Hours", "Activity", "Case reference", "Note"], es: ["Fecha", "Horas", "Actividad", "Referencia del caso", "Nota"] };
const guard = s => (/^[=+\-@\t\r]/.test(s) ? "'" + s : s);
const cell = s => (/[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s);
export function toCsv(entries, { year, lang = "en" } = {}) {
  const L = lang === "es" ? "es" : "en";
  const rows = (entries || []).filter(e => inYear(e, year)).sort(byDate).map(e => [e.date, hrs(e.minutes), guard(label(e.kind, L)), guard(e.caseRef || ""), guard(e.note || "")].map(cell).join(","));
  return "﻿" + [HEAD[L].join(","), ...rows].join("\r\n") + "\r\n";
}

const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const R = {
  en: { title: "Pro bono hours", sub: "Year-end report", helper: "Helper", year: "Year", made: "Made", total: "Total hours", byCase: "By case", byKind: "By activity", noCase: "(no case named)", none: "No hours logged for this year.",
    cols: ["Date", "Hours", "Activity", "Case reference", "Note"], print: "Print or save as PDF", count: "Entries",
    own: "Only you decide which of these hours count.", how: "This report is made from the helper's own entries in Legal Agente. It is not a certification, and Legal Agente does not report these hours to anyone." },
  es: { title: "Horas de servicio legal gratuito", sub: "Informe de fin de año", helper: "Ayudante", year: "Año", made: "Hecho", total: "Total de horas", byCase: "Por caso", byKind: "Por actividad", noCase: "(sin caso indicado)", none: "No hay horas registradas para este año.",
    cols: ["Fecha", "Horas", "Actividad", "Referencia del caso", "Nota"], print: "Imprimir o guardar como PDF", count: "Entradas",
    own: "Solo usted decide cuáles de estas horas cuentan.", how: "Este informe se hace con las entradas del propio ayudante en Legal Agente. No es una certificación, y Legal Agente no informa estas horas a nadie." },
};

// A printable report page: the year's entries, totals by case and by activity, and the Florida Bar note for lawyers.
export function reportHtml(entries, { year, who = "", lang = "en", made = new Date().toISOString().slice(0, 10) } = {}) {
  const L = lang === "es" ? "es" : "en", T = R[L], list = (entries || []).filter(e => inYear(e, year)).sort(byDate), t = totals(list);
  const row = e => `<tr><td>${esc(e.date)}</td><td class="n">${hrs(e.minutes)}</td><td>${esc(label(e.kind, L))}</td><td>${esc(e.caseRef || "")}</td><td>${esc(e.note || "")}</td></tr>`;
  return `<!doctype html>
<html lang="${L}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, nofollow">
<title>${esc(T.title)} ${esc(year || "")}</title>
<style>
:root{color-scheme:light}body{font:16px/1.4 Arial,Helvetica,sans-serif;color:#111;background:#fff;margin:0 auto;max-width:860px;padding:18px}
h1{font-size:26px;margin:0 0 2px}h2{font-size:18px;margin:22px 0 6px}.sub{color:#444;margin:0 0 12px}
table{border-collapse:collapse;width:100%}th,td{border-bottom:1px solid #bbb;padding:6px 8px 6px 0;text-align:left;vertical-align:top}.n{text-align:right;font-variant-numeric:tabular-nums}
.note{border-left:6px solid #666;background:#f3f2f1;padding:10px 12px;margin:14px 0}.small{font-size:14px;color:#333}
button{font:inherit;padding:10px 14px;border:2px solid #111;background:#fff;cursor:pointer;min-height:44px}
@media print{button{display:none}body{padding:0;font-size:12px}@page{margin:14mm}}
</style></head><body>
<h1>${esc(T.title)}</h1><p class="sub">${esc(T.sub)} · ${esc(T.year)} ${esc(year || "")} · ${esc(T.helper)}: ${esc(who)} · ${esc(T.made)}: ${esc(made)}</p>
<p><button type="button" onclick="window.print()">${esc(T.print)}</button></p>
<p class="note"><b>${esc(T.own)}</b> ${esc(T.how)}</p>
<h2>${esc(T.total)}: ${t.hours}</h2><p class="small">${esc(T.count)}: ${list.length}</p>
${list.length ? `<h2>${esc(T.byCase)}</h2><table>${t.byCase.sort((a, b) => b.minutes - a.minutes).map(x => `<tr><td>${esc(x.caseRef || T.noCase)}</td><td class="n">${hrs(x.minutes)}</td></tr>`).join("")}</table>
<h2>${esc(T.byKind)}</h2><table>${t.byKind.sort((a, b) => b.minutes - a.minutes).map(x => `<tr><td>${esc(label(x.id, L))}</td><td class="n">${hrs(x.minutes)}</td></tr>`).join("")}</table>
<h2>${esc(T.cols[0])}</h2><table><thead><tr>${T.cols.map(c => `<th>${esc(c)}</th>`).join("")}</tr></thead><tbody>${list.map(row).join("")}</tbody></table>` : `<p>${esc(T.none)}</p>`}
<p class="note small">${esc(BAR_NOTE[L])}</p>
</body></html>`;
}
