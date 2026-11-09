// SPDX-License-Identifier: AGPL-3.0-only
// The public impact page (public/impact.html). The numbers come from /api/impact, which has already applied the rules:
// fewer than 10 cases in all means no number at all, and any count under 10 comes back hidden. This page only shows it.
import { CASE_TYPES } from "/impact.mjs";

const lang = () => (document.documentElement.getAttribute("data-lang") === "es" ? "es" : "en");
const S = {
  en: { wait: "Not enough cases yet. When the program has at least 10, the numbers show here.", few: "fewer than 10", total: "Total cases", noTotal: "The total is not shown while any count is under 10.", byType: "By kind of case", byCounty: "By county", kind: "Kind of case", county: "County", cases: "Cases", updated: "Updated", err: "The numbers could not be loaded.", countySuffix: " County" },
  es: { wait: "Todavía no hay suficientes casos. Cuando el programa tenga al menos 10, los números aparecerán aquí.", few: "menos de 10", total: "Total de casos", noTotal: "El total no se muestra mientras algún número sea menor de 10.", byType: "Por tipo de caso", byCounty: "Por condado", kind: "Tipo de caso", county: "Condado", cases: "Casos", updated: "Actualizado", err: "No se pudieron cargar los números.", countySuffix: "" },
};
let data = null;
const mk = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };

function table(caption, head, rows, t) {
  const tb = mk("table", "nums"); tb.append(mk("caption", "", caption));
  const hd = mk("thead"), tr = mk("tr"); tr.append(mk("th", "", head), mk("th", "n", t.cases)); hd.append(tr); tb.append(hd);
  const body = mk("tbody");
  for (const r of rows) { const row = mk("tr"); row.append(mk("td", "", r.label), mk("td", "n", r.hidden ? t.few : String(r.count))); body.append(row); }
  tb.append(body); return tb;
}
function paint() {
  const L = lang(), t = S[L], box = document.getElementById("im-body"); box.replaceChildren();
  if (!data) { box.append(mk("p", "small", t.err)); return; }
  if (!data.enough) box.append(mk("p", "wait", t.wait));
  else {
    if (data.total != null) box.append(mk("p", "tot", t.total + ": " + data.total)); else box.append(mk("p", "small", t.noTotal));
    box.append(table(t.byType, t.kind, data.byType.map(r => ({ ...r, label: (CASE_TYPES.find(x => x.id === r.id) || { [L]: r.id })[L] })), t));
    box.append(table(t.byCounty, t.county, data.byCounty.map(r => ({ ...r, label: r.county + t.countySuffix })), t));
  }
  document.getElementById("im-updated").textContent = data.updated ? t.updated + ": " + data.updated : "";
}
new MutationObserver(paint).observe(document.documentElement, { attributes: true, attributeFilter: ["data-lang"] });
fetch("/api/impact").then(r => r.json()).then(j => { data = j && j.ok ? j : null; paint(); }).catch(() => { data = null; paint(); });
