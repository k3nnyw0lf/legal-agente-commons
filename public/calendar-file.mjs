// SPDX-License-Identifier: AGPL-3.0-only
// "Add to my calendar": builds a calendar file (.ics) for dates a person has checked against their paper.
// The file is made on the phone and saved on the phone (see calendar-save.mjs). Nothing is sent: there is no
// invitation, no attendee, no email or audio alarm and no web address in the file, and this code makes no network
// calls. The person's own phone does the reminding. Each event says that the court's paper is what counts.
//
// DRAFT: the English and Spanish texts are for a Florida lawyer and a Spanish speaker to review.

export const CAL = {
  en: {
    summary: "Date on my paper",
    eventNote: "A computer read this date from a paper and the person checked it against the paper. The court's paper is what counts, not this calendar entry.",
    note: "This saves a calendar file on your phone. Your own phone does the reminding. Nothing is sent: no texts and no emails. The court's paper is what counts, not this calendar.",
    button: "Add to my calendar",
    buttonAll: "Add all checked dates to my calendar (one file)",
    needCheck: "A date is added only after it is checked against the paper.",
    saved: "Saved a calendar file on this phone.",
    file1: "date", fileMany: "dates-from-my-papers",
  },
  es: {
    summary: "Fecha en mi papel",
    eventNote: "Una computadora leyó esta fecha de un papel y la persona la revisó con el papel. Lo que cuenta es el papel del tribunal, no esta anotación del calendario.",
    note: "Esto guarda un archivo de calendario en su teléfono. Su propio teléfono hace el recordatorio. No se envía nada: ni mensajes de texto ni correos. Lo que cuenta es el papel del tribunal, no este calendario.",
    button: "Agregar a mi calendario",
    buttonAll: "Agregar todas las fechas revisadas a mi calendario (un archivo)",
    needCheck: "Una fecha se agrega solo después de revisarla con el papel.",
    saved: "Se guardó un archivo de calendario en este teléfono.",
    file1: "fecha", fileMany: "fechas-de-mis-papeles",
  },
};

const pad = n => String(n).padStart(2, "0");
function validIso(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ""));
  if (!m) return null;
  const y = +m[1], mo = +m[2], d = +m[3];
  if (y < 1950 || y > 2100) return null;
  const t = new Date(Date.UTC(y, mo - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === mo - 1 && t.getUTCDate() === d ? t : null;
}
const ymd = t => t.getUTCFullYear() + pad(t.getUTCMonth() + 1) + pad(t.getUTCDate());
const esc = s => String(s == null ? "" : s).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
function hash(s) { let h = 5381; for (const c of String(s)) h = ((h * 33) ^ c.codePointAt(0)) >>> 0; return h.toString(36); }

// Lines are folded at 75 bytes (RFC 5545), never in the middle of a character.
function fold(line) {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const out = []; let cur = "", n = 0, limit = 75;
  for (const ch of line) {
    const b = enc.encode(ch).length;
    if (n + b > limit) { out.push(cur); cur = " " + ch; n = 1 + b; limit = 75; } else { cur += ch; n += b; }
  }
  out.push(cur);
  return out.join("\r\n");
}

// events: [{ iso: "2026-04-13", where?: "Doc 1, page 1", quote?: "the line the date was read from" }]
// opts:   { lang: "en" | "es", now: Date (for tests), alarms: false to leave reminders out }
// Returns the file as text, or null when there is no valid date.
export function buildIcs(events, { lang = "en", now = new Date(), alarms = true } = {}) {
  const T = CAL[lang === "es" ? "es" : "en"];
  const stamp = now.toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
  const out = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Legal Agente Commons//Dates from my papers//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH"];
  let n = 0;
  for (const ev of events || []) {
    const day = validIso(ev && ev.iso); if (!day) continue;
    n++;
    const next = new Date(day.getTime() + 864e5);
    const summary = T.summary + (ev.where ? ": " + ev.where : "");
    const desc = T.eventNote + (ev.quote ? "\n" + T.summary + ": " + ev.quote : "");
    out.push("BEGIN:VEVENT", "UID:la-" + ev.iso + "-" + hash(summary + "|" + (ev.quote || "")) + "@legal-agente.invalid", "DTSTAMP:" + stamp,
      "DTSTART;VALUE=DATE:" + ymd(day), "DTEND;VALUE=DATE:" + ymd(next), "SUMMARY:" + esc(summary), "DESCRIPTION:" + esc(desc), "TRANSP:TRANSPARENT");
    if (alarms) for (const t of ["-P3D", "-P1D"]) out.push("BEGIN:VALARM", "TRIGGER:" + t, "ACTION:DISPLAY", "DESCRIPTION:" + esc(summary), "END:VALARM");
    out.push("END:VEVENT");
  }
  if (!n) return null;
  out.push("END:VCALENDAR");
  return out.map(fold).join("\r\n") + "\r\n";
}

export function icsName(events, lang = "en") {
  const T = CAL[lang === "es" ? "es" : "en"], ok = (events || []).filter(e => validIso(e && e.iso));
  return (ok.length === 1 ? T.file1 + "-" + ok[0].iso : T.fileMany) + ".ics";
}
