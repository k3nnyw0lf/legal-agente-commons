// SPDX-License-Identifier: AGPL-3.0-only
// "¿Qué es esta carta?" (What is this letter?)
// Takes what the photo reader (OCR) found on a photo of a letter and says three things, and only three:
//   1. what kind of paper it is, chosen from a short list a person wrote, only with evidence on the page;
//   2. which full dates are written on it, each tied to the line (and the spot on the photo) it came from;
//   3. who can help, chosen from an approved list of official places.
// It never says what to do. There is no AI model and no free text here: every sentence the helper says in its own
// voice is a fixed text in this file, in English and Spanish, and the answer has a fixed shape with no field for
// advice. Words from the paper are returned separately as quotes. When it is not sure it says "I don't know".
// The photo and its words never leave the phone: this file runs in the browser (and in the tests, in Node).
//
// DRAFT: the wording of the kinds, the helper list and the Spanish are for a Florida lawyer and a Spanish speaker
// to review before this is used with real people.
import { findDates } from "./paper-dates.mjs";
import { DONT_KNOW, onlyApproved, pickKind, isSpanish } from "./grounding.mjs";

// ---------- the approved list of places that can help ----------
// Only official or well-known public-service sites. Every address here must be on APPROVED_HOSTS below.
export const HELPERS = {
  floridalawhelp: { url: "https://www.floridalawhelp.org/", name: { en: "FloridaLawHelp.org", es: "FloridaLawHelp.org" },
    what: { en: "Free legal information and links to free legal aid in Florida.", es: "Información legal gratis y enlaces a ayuda legal gratis en Florida." } },
  floridabar: { url: "https://www.floridabar.org/", name: { en: "The Florida Bar: lawyer referral", es: "El Colegio de Abogados de Florida: referencia de abogados" },
    what: { en: "The Florida Bar's service that connects people with lawyers.", es: "El servicio del Colegio de Abogados de Florida que conecta a las personas con abogados." } },
  dial211: { url: "https://www.211.org/", name: { en: "211", es: "211" },
    what: { en: "A free helpline and website for local services such as housing, food and legal aid.", es: "Una línea de ayuda y un sitio web gratis para servicios locales como vivienda, comida y ayuda legal." } },
  flcourts: { url: "https://www.flcourts.gov/", name: { en: "Florida Courts", es: "Tribunales de Florida" },
    what: { en: "The Florida Courts website, with court forms and information for people without a lawyer.", es: "El sitio de los Tribunales de Florida, con formularios e información para personas sin abogado." } },
  cfpb: { url: "https://www.consumerfinance.gov/consumer-tools/debt-collection/", name: { en: "Consumer Financial Protection Bureau (federal)", es: "Oficina para la Protección Financiera del Consumidor (federal)" },
    what: { en: "Information about debt collection, and a way to send a complaint.", es: "Información sobre el cobro de deudas, y una forma de presentar una queja." } },
  ftc: { url: "https://consumer.ftc.gov/articles/debt-collection-faqs", name: { en: "Federal Trade Commission", es: "Comisión Federal de Comercio" },
    what: { en: "Answers to common questions about debt collection.", es: "Respuestas a preguntas comunes sobre el cobro de deudas." } },
  fl_ag: { url: "https://www.myfloridalegal.com/", name: { en: "Florida Attorney General", es: "Fiscal General de Florida" },
    what: { en: "The state office that takes consumer complaints.", es: "La oficina estatal que recibe quejas de consumidores." } },
  hud: { url: "https://www.hud.gov/findacounselor", name: { en: "HUD-approved housing counselors", es: "Consejeros de vivienda aprobados por HUD" },
    what: { en: "Housing counseling agencies, with help for renters and homeowners.", es: "Agencias de consejería de vivienda, con ayuda para inquilinos y propietarios." } },
  irs_litc: { url: "https://www.irs.gov/advocate/low-income-taxpayer-clinics", name: { en: "IRS Low Income Taxpayer Clinics", es: "Clínicas del IRS para Contribuyentes de Bajos Ingresos" },
    what: { en: "Free or low-cost help with tax problems for people who qualify.", es: "Ayuda gratis o de bajo costo con problemas de impuestos para quienes califican." } },
  irs_tas: { url: "https://www.taxpayeradvocate.irs.gov/", name: { en: "Taxpayer Advocate Service", es: "Servicio del Defensor del Contribuyente" },
    what: { en: "An independent office inside the IRS that helps with tax problems.", es: "Una oficina independiente dentro del IRS que ayuda con problemas de impuestos." } },
  immigrationlawhelp: { url: "https://www.immigrationlawhelp.org/", name: { en: "ImmigrationLawHelp.org", es: "ImmigrationLawHelp.org" },
    what: { en: "A directory of free and low-cost immigration legal services, by state.", es: "Un directorio de servicios legales de inmigración gratis y de bajo costo, por estado." } },
  dbpr: { url: "https://www2.myfloridalicense.com/condos-timeshares-mobile-homes/", name: { en: "Florida Division of Condominiums, Timeshares, and Mobile Homes", es: "División de Condominios, Tiempo Compartido y Casas Móviles de Florida" },
    what: { en: "The state division that handles some condominium and association questions.", es: "La división estatal que atiende algunas preguntas sobre condominios y asociaciones." } },
  fl_dfs: { url: "https://www.myfloridacfo.com/division/consumers", name: { en: "Florida Department of Financial Services: consumer helpline", es: "Departamento de Servicios Financieros de Florida: línea del consumidor" },
    what: { en: "The state helpline for insurance questions.", es: "La línea estatal de ayuda para preguntas de seguros." } },
};
// A new web address needs a person to add its host here on purpose (the tests check every address against this).
export const APPROVED_HOSTS = [
  "floridalawhelp.org", "floridabar.org", "211.org", "flcourts.gov", "consumerfinance.gov", "consumer.ftc.gov", "myfloridalegal.com",
  "hud.gov", "irs.gov", "taxpayeradvocate.irs.gov", "immigrationlawhelp.org", "www2.myfloridalicense.com", "myfloridacfo.com",
];
const GENERIC_HELP = ["floridalawhelp", "dial211", "floridabar"];

