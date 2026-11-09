// SPDX-License-Identifier: AGPL-3.0-only
// Rules for Ask AI that are enforced in code, not only asked of the model in the prompt:
//  - an answer may cite only the page excerpts it was actually given ([n] outside that range is removed);
//  - an answer that cites no page is marked "not grounded", so the screen can warn the reader;
//  - a question that asks for advice ("should I...", "¿debo...") always gets a fixed notice that a lawyer
//    must answer it, in the language of the question. The AI still finds the facts a lawyer will need.
// The AI organizes and finds. It never gives legal advice.

const ADVICE_EN = [
  /\bshould (?:i|we|she|he|they|my client)\b/i,
  /\b(?:do|does) (?:i|we|she|he|they) (?:have|need) to\b/i,
  /\bmust (?:i|we)\b/i,
  /\b(?:will|would|can|could) (?:i|we|she|he|they) (?:win|lose)\b/i,
  /\bwhat (?:should|do|can) (?:i|we) do\b/i,
  /\bwhat are (?:my|our|her|his|their) (?:chances|options|rights)\b/i,
  /\bis (?:it|this|that) legal\b/i,
  /\bcan (?:i|we) sue\b/i,
  /\bdo (?:i|we) need a lawyer\b/i,
  /\bam i liable\b/i,
  /\bdo (?:i|we) (?:really )?owe\b/i,
  /\b(?:any|your) (?:legal )?advice\b/i,
];
const ADVICE_ES = [
  /(?:^|[\s¿¡])deb(?:o|emos|er[ií]a|er[ií]amos)\b/i,
  /\btengo que\b|\btenemos que\b/i,
  /\b(?:voy|vamos) a (?:ganar|perder)\b/i,
  /\b(?:puedo|podemos) (?:ganar|demandar)\b/i,
  /\bqu[eé] (?:debo|debemos|hago|hacemos|tengo que|puedo) (?:hacer)?/i,
  /\bes legal\b/i,
  /\bcu[aá]les son mis (?:derechos|opciones|posibilidades)\b/i,
  /\bnecesito (?:un )?abogad[oa]\b/i,
  /\bconsejo legal\b|\basesor[ií]a legal\b/i,
];

const ES_HINT = /[¿¡ñáéíóú]|\b(?:qu[eé]|c[oó]mo|cu[aá]ndo|d[oó]nde|por qu[eé]|debo|puedo|tengo|carta|deuda|abogad[oa]|corte|demanda|pago|fecha|el|los|las|una|mi|mis|del|para|esta|este)\b/gi;
const EN_HINT = /\b(?:what|how|when|where|why|should|can|do|does|did|the|my|is|are|was|letter|debt|lawyer|court|pay|date|a|an|of|to|for)\b/gi;

export function isSpanish(q) {
  const s = String(q || "");
  const es = (s.match(ES_HINT) || []).length, en = (s.match(EN_HINT) || []).length;
  return es > en;
}

export function adviceAsked(q) {
  const s = String(q || "");
  return ADVICE_EN.some(r => r.test(s)) || ADVICE_ES.some(r => r.test(s));
}

export const ADVICE_NOTICE = {
  en: "This sounds like a question for a lawyer. The AI only finds facts in the papers; it can't tell you what to do. Share this question with the volunteer lawyer on your case.",
  es: "Esta pregunta es para un abogado. La IA solo busca datos en sus papeles; no puede decirle qué hacer. Comparta esta pregunta con el abogado voluntario de su caso.",
};

// ---- Approved-sources rules for the letter check ("¿Qué es esta carta?") ----
// The letter check answers only from lists a person wrote and checked: kinds of paper, and places that can help.
// These rules keep it honest, in code:
//  - a place is shown only if its id is on the approved list;
//  - a kind of paper is named only with enough evidence on the page, and a close call is "I don't know".
export const DONT_KNOW = {
  en: "I don't know what kind of paper this is.",
  es: "No sé qué tipo de papel es este.",
};

// Keeps the items whose id is on the approved list. Anything else is dropped, however it got there.
export function onlyApproved(items, approved) {
  const ok = approved instanceof Set ? approved : new Set(approved || []);
  const kept = [], dropped = [];
  for (const it of items || []) {
    if (it && ok.has(it.id)) kept.push(it); else dropped.push(it && it.id != null ? it.id : String(it));
  }
  return { kept, dropped };
}

// scores: [{ id, score }]. Returns the winner's id only with enough evidence (min) and a clear lead (margin);
// otherwise null, which the screen shows as "I don't know".
export function pickKind(scores, { min = 3, margin = 2 } = {}) {
  const s = (scores || []).filter(x => x && x.score > 0).sort((a, b) => b.score - a.score);
  if (!s.length || s[0].score < min) return null;
  if (s[1] && s[0].score - s[1].score < margin) return null;
  return s[0].id;
}

// Keeps [n] only when 1 <= n <= nExcerpts. Returns the cleaned text, the numbers cited, and whether any page was cited.
export function checkCites(answer, nExcerpts) {
  const max = Math.max(0, Number(nExcerpts) || 0);
  const cited = new Set(), removed = [];
  const text = String(answer || "")
    .replace(/\[(\d{1,3})\]/g, (m, n) => {
      const k = Number(n);
      if (k >= 1 && k <= max) { cited.add(k); return m; }
      removed.push(k); return "";
    })
    .replace(/[ \t]+([.,;:!?])/g, "$1")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
  return { text, cited: [...cited].sort((a, b) => a - b), removed, grounded: cited.size > 0 };
}
