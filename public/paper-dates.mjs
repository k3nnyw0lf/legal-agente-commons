// SPDX-License-Identifier: AGPL-3.0-only
// Dates found in the papers: reads the page text of a case and lists every date written on a page,
// each linked back to that file and page, so a person or a volunteer can build the timeline from the papers.
// No AI and no guessing: only dates written out in full (day, month and year). Nothing is calculated here,
// and no deadline is worked out: a lawyer confirms what any date means.
//
// Formats: "March 9, 2026", "MAR 10 2026", "9 Mar 2026", "9 March 2026", "9 de marzo de 2026",
// US numbers "3/9/2026" (month/day/year) and ISO "2026-03-09". Years 1950-2100 only; impossible dates are dropped.

export const PAPER_DATES_PHASE = "Dates found in the papers (check each one)";

const EN = { jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4, may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12 };
const ES = { enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12 };
const EN_RE = "january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sept|sep|oct|nov|dec";
const ES_RE = Object.keys(ES).join("|");
const SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const PATTERNS = [
  // March 9, 2026 · MAR 10 2026 · Sept. 3rd, 2025
  { re: new RegExp("\\b(" + EN_RE + ")\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(\\d{4})\\b", "gi"), ymd: m => [m[3], EN[m[1].toLowerCase()], m[2]] },
  // 9 Mar 2026 · 9 March, 2026 · 9th of March 2026
  { re: new RegExp("\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?(" + EN_RE + ")\\.?,?\\s+(\\d{4})\\b", "gi"), ymd: m => [m[3], EN[m[2].toLowerCase()], m[1]] },
  // 9 de marzo de 2026 · 9 de marzo del 2026
  { re: new RegExp("\\b(\\d{1,2})\\s+de\\s+(" + ES_RE + ")\\s+(?:de|del)\\s+(\\d{4})\\b", "gi"), ymd: m => [m[3], ES[m[2].toLowerCase()], m[1]] },
  // 3/9/2026 (Florida papers: month/day/year)
  { re: /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g, ymd: m => [m[3], m[1], m[2]] },
  // 2026-03-09
  { re: /\b(\d{4})-(\d{2})-(\d{2})\b/g, ymd: m => [m[1], m[2], m[3]] },
];

function validIso(y, m, d) {
  y = Number(y); m = Number(m); d = Number(d);
  if (!(y >= 1950 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31)) return "";
  const t = new Date(Date.UTC(y, m - 1, d));
  if (t.getUTCFullYear() !== y || t.getUTCMonth() !== m - 1 || t.getUTCDate() !== d) return "";
  return y + "-" + String(m).padStart(2, "0") + "-" + String(d).padStart(2, "0");
}

export function dateLabel(iso) {
  const [y, m, d] = String(iso).split("-").map(Number);
  return d + " " + SHORT[m - 1] + " " + y;
}

// Every full date in a piece of text, in reading order, without overlaps.
export function findDates(text) {
  const s = String(text || ""), out = [];
  for (const p of PATTERNS) {
    p.re.lastIndex = 0;
    for (const m of s.matchAll(p.re)) {
      const iso = validIso(...p.ymd(m));
      if (!iso) continue;
      const a = m.index, b = m.index + m[0].length;
      if (out.some(x => a < x.end && b > x.index)) continue;
      out.push({ iso, raw: m[0], index: a, end: b });
    }
  }
  return out.sort((x, y) => x.index - y.index);
}

function lineAt(text, i) {
  const a = text.lastIndexOf("\n", i) + 1, bb = text.indexOf("\n", i);
  return text.slice(a, bb < 0 ? text.length : bb);
}

function snippet(line, raw) {
  const clean = line.replace(/\.{3,}/g, " ").replace(/\s+/g, " ").trim();
  const letters = (clean.replace(raw, "").match(/[A-Za-zÀ-ÿ]/g) || []).length;
  if (letters < 8) return "Date written on this page.";
  return clean.length > 180 ? clean.slice(0, 177).trimEnd() + "…" : clean;
}

// The file a timeline link points to: "/cf/case/01-letter.pdf#page=2" -> "01-letter.pdf".
function fileOf(u, cf) {
  let h = String(u || "").split("#")[0].split("?")[0];
  if (cf && h.startsWith(cf)) h = h.slice(cf.length);
  return h;
}

// Timeline events for the dates in a case's page text.
//   files:  [{ n: name, h: file id }]       chunks: [{ f: file index, p: page, t: text }]
//   cf:     the case's file folder, for links    timeline: the case's own timeline (dates already there
//           for the same file are skipped)       max: most events to return
export function paperDates(files, chunks, { cf = "", timeline = [], max = 150 } = {}) {
  const have = new Set();
  for (const ph of timeline || []) for (const ev of (ph && ph.events) || []) {
    if (!ev || !ev.u || ev.auto) continue;
    const d = findDates(ev.d)[0];
    if (d) have.add(d.iso + "|" + fileOf(ev.u, cf));
  }
  const seen = new Set(), out = [];
  (chunks || []).forEach((ch, order) => {
    const f = files && files[ch.f];
    if (!f || !f.h || !ch.t) return;
    const page = Number(ch.p) || 1;
    for (const d of findDates(ch.t)) {
      if (have.has(d.iso + "|" + f.h)) continue;
      const key = d.iso + "|" + f.h + "|" + page;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        d: dateLabel(d.iso),
        t: snippet(lineAt(ch.t, d.index), d.raw),
        s: (f.n || f.h) + ", page " + page + " · found by the computer, check it",
        u: cf + f.h + (/\.pdf$/i.test(f.h) ? "#page=" + page : ""),
        auto: 1,
        iso: d.iso,
        order,
      });
    }
  });
  out.sort((a, b) => (a.iso < b.iso ? -1 : a.iso > b.iso ? 1 : a.order - b.order));
  return out.slice(0, Math.max(0, max)).map(({ order, ...ev }) => ev);
}