// ---------- the kinds of paper ----------
// rules: [weight, pattern]. Patterns run on the page text with accents and capitals removed, one match counts once.
// requires: patterns that must all be there, or the kind scores nothing. A kind is named only with enough evidence
// and a clear lead over the next one (see pickKind in grounding.mjs).
const K = (id, nameEn, nameEs, whatEn, whatEs, helpers, rules, requires) => ({ id, name: { en: nameEn, es: nameEs }, what: { en: whatEn, es: whatEs }, helpers, rules, requires });
export const KINDS = [
  K("summons", "Summons", "Citatorio (summons)",
    "A court paper that says a lawsuit has been filed. It names the court, the people on each side and a case number.",
    "Un papel del tribunal que dice que se presentó una demanda. Nombra el tribunal, a las personas de cada lado y un número de caso.",
    ["floridalawhelp", "floridabar", "flcourts"],
    [[3, /^\s*(?:amended )?summons\b/m], [1, /\bsummons\b/], [3, /\bcitatorio\b/], [1, /you are (?:hereby )?(?:commanded|summoned)/], [2, /written defenses?|serve [^.\n]{0,40}defenses/], [1, /plaintiff'?s attorney/]]),
  K("complaint", "Complaint (the paper that starts a lawsuit)", "Demanda (el papel que inicia un juicio)",
    "The paper that starts a lawsuit. It lists what the person suing says happened and what they ask the court for.",
    "El papel que inicia un juicio. Dice lo que la persona que demanda afirma que pasó y lo que le pide al tribunal.",
    ["floridalawhelp", "floridabar", "flcourts"],
    [[3, /^\s*(?:amended |verified )?complaint\b/m], [3, /^\s*demanda\b/m], [2, /\bwherefore\b/], [2, /plaintiff sues/], [1, /^\s*count [ivx0-9]+\b/m], [1, /\balleges?\b/]]),
  K("debt_collection", "Letter from a debt collector", "Carta de un cobrador de deudas",
    "A letter from a company that says it is collecting a debt. These letters usually list an amount, the company's name and a date for disagreeing in writing.",
    "Una carta de una empresa que dice que está cobrando una deuda. Estas cartas suelen indicar un monto, el nombre de la empresa y una fecha para expresar desacuerdo por escrito.",
    ["cfpb", "ftc", "floridalawhelp", "fl_ag"],
    [[4, /debt collector|cobradora? de deudas/], [3, /attempt to collect a debt|intento de cobrar una deuda/], [2, /dispute the debt|disput(?:a|ar|e) la deuda/], [2, /itemization date|validation (?:notice|period)|fecha de itemizacion/], [1, /total amount of the debt|monto total de la deuda/]]),
  K("landlord_notice", "Landlord's notice about rent or the lease", "Aviso del arrendador sobre la renta o el contrato",
    "A paper from a landlord about unpaid rent or about ending a lease. It is not a court order.",
    "Un papel del arrendador sobre renta sin pagar o sobre el fin de un contrato. No es una orden del tribunal.",
    ["floridalawhelp", "dial211", "hud"],
    [[3, /\b(?:3|three|5|five|7|seven|15|fifteen|30|thirty)[- ]days?[- ]notice\b|aviso de (?:3|5|7|15|30) dias/], [3, /notice to (?:pay rent|terminate|quit|vacate)|deliver possession|pay rent or|terminar el arrendamiento|terminacion del (?:contrato|arrendamiento)|terminado el contrato/], [1, /\blandlord\b|\barrendador/], [1, /\brent\b|\balquiler\b|\brenta\b/], [1, /\btenant\b|contrato de alquiler|\binquilino/]]),
  K("eviction_summons", "Eviction summons (court paper)", "Citatorio de desalojo (papel del tribunal)",
    "A court paper that says an eviction case has been filed against a tenant.",
    "Un papel del tribunal que dice que se presentó un caso de desalojo contra un inquilino.",
    ["floridalawhelp", "dial211", "floridabar"],
    [[3, /^\s*summons\b/m], [3, /evict|desalojo/], [2, /residential (?:eviction|tenancy)|desahucio/], [1, /\bpremises\b/], [1, /you are (?:hereby )?commanded/]],
    [/summons|citatorio/, /evict|desalojo/]),
  K("writ_possession", "Writ of possession (court paper)", "Orden de posesión (papel del tribunal)",
    "A court paper that the sheriff carries out. It follows a court decision in an eviction case.",
    "Un papel del tribunal que ejecuta el alguacil. Sigue a una decisión del tribunal en un caso de desalojo.",
    ["floridalawhelp", "dial211", "floridabar"],
    [[5, /writ of possession|auto de posesion|orden de posesion/], [1, /\bsheriff\b|\balguacil/], [1, /possession of the premises/]]),
  K("hearing_notice", "Notice of hearing", "Aviso de audiencia",
    "A court paper that gives the date, time and place of a hearing, which is a meeting with the judge.",
    "Un papel del tribunal que da la fecha, la hora y el lugar de una audiencia, que es una reunión con el juez.",
    ["floridalawhelp", "flcourts", "floridabar"],
    [[4, /^\s*(?:notice of (?:hearing|trial|case management conference)|aviso de (?:audiencia|juicio))/m], [2, /(?:set|scheduled) for (?:a )?(?:hearing|trial)|hearing (?:has been )?(?:set|scheduled)|audiencia[^.\n]{0,80}(?:fijada|programada)/], [1, /\bcourtroom\b|\bsala \d|\bhonorable\b/]]),
  K("court_order", "Court order or judgment", "Orden o sentencia del tribunal",
    "A paper signed by a judge that decides something or orders something in a case.",
    "Un papel firmado por un juez que decide u ordena algo en un caso.",
    ["floridalawhelp", "floridabar", "flcourts"],
    [[4, /^\s*(?:(?:final|default|amended|summary) judgment|order (?:on|granting|denying)|sentencia)\b/m], [3, /it is (?:hereby )?ordered|ordered and adjudged|done and ordered|se ordena|se dicta sentencia/]]),
  K("subpoena", "Subpoena", "Citación (subpoena)",
    "A paper from a court or a lawyer about coming to answer questions, or handing over papers, in a case.",
    "Un papel de un tribunal o de un abogado sobre presentarse a responder preguntas, o entregar documentos, en un caso.",
    ["floridalawhelp", "floridabar"],
    [[4, /\bsubpoena\b/], [2, /duces tecum/], [1, /(?:commanded|required) to (?:appear|attend)|testify/]]),
  K("foreclosure", "Foreclosure or mortgage default paper", "Papel de ejecución hipotecaria o de atraso en la hipoteca",
    "A paper about a home loan that is behind on payments, or about a lender starting a court case to take a home.",
    "Un papel sobre un préstamo de vivienda con pagos atrasados, o sobre un prestamista que inicia un caso en el tribunal para quedarse con una vivienda.",
    ["hud", "floridalawhelp", "dial211", "floridabar"],
    [[4, /foreclos|ejecucion hipotecaria|\blis pendens\b/], [3, /notice of (?:default|intent to accelerate|acceleration)/], [1, /\bmortgage\b|\bhipoteca/], [1, /\baccelerat/]]),
  K("benefits_notice", "Benefits notice (such as SNAP or Medicaid)", "Aviso de beneficios (como SNAP o Medicaid)",
    "A notice from a government office about a benefit. It says what the office decided, and it often lists a date and a way to ask for a review.",
    "Un aviso de una oficina del gobierno sobre un beneficio. Dice lo que la oficina decidió, y con frecuencia indica una fecha y una forma de pedir una revisión.",
    ["floridalawhelp", "dial211"],
    [[3, /department of children and families|\bdcf\b|departamento de ninos y familias|\bmedicaid\b|\bsnap\b|food assistance|reemployment assistance|social security administration|temporary cash assistance/], [3, /notice of (?:case action|action|denial|termination|decision|adverse action)|aviso de (?:accion|negacion|terminacion|decision)/], [2, /fair hearing|audiencia justa/], [1, /\bbenefits?\b|\bbeneficios?\b/]]),
  K("irs_notice", "IRS notice", "Aviso del IRS",
    "A letter from the Internal Revenue Service about a tax return or a tax bill. The notice number, like CP2000, is printed near the top.",
    "Una carta del Servicio de Impuestos Internos (IRS) sobre una declaración de impuestos o una factura de impuestos. El número del aviso, como CP2000, está impreso cerca de la parte de arriba.",
    ["irs_litc", "irs_tas"],
    [[3, /internal revenue service|\birs\b|department of the treasury/], [3, /\bnotice (?:cp|lt)\s?\d{2,4}\b|\bcp\d{3,4}\b/], [1, /\btax (?:year|return)\b/]]),
  K("immigration", "Immigration paper", "Papel de inmigración",
    "A paper from an immigration agency or an immigration court. Some of these papers name a court date.",
    "Un papel de una agencia de inmigración o de un tribunal de inmigración. Algunos de estos papeles indican una fecha en el tribunal.",
    ["immigrationlawhelp", "floridalawhelp"],
    [[4, /notice to appear|aviso de comparecencia/], [3, /department of homeland security|\buscis\b|immigration judge|immigration and nationality act|removal proceedings/], [1, /\bfile number: a\d{6,9}|\ba-?number\b/]]),
  K("hoa_notice", "Notice from a homeowners or condo association", "Aviso de una asociación de propietarios o de condominio",
    "A letter from an association about fees or rules. Some say the association plans to record a lien, which is a legal claim on the property.",
    "Una carta de una asociación sobre cuotas o reglas. Algunas dicen que la asociación planea registrar un gravamen, que es un reclamo legal sobre la propiedad.",
    ["dbpr", "floridalawhelp"],
    [[3, /homeowners'? association|condominium association|association, inc\b|asociacion de (?:propietarios|condominio)/], [3, /claim of lien|intent to record a claim|notice of intent to lien|gravamen/], [1, /\bassessments?\b/]]),
  K("insurance_notice", "Insurance company notice", "Aviso de una compañía de seguros",
    "A letter from an insurance company about a policy. This helper only reads the dates; it does not help with claims.",
    "Una carta de una compañía de seguros sobre una póliza. Este ayudante solo lee las fechas; no ayuda con reclamos.",
    ["fl_dfs", "floridalawhelp"],
    [[2, /insurance company|insurance co\b|\binsurer\b|aseguradora|compania de seguros/], [3, /notice of (?:cancellation|non-?renewal)|aviso de (?:cancelacion|no renovacion)|will be cancel+ed/], [2, /\bpolicy (?:number|no\b)|numero de poliza|nonpayment of premium/]]),
  K("family_paper", "Family court paper", "Papel del tribunal de familia",
    "A court paper about a family matter, such as a divorce, child support or time with children.",
    "Un papel del tribunal sobre un asunto familiar, como un divorcio, la manutención de menores o el tiempo con los niños.",
    ["floridalawhelp", "flcourts", "floridabar"],
    [[4, /dissolution of marriage|\bdivorce\b|child support|time-?sharing|parenting plan|\bpaternity\b|disolucion de matrimonio|manutencion de menores|\bdivorcio\b/], [3, /in re: the marriage of/], [1, /family division|\bpetitioner\b|\brespondent\b/]]),
];

// ---------- the helper's own words (fixed texts, both languages) ----------
// Nothing here tells anyone what to do, and the tests check every line, in both languages.
export const UI = {
  en: {
    notes: {
      lookslike: "This looks like:",
      why: "I chose this because the page has these words:",
      newPhoto: "This photo is too blurry or too small to read safely. A new photo is needed: the whole page in the picture, good light, the phone held steady.",
      noText: "I found no words in this photo, so I cannot say what kind of paper it is. A new photo is needed.",
      datesCheck: "A computer read these dates from the photo and it can make mistakes. The photo is shown next to each date so the date can be compared with the paper. The court's paper is what counts, not this screen.",
      noDates: "I did not find a full date (day, month and year) written on this paper.",
      periods: "These time periods are written on the paper, word for word. This helper does not count days or work out any deadline.",
      help: "Places that can help with this kind of paper:",
      helpAny: "Places that can help with many kinds of legal papers:",
      notAdvice: "This helper only reads the paper. It is not a lawyer and it cannot say what to do. A lawyer or a legal aid office can tell you what to do.",
    },
    labels: {
      title: "What is this letter?",
      takePhoto: "Take or choose a photo",
      deletePhoto: "Delete the photo now",
      reading: "Reading the photo on this phone…",
      loadingReader: "Getting the photo reader ready (first time only)…",
      kindHeading: "What kind of paper",
      datesHeading: "Dates written on the paper",
      periodsHeading: "Time periods written on the paper",
      helpHeading: "Who can help",
      checked: "I checked this date against my paper",
      dateOnPhoto: "On the photo",
      alsoAgain: "also written {n} more time(s)",
      saveCase: "Save this to my case",
      needsSignIn: "Saving needs a sign-in and a case code.",
      saved: "Saved to the case. The photo has the Social Security number hidden.",
      deleted: "The photo is deleted from this phone.",
      another: "Another letter",
      hidden: "Numbers that look like a Social Security number are hidden in what is shown and saved.",
      quoteLabel: "The paper says:",
      confidence: "Reading quality",
    },
  },
  es: {
    notes: {
      lookslike: "Parece ser:",
      why: "Elegí esto porque la página tiene estas palabras:",
      newPhoto: "Esta foto está muy borrosa o es muy pequeña para leerla con seguridad. Hace falta una foto nueva: la hoja completa en la imagen, buena luz y el teléfono quieto.",
      noText: "No encontré palabras en esta foto, así que no puedo decir qué tipo de papel es. Hace falta una foto nueva.",
      datesCheck: "Una computadora leyó estas fechas de la foto y puede equivocarse. La foto aparece junto a cada fecha para poder compararla con el papel. Lo que cuenta es el papel del tribunal, no esta pantalla.",
      noDates: "No encontré una fecha completa (día, mes y año) escrita en este papel.",
      periods: "Estos plazos están escritos en el papel, palabra por palabra. Este ayudante no cuenta días ni calcula ningún plazo.",
      help: "Lugares que pueden ayudar con este tipo de papel:",
      helpAny: "Lugares que pueden ayudar con muchos tipos de papeles legales:",
      notAdvice: "Este ayudante solo lee el papel. No es un abogado y no puede decir qué hacer. Un abogado o una oficina de ayuda legal le puede decir qué hacer.",
    },
    labels: {
      title: "¿Qué es esta carta?",
      takePhoto: "Tomar o elegir una foto",
      deletePhoto: "Borrar la foto ahora",
      reading: "Leyendo la foto en este teléfono…",
      loadingReader: "Preparando el lector de fotos (solo la primera vez)…",
      kindHeading: "Qué tipo de papel",
      datesHeading: "Fechas escritas en el papel",
      periodsHeading: "Plazos escritos en el papel",
      helpHeading: "Quién puede ayudar",
      checked: "Revisé esta fecha con mi papel",
      dateOnPhoto: "En la foto",
      alsoAgain: "escrita {n} vez(veces) más",
      saveCase: "Guardar esto en mi caso",
      needsSignIn: "Para guardar hace falta iniciar sesión y tener un código de caso.",
      saved: "Guardado en el caso. En la foto está oculto el número de Seguro Social.",
      deleted: "La foto se borró de este teléfono.",
      another: "Otra carta",
      hidden: "Los números que parecen un número de Seguro Social se ocultan en lo que se muestra y se guarda.",
      quoteLabel: "El papel dice:",
      confidence: "Calidad de lectura",
    },
  },
};

// The fixed shape of every answer. There is no field for advice, next steps or a recommendation.
export const RESULT_KEYS = ["status", "lang", "kind", "why", "dates", "periods", "helpers", "redactions", "notes"];

// ---------- Social Security numbers ----------
const SSN_DASHED = /\b\d{3}[- ]\d{2}[- ]\d{4}\b/g;
const SSN_LABELLED = /((?:social security|ssn|s\.s\.n\.?|seguro social)[^\d\n]{0,30})(\d{9})\b/gi;
export function redactSsn(text) {
  let count = 0;
  let out = String(text == null ? "" : text).replace(SSN_DASHED, () => { count++; return "[hidden]"; });
  out = out.replace(SSN_LABELLED, (m, pre) => { count++; return pre + "[hidden]"; });
  return { text: out, count };
}
// Where the number sits on the photo, so the picture can be blurred too: the boxes of the words it is made of.
export function ssnBoxes(ocr, pad = 4) {
  const boxes = [];
  for (const ln of (ocr && ocr.lines) || []) {
    const t = String(ln.text || ""), ranges = [];
    for (const m of t.matchAll(new RegExp(SSN_DASHED.source, "g"))) ranges.push([m.index, m.index + m[0].length]);
    for (const m of t.matchAll(new RegExp(SSN_LABELLED.source, "gi"))) ranges.push([m.index + m[1].length, m.index + m[0].length]);
    for (const [a, b] of ranges) {
      let box = null, cur = 0;
      for (const w of ln.words || []) {
        const i = t.indexOf(w.text, cur); if (i < 0 || !w.bbox) continue;
        cur = i + w.text.length;
        if (i < b && i + w.text.length > a) box = box ? { x0: Math.min(box.x0, w.bbox.x0), y0: Math.min(box.y0, w.bbox.y0), x1: Math.max(box.x1, w.bbox.x1), y1: Math.max(box.y1, w.bbox.y1) } : { ...w.bbox };
      }
      box = box || (ln.bbox ? { ...ln.bbox } : null);
      if (box) boxes.push({ x0: box.x0 - pad, y0: box.y0 - pad, x1: box.x1 + pad, y1: box.y1 + pad });
    }
  }
  return boxes;
}

// ---------- blur ----------
// Variance of the Laplacian over a grey picture (0-255): high when edges are crisp, low when the picture is soft.
export function sharpness(gray, w, h) {
  if (!gray || w < 3 || h < 3) return 0;
  let n = 0, mean = 0, m2 = 0;
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x, v = 4 * gray[i] - gray[i - 1] - gray[i + 1] - gray[i - w] - gray[i + w];
    n++; const d = v - mean; mean += d / n; m2 += d * (v - mean);
  }
  return n ? m2 / n : 0;
}
export const CONF_MIN = 65;      // the photo reader's own score (0-100) below which the photo counts as unclear
export const SHARP_MIN = 60;     // sharpness (see above) below which a photo is soft, unless the reader is still very sure
export const WORDS_MIN = 12;     // fewer words than this is too little to read safely

// ---------- reading the page ----------
const FOLD = { á: "a", é: "e", í: "i", ó: "o", ú: "u", ü: "u", ñ: "n", Á: "a", É: "e", Í: "i", Ó: "o", Ú: "u", Ü: "u", Ñ: "n" };
const fold = s => s.replace(/[áéíóúüñÁÉÍÓÚÜÑ]/g, c => FOLD[c]).toLowerCase(); // one letter for one letter, so spots line up with the original
const flat = (s, n = 180) => { const c = String(s).replace(/\s+/g, " ").trim(); return c.length > n ? c.slice(0, n - 1).trimEnd() + "…" : c; };
const PERIOD_EN = /\b((?:\d{1,3}|one|two|three|four|five|six|seven|ten|fourteen|fifteen|twenty|thirty|forty|sixty|ninety)(?:\s*\(\d{1,3}\))?[\s-]+(?:calendar\s+|business\s+|working\s+)?days?)\b/gi;
const PERIOD_ES = /\b(\d{1,3}\s+d[ií]as?(?:\s+h[aá]biles|\s+calendario)?)\b/gi;

export function fmtDate(iso, lang) {
  try { return new Intl.DateTimeFormat(lang === "es" ? "es-US" : "en-US", { dateStyle: "long", timeZone: "UTC" }).format(new Date(iso + "T00:00:00Z")); } catch { return iso; }
}

function scoreKinds(folded, original) {
  return KINDS.map(k => {
    if (k.requires && !k.requires.every(r => r.test(folded))) return { id: k.id, score: 0, why: [] };
    let score = 0; const why = [];
    for (const [w, re] of k.rules) {
      const m = re.exec(folded);
      if (m) { score += w; why.push({ w, text: flat(original.slice(m.index, m.index + m[0].length), 60) }); }
    }
    return { id: k.id, score, why };
  });
}

// ocr: { text, confidence (0-100), lines?: [{ text, bbox: {x0,y0,x1,y1}, words?: [{ text, bbox }] }], sharpness? }
// opts: { lang: "en" | "es" }  (the language of the answer; default: the language of the letter)
export function analyzeLetter(ocr, opts = {}) {
  const raw = String((ocr && ocr.text) || "");
  const lang = opts.lang === "es" || opts.lang === "en" ? opts.lang : (isSpanish(raw) ? "es" : "en");
  const red = redactSsn(raw);
  const out = { status: "read", lang, kind: null, why: [], dates: [], periods: [], helpers: [], redactions: red.count, notes: [] };
  const words = (red.text.match(/[A-Za-zÀ-ÿ]{2,}/g) || []).length, conf = ocr && typeof ocr.confidence === "number" ? ocr.confidence : null;
  const softPhoto = ocr && typeof ocr.sharpness === "number" && ocr.sharpness < SHARP_MIN;
  if (!red.text.trim()) {
    // No words at all: from a soft photo that means "too blurry"; from a sharp one, a blank or very dark page.
    out.status = softPhoto ? "unclear" : "unreadable"; out.notes = [softPhoto ? "newPhoto" : "noText", "notAdvice"]; return out;
  }
  const soft = softPhoto && !(conf != null && conf >= 85);
  if ((conf != null && conf < CONF_MIN) || words < WORDS_MIN || soft) { out.status = "unclear"; out.notes = ["newPhoto", "notAdvice"]; return out; }

  // 1. what kind of paper
  const scores = scoreKinds(fold(red.text), red.text);
  const id = pickKind(scores.map(s => ({ id: s.id, score: s.score })), { min: 3, margin: 2 });
  const kind = id && KINDS.find(k => k.id === id);
  let helperIds = GENERIC_HELP;
  if (kind) {
    out.kind = { id: kind.id, name: kind.name[lang], what: kind.what[lang] };
    const seen = new Set();
    out.why = scores.find(s => s.id === id).why.sort((a, b) => b.w - a.w).map(x => x.text).filter(t => t && !seen.has(t.toLowerCase()) && seen.add(t.toLowerCase())).slice(0, 4);
    helperIds = kind.helpers;
  }
  // 3. who can help: only from the approved list
  const approved = onlyApproved(helperIds.map(h => ({ id: h })), new Set(Object.keys(HELPERS)));
  out.helpers = approved.kept.map(({ id: hid }) => ({ id: hid, name: HELPERS[hid].name[lang], url: HELPERS[hid].url, what: HELPERS[hid].what[lang] }));

  // 2. dates and time periods, line by line, each tied to its line and its spot on the photo
  const lines = (ocr && Array.isArray(ocr.lines) && ocr.lines.length ? ocr.lines : raw.split("\n").map(t => ({ text: t })));
  const byIso = new Map(), seenP = new Set();
  for (const ln of lines) {
    const t = redactSsn(String(ln.text || "")).text; if (!t.trim()) continue;
    const box = ln.bbox ? { x0: ln.bbox.x0, y0: ln.bbox.y0, x1: ln.bbox.x1, y1: ln.bbox.y1 } : null;
    for (const d of findDates(t)) {
      if (byIso.has(d.iso)) { byIso.get(d.iso).more++; continue; }
      byIso.set(d.iso, { iso: d.iso, label: fmtDate(d.iso, lang), raw: d.raw, snippet: flat(t), box, more: 0 });
    }
    for (const re of [PERIOD_EN, PERIOD_ES]) {
      for (const m of t.matchAll(new RegExp(re.source, re.flags))) {
        const key = m[1].toLowerCase() + "|" + t; if (seenP.has(key)) continue; seenP.add(key);
        out.periods.push({ text: m[1], snippet: flat(t), box });
      }
    }
  }
  out.dates = [...byIso.values()];
  out.notes = [kind ? "lookslike" : "dontKnow", ...(kind ? ["why"] : []), out.dates.length ? "datesCheck" : "noDates", ...(out.periods.length ? ["periods"] : []), kind ? "help" : "helpAny", "notAdvice"];
  return out;
}

// Everything the helper says in its own voice, in order. (Words from the paper are in quotes(); never mixed in here.)
export function sentences(result, lang = result && result.lang || "en") {
  const N = UI[lang === "es" ? "es" : "en"].notes, L = lang === "es" ? "es" : "en", out = [];
  for (const id of result.notes) {
    if (id === "dontKnow") out.push(DONT_KNOW[L]);
    else if (id === "lookslike") out.push(N.lookslike + " " + result.kind.name, result.kind.what);
    else if (id === "help") { out.push(N.help); }
    else if (id === "helpAny") { out.push(N.helpAny); }
    else if (N[id]) out.push(N[id]);
    if ((id === "help" || id === "helpAny")) for (const h of result.helpers) out.push(h.name + ": " + h.what);
  }
  return out;
}

// The paper's own words that were shown: the words it was judged by, and the lines the dates and time periods came from.
export function quotes(result) {
  return [...result.why, ...result.dates.map(d => d.snippet), ...result.periods.map(p => p.snippet)];
}
