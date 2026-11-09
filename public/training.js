// SPDX-License-Identifier: AGPL-3.0-only
// The page for the volunteer training (public/training.html). The text and the questions come from /api/training, which
// sends no answers. The quiz is scored on the server, and passing is recorded on the person's login there.
// DRAFT FOR COUNSEL REVIEW (see public/training.mjs).
const $ = id => document.getElementById(id);
const lang = () => (document.documentElement.getAttribute("data-lang") === "es" ? "es" : "en");
const S = {
  en: { all: "Answer every question first.", sending: "Checking…", passed: "You passed with {n} of {t}. You can open cases now.", failed: "Not yet: {n} of {t} right. The questions you missed are marked, with the right answer. You can try again.", failedCrit: "Not yet: {n} of {t} right, and a question about the line between organizing and advising was missed. The questions you missed are marked. You can try again.",
        submit: "Check my answers", cases: "Go to my cases", right: "The right answer:", already: "You passed this training on {d} (version {v}).", admin: "Administrators are not asked to take this training.", off: "This deployment does not ask helpers to take this training.", partOf: "Question", of: "of", err: "Could not check the answers. Try again." },
  es: { all: "Primero responda todas las preguntas.", sending: "Revisando…", passed: "Aprobó con {n} de {t}. Ya puede abrir casos.", failed: "Todavía no: {n} de {t} correctas. Las preguntas que falló están marcadas, con la respuesta correcta. Puede intentarlo de nuevo.", failedCrit: "Todavía no: {n} de {t} correctas, y falló una pregunta sobre la línea entre organizar y aconsejar. Las preguntas que falló están marcadas. Puede intentarlo de nuevo.",
        submit: "Revisar mis respuestas", cases: "Ir a mis casos", right: "La respuesta correcta:", already: "Usted aprobó esta capacitación el {d} (versión {v}).", admin: "A los administradores no se les pide tomar esta capacitación.", off: "Esta instalación no les pide a los ayudantes tomar esta capacitación.", partOf: "Pregunta", of: "de", err: "No se pudieron revisar las respuestas. Intente de nuevo." },
};
let data = null, chosen = {}, wrong = {};
const mk = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
const fill = (t, o) => t.replace(/\{(\w+)\}/g, (m, k) => o[k]);

async function load() {
  try { data = await (await fetch("/api/training")).json(); } catch { data = null; }
  if (!data || !data.ok) { $("tr-msg").textContent = (data && data.error) || S[lang()].err; return; }
  paint();
}
function paint() {
  if (!data) return;
  const L = lang(), t = S[L];
  // status
  const st = $("tr-status");
  if (data.status && data.status.trained) { st.hidden = false; st.className = "result ok"; st.textContent = fill(t.already, { d: String(data.status.at).slice(0, 10), v: data.status.version }); }
  else if (data.role === "admin") { st.hidden = false; st.className = "result"; st.textContent = t.admin; }
  else if (!data.required) { st.hidden = false; st.className = "result"; st.textContent = t.off; }
  else st.hidden = true;
  // the three parts
  const mods = $("tr-modules"); mods.replaceChildren();
  for (const m of data.modules) { const sec = mk("section", "mod"); sec.append(mk("h2", "", m.title[L])); for (const p of m.paras[L]) sec.append(mk("p", "", p)); mods.append(sec); }
  // the quiz
  const form = $("tr-form"); form.replaceChildren();
  data.questions.forEach((q, i) => {
    const fs = mk("fieldset", "q" + (wrong[q.id] ? " wrong" : "")); fs.dataset.id = q.id;
    fs.append(mk("legend", "", t.partOf + " " + (i + 1) + " " + t.of + " " + data.questions.length + ": " + q.q[L]));
    q.options.forEach((o, k) => {
      const lab = mk("label"), inp = mk("input"); inp.type = "radio"; inp.name = q.id; inp.value = String(k); inp.checked = chosen[q.id] === k;
      inp.addEventListener("change", () => { chosen[q.id] = k; if (wrong[q.id]) { delete wrong[q.id]; fs.classList.remove("wrong"); const w = fs.querySelector(".why"); if (w) w.remove(); } });
      lab.append(inp, mk("span", "", o[L])); fs.append(lab);
    });
    const w = wrong[q.id]; if (w) { const why = mk("p", "why"); why.append(mk("b", "", t.right + " "), document.createTextNode(q.options[w.correct][L] + ". " + w.why[L])); fs.append(why); }
    form.append(fs);
  });
  const row = mk("div", "row"), btn = mk("button", "btn", t.submit); btn.type = "submit"; row.append(btn); form.append(row);
}
$("tr-form").addEventListener("submit", async ev => {
  ev.preventDefault();
  const L = lang(), t = S[L], msg = $("tr-msg");
  if (!data.questions.every(q => Number.isInteger(chosen[q.id]))) { msg.textContent = t.all; const first = data.questions.find(q => !Number.isInteger(chosen[q.id])); const f = document.querySelector('fieldset[data-id="' + first.id + '"] input'); if (f) f.focus(); return; }
  msg.textContent = t.sending;
  let r; try { r = await (await fetch("/api/training", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ answers: chosen }) })).json(); } catch { r = null; }
  if (!r || !r.ok) { msg.textContent = (r && r.error) || t.err; return; }
  wrong = {}; for (const w of r.wrong) wrong[w.id] = w;
  if (r.passed) { msg.textContent = ""; await load(); const st = $("tr-status"); st.hidden = false; st.className = "result ok"; st.textContent = fill(t.passed, { n: r.score, t: r.total }); const a = mk("a", "btn", t.cases); a.href = "/app"; st.append(document.createElement("br"), a); st.scrollIntoView(); }
  else { msg.textContent = fill(r.criticalWrong ? t.failedCrit : t.failed, { n: r.score, t: r.total }); paint(); const bad = document.querySelector("fieldset.wrong"); if (bad) bad.scrollIntoView(); }
});
new MutationObserver(() => paint()).observe(document.documentElement, { attributes: true, attributeFilter: ["data-lang"] });
load();
