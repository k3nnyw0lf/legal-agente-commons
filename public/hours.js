// SPDX-License-Identifier: AGPL-3.0-only
// The page for "My pro bono hours" (public/hours.html). Hours live on the server under the signed-in helper's own login
// (/api/hours), never in browser storage. Nothing a helper types is put on the page as markup: text only.
import { KINDS, BAR_NOTE, toCsv, reportHtml } from "/hours.mjs";

const $ = id => document.getElementById(id);
const lang = () => (document.documentElement.getAttribute("data-lang") === "es" ? "es" : "en");
const T = {
  en: { total: "Total hours this year", edit: "Change", del: "Delete", added: "Added.", saved: "Saved.", deleted: "Deleted.", none: "No hours logged for this year yet.", noCase: "(no case named)", sure: "Delete this entry?", err: "Could not save.", hours: "hours" },
  es: { total: "Total de horas este año", edit: "Cambiar", del: "Borrar", added: "Agregado.", saved: "Guardado.", deleted: "Borrado.", none: "Todavía no hay horas registradas para este año.", noCase: "(sin caso indicado)", sure: "¿Borrar esta entrada?", err: "No se pudo guardar.", hours: "horas" },
};
let data = { year: new Date().getFullYear(), years: [], entries: [], totals: { hours: "0.00" } }, editing = null, who = "";
const mk = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
const today = () => { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
const hrs = m => (m / 60).toFixed(2);
const msg = t => { $("hr-msg").textContent = t || ""; };

async function api(path, body) {
  const r = await fetch(path, body ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : undefined);
  let j; try { j = await r.json(); } catch { j = { ok: false, error: T[lang()].err }; }
  return j;
}
async function load(year) {
  const j = await api("/api/hours?year=" + encodeURIComponent(year || data.year));
  if (j.ok) data = j;
  paint();
}
function paintKinds() {
  const sel = $("hr-kind"), cur = sel.value, L = lang();
  sel.replaceChildren(...KINDS.map(k => { const o = mk("option", "", k[L]); o.value = k.id; return o; }));
  if (cur) sel.value = cur;
}
function paintYears() {
  const sel = $("hr-year"), y = new Date().getFullYear(), years = [...new Set([...data.years, y, data.year])].sort((a, b) => b - a);
  sel.replaceChildren(...years.map(v => { const o = mk("option", "", String(v)); o.value = String(v); return o; }));
  sel.value = String(data.year);
}
function paint() {
  const L = lang(), t = T[L];
  paintKinds(); paintYears();
  $("hr-total").textContent = t.total + ": " + data.totals.hours;
  const list = $("hr-list"); list.replaceChildren();
  if (!data.entries.length) list.append(mk("p", "small", t.none));
  for (const e of data.entries) {
    const kind = KINDS.find(k => k.id === e.kind), card = mk("div", "card2");
    card.dataset.id = e.id;
    card.append(mk("div", "big", hrs(e.minutes) + " " + t.hours), mk("div", "", e.date + " · " + (kind ? kind[L] : e.kind)), mk("div", "", e.caseRef || t.noCase));
    if (e.note) card.append(mk("div", "small", e.note));
    const row = mk("div", "row");
    const b1 = mk("button", "btn secondary small2", t.edit); b1.type = "button"; b1.onclick = () => startEdit(e);
    const b2 = mk("button", "btn secondary small2", t.del); b2.type = "button"; b2.onclick = async () => { if (!confirm(t.sure)) return; const j = await api("/api/hours", { action: "delete", id: e.id }); msg(j.ok ? t.deleted : j.error || t.err); await load(); };
    row.append(b1, b2); card.append(row); list.append(card);
  }
  $("hr-bar-text").textContent = BAR_NOTE[L];
}
function startEdit(e) {
  editing = e.id;
  $("hr-date").value = e.date; $("hr-hours").value = hrs(e.minutes); $("hr-kind").value = e.kind; $("hr-case").value = e.caseRef || ""; $("hr-note").value = e.note || "";
  $("hr-cancel").hidden = false; msg(lang() === "es" ? "Cambiando esta entrada. Guarde con el botón de abajo." : "Changing this entry. Save with the button below.");
  window.scrollTo({ top: 0, behavior: "smooth" }); $("hr-hours").focus();
}
function resetForm() {
  editing = null; $("hr-cancel").hidden = true;
  $("hr-hours").value = ""; $("hr-note").value = ""; $("hr-date").value = today();
}

$("hr-form").addEventListener("submit", async ev => {
  ev.preventDefault();
  const body = { action: editing ? "edit" : "add", id: editing, date: $("hr-date").value, hours: $("hr-hours").value, kind: $("hr-kind").value, caseRef: $("hr-case").value, note: $("hr-note").value };
  const j = await api("/api/hours", body), t = T[lang()];
  if (!j.ok) { msg(j.error || t.err); return; }
  msg(editing ? t.saved : t.added); resetForm();
  await load(String(body.date).slice(0, 4));
});
$("hr-cancel").addEventListener("click", () => { resetForm(); msg(""); });
$("hr-year").addEventListener("change", e => load(e.target.value));

function saveFile(text, name, type) {
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.style.display = "none";
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 10000);
}
$("hr-csv").addEventListener("click", () => saveFile(toCsv(data.entries, { year: data.year, lang: lang() }), "pro-bono-hours-" + data.year + ".csv", "text/csv;charset=utf-8"));
$("hr-print").addEventListener("click", () => {
  const w = window.open("", "_blank"); // opened inside the click so pop-up blockers allow it
  if (!w) { msg(lang() === "es" ? "Permita ventanas emergentes para abrir el informe." : "Allow pop-ups for this site to open the report."); return; }
  w.document.open(); w.document.write(reportHtml(data.entries, { year: data.year, who, lang: lang() })); w.document.close();
});
new MutationObserver(() => paint()).observe(document.documentElement, { attributes: true, attributeFilter: ["data-lang"] });

$("hr-date").value = today(); $("hr-date").max = today();
fetch("/api/auth/status", { credentials: "same-origin" }).then(r => r.json()).then(s => { who = (s && s.email) || ""; }).catch(() => { });
paintKinds();
load(new Date().getFullYear());
