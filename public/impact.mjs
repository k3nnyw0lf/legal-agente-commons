// SPDX-License-Identifier: AGPL-3.0-only
// Public impact page: how many cases, by kind of case and by county. Counts only: no names, no case numbers.
// Rules, in code (and tested):
//  - only real cases are counted (never the sample), and only cases that have both a kind and a county on the list;
//  - fewer than 10 cases in total: "not enough cases yet", and no number at all;
//  - any count under 10 is shown as "fewer than 10", never as a number;
//  - the total is shown only when nothing in either list is hidden, so a hidden count cannot be worked out by subtraction.
// Nothing here asks for money.
//
// DRAFT: the wording is for a Florida lawyer and a Spanish speaker to review.

export const MIN_COUNT = 10;

export const CASE_TYPES = [
  { id: "debt", en: "Debt collection", es: "Cobro de deudas" },
  { id: "housing", en: "Rent and eviction", es: "Renta y desalojo" },
  { id: "foreclosure", en: "Foreclosure and mortgage", es: "Ejecución hipotecaria e hipoteca" },
  { id: "benefits", en: "Benefits (such as SNAP or Medicaid)", es: "Beneficios (como SNAP o Medicaid)" },
  { id: "family", en: "Family", es: "Familia" },
  { id: "consumer", en: "Other consumer problem", es: "Otro problema de consumidor" },
  { id: "immigration", en: "Immigration", es: "Inmigración" },
  { id: "association", en: "Homeowner or condo association", es: "Asociación de propietarios o de condominio" },
  { id: "tax", en: "Taxes", es: "Impuestos" },
  { id: "other", en: "Other", es: "Otro" },
];

export const COUNTIES = ["Alachua", "Baker", "Bay", "Bradford", "Brevard", "Broward", "Calhoun", "Charlotte", "Citrus", "Clay", "Collier", "Columbia", "DeSoto", "Dixie", "Duval", "Escambia", "Flagler", "Franklin", "Gadsden", "Gilchrist", "Glades", "Gulf", "Hamilton", "Hardee", "Hendry", "Hernando", "Highlands", "Hillsborough", "Holmes", "Indian River", "Jackson", "Jefferson", "Lafayette", "Lake", "Lee", "Leon", "Levy", "Liberty", "Madison", "Manatee", "Marion", "Martin", "Miami-Dade", "Monroe", "Nassau", "Okaloosa", "Okeechobee", "Orange", "Osceola", "Palm Beach", "Pasco", "Pinellas", "Polk", "Putnam", "St. Johns", "St. Lucie", "Santa Rosa", "Sarasota", "Seminole", "Sumter", "Suwannee", "Taylor", "Union", "Volusia", "Wakulla", "Walton", "Washington"];

const TYPE_IDS = new Set(CASE_TYPES.map(t => t.id)), COUNTY_SET = new Set(COUNTIES);
export const validType = t => TYPE_IDS.has(t);
export const validCounty = c => COUNTY_SET.has(c);

const row = (key, id, n) => (n >= MIN_COUNT ? { [key]: id, count: n, hidden: false } : { [key]: id, count: null, hidden: true });
function group(cases, field, key) {
  const m = new Map();
  for (const c of cases) m.set(c[field], (m.get(c[field]) || 0) + 1);
  return [...m].map(([id, n]) => row(key, id, n)).sort((a, b) => (a.hidden - b.hidden) || ((b.count || 0) - (a.count || 0)) || String(a[key]).localeCompare(String(b[key])));
}

// cases: [{ type, county, fictional? }]. Returns { min, enough, total, byType: [{ id, count, hidden }], byCounty: [{ county, count, hidden }] }.
export function impactCounts(cases) {
  const real = (cases || []).filter(c => c && !c.fictional && validType(c.type) && validCounty(c.county));
  if (real.length < MIN_COUNT) return { min: MIN_COUNT, enough: false, total: null, byType: [], byCounty: [] };
  const byType = group(real, "type", "id"), byCounty = group(real, "county", "county");
  const anyHidden = [...byType, ...byCounty].some(r => r.hidden);
  return { min: MIN_COUNT, enough: true, total: anyHidden ? null : real.length, byType, byCounty };
}
