// SPDX-License-Identifier: AGPL-3.0-only
// 25 made-up letters, with the answer the letter check must give for each. Written BEFORE the code.
// Everything here is invented: fictional people, companies, a fictional county, 555-01xx phones.
// The 987-65-4321 number is in the range the Social Security Administration set aside for advertising and never issues.
//
// text:   what the photo reader (OCR) hands over, as plain text
// conf:   the reader's own confidence, 0-100 (a blurry photo scores low)
// expect: kind     the id of the kind of paper, or null when the helper must say "I don't know"
//         status   "read" | "unclear" (blurry or too little text) | "unreadable" (no text at all)
//         dates    every full date written on the paper, as ISO, in reading order, no repeats
//         periods  time periods written as "N days" on the paper, as written (we never count days)
//         helpers  ids that must be on the "who can help" list
//         redacted how many Social Security numbers must be hidden before anything is saved

export const LETTERS = [
  {
    id: "01-summons-en", lang: "en", conf: 93,
    text: `IN THE COUNTY COURT IN AND FOR EXAMPLE COUNTY, FLORIDA
CASE NO. SAMPLE-2026-CC-000456
EXAMPLE CREDIT RECOVERY, LLC, Plaintiff,
v.
DANA EXAMPLE, Defendant.
SUMMONS
THE STATE OF FLORIDA
To each Sheriff of the State: You are commanded to serve this summons and a copy of the complaint on the defendant:
DANA EXAMPLE, 100 Sample Street, Anytown, Florida
Each defendant is required to serve written defenses to the complaint on the plaintiff's attorney within 20 days after service of this summons, not counting the day of service.
DATED on October 28, 2026.
Clerk of the Court`,
    expect: { kind: "summons", status: "read", dates: ["2026-10-28"], periods: ["20 days"], helpers: ["floridalawhelp", "floridabar"], redacted: 0 },
  },
  {
    id: "02-complaint-en", lang: "en", conf: 91,
    text: `IN THE COUNTY COURT IN AND FOR EXAMPLE COUNTY, FLORIDA
CASE NO. SAMPLE-2026-CC-000456
EXAMPLE CREDIT RECOVERY, LLC, Plaintiff, v. DANA EXAMPLE, Defendant.
COMPLAINT
Plaintiff sues Defendant and alleges:
COUNT I - BREACH OF CONTRACT
1. This is an action for damages that do not exceed $8,000.00.
2. Defendant opened a credit card account with Demo Bank, N.A. on April 2, 2019.
3. Plaintiff is the assignee of the account.
WHEREFORE, Plaintiff demands judgment against Defendant for damages, costs and interest.
Dated: June 1, 2026`,
    expect: { kind: "complaint", status: "read", dates: ["2019-04-02", "2026-06-01"], periods: [], helpers: ["floridalawhelp"], redacted: 0 },
  },
  {
    id: "03-debt-collector-en", lang: "en", conf: 90,
    text: `Example Credit Recovery, LLC
PO Box 0000, Anytown, FL
March 9, 2026
Dana Example
RE: Demo Bank, N.A. account ending 0000
This communication is from a debt collector. This is an attempt to collect a debt. Any information obtained will be used for that purpose.
Total amount of the debt now: $1,842.17
Itemization date: August 31, 2021
Unless you dispute the debt by April 13, 2026, we will assume it is valid. You may dispute the debt in writing.
Questions? Call (555) 555-0142`,
    expect: { kind: "debt_collection", status: "read", dates: ["2026-03-09", "2021-08-31", "2026-04-13"], periods: [], helpers: ["cfpb", "ftc", "floridalawhelp"], redacted: 0 },
  },
  {
    id: "04-debt-collector-es", lang: "es", conf: 88,
    text: `Example Credit Recovery, LLC
Apartado postal 0000, Anytown, FL
9 de marzo de 2026
Luis Sample
Asunto: cuenta de Demo Bank, N.A. que termina en 0000
Esta comunicación es de un cobrador de deudas. Este es un intento de cobrar una deuda.
Monto total de la deuda: $1,842.17
Si usted disputa la deuda antes del 13 de abril de 2026, daremos la deuda por válida. Usted tiene 30 días para disputarla por escrito.`,
    expect: { kind: "debt_collection", status: "read", dates: ["2026-03-09", "2026-04-13"], periods: ["30 días"], helpers: ["cfpb", "floridalawhelp"], redacted: 0 },
  },
  {
    id: "05-three-day-notice-en", lang: "en", conf: 92,
    text: `SAMPLE PROPERTY MANAGEMENT
3-DAY NOTICE TO PAY RENT OR DELIVER POSSESSION
To: Maria Placeholder and all other occupants
Address: Unit 4B, 200 Placeholder Avenue, Anytown, Florida
You are hereby notified that you are indebted to the Landlord in the sum of $1,450.00 for the rent and use of the premises, and that the Landlord demands payment of the rent or possession of the premises within three (3) days (excluding Saturday, Sunday and legal holidays) from the date of delivery of this notice.
Date: November 2, 2026`,
    expect: { kind: "landlord_notice", status: "read", dates: ["2026-11-02"], periods: ["3-DAY", "three (3) days"], helpers: ["floridalawhelp", "dial211"], redacted: 0 },
  },
  {
    id: "06-seven-day-notice-es", lang: "es", conf: 87,
    text: `SAMPLE PROPERTY MANAGEMENT
AVISO DE 7 DÍAS PARA TERMINAR EL ARRENDAMIENTO
Para: Maria Placeholder
Dirección: Apartamento 4B, 200 Placeholder Avenue, Anytown, Florida
Por este medio se le notifica que el arrendador da por terminado el contrato de alquiler. La terminación del arrendamiento será el 15 de noviembre de 2026.
Fecha del aviso: 8 de noviembre de 2026`,
    expect: { kind: "landlord_notice", status: "read", dates: ["2026-11-15", "2026-11-08"], periods: ["7 DÍAS"], helpers: ["floridalawhelp", "dial211"], redacted: 0 },
  },
  {
    id: "07-eviction-summons-en", lang: "en", conf: 90,
    text: `IN THE COUNTY COURT IN AND FOR EXAMPLE COUNTY, FLORIDA
CASE NO. SAMPLE-2026-CC-000789
SAMPLE PROPERTY MANAGEMENT, Plaintiff, v. MARIA PLACEHOLDER, Defendant.
SUMMONS - RESIDENTIAL EVICTION
To: MARIA PLACEHOLDER, Unit 4B, 200 Placeholder Avenue, Anytown, Florida
The plaintiff has filed an action against you to evict you from the premises described in the complaint. You are commanded to file a written response with the court within 5 days (excluding Saturdays, Sundays and legal holidays) after this summons is delivered to you.
DATED on November 20, 2026.`,
    expect: { kind: "eviction_summons", status: "read", dates: ["2026-11-20"], periods: ["5 days"], helpers: ["floridalawhelp", "dial211"], redacted: 0 },
  },
  {
    id: "08-writ-of-possession-en", lang: "en", conf: 89,
    text: `IN THE COUNTY COURT IN AND FOR EXAMPLE COUNTY, FLORIDA
CASE NO. SAMPLE-2026-CC-000789
WRIT OF POSSESSION
THE STATE OF FLORIDA, To the Sheriff of Example County:
YOU ARE COMMANDED to put the plaintiff SAMPLE PROPERTY MANAGEMENT in possession of the premises at Unit 4B, 200 Placeholder Avenue, Anytown, Florida, after 24 hours' notice conspicuously posted on the premises.
DATED on December 4, 2026.`,
    expect: { kind: "writ_possession", status: "read", dates: ["2026-12-04"], periods: [], helpers: ["floridalawhelp", "dial211"], redacted: 0 },
  },
  {
    id: "09-notice-of-hearing-en", lang: "en", conf: 94,
    text: `IN THE COUNTY COURT IN AND FOR EXAMPLE COUNTY, FLORIDA
CASE NO. SAMPLE-2026-CC-000456
NOTICE OF HEARING
PLEASE TAKE NOTICE that the above matter has been set for hearing before the Honorable Pat Sample on January 14, 2027 at 9:00 AM at the Example County Courthouse, Courtroom 3B.`,
    expect: { kind: "hearing_notice", status: "read", dates: ["2027-01-14"], periods: [], helpers: ["floridalawhelp", "flcourts"], redacted: 0 },
  },
  {
    id: "10-notice-of-hearing-es", lang: "es", conf: 86,
    text: `EN EL TRIBUNAL DEL CONDADO DE EXAMPLE, FLORIDA
CASO NÚM. SAMPLE-2026-CC-000456
AVISO DE AUDIENCIA
Se notifica que la audiencia del caso mencionado ha sido fijada ante el Honorable Pat Sample el 14 de enero de 2027 a las 9:00 AM en el Palacio de Justicia del Condado de Example, Sala 3B.`,
    expect: { kind: "hearing_notice", status: "read", dates: ["2027-01-14"], periods: [], helpers: ["floridalawhelp", "flcourts"], redacted: 0 },
  },
  {
    id: "11-foreclosure-en", lang: "en", conf: 91,
    text: `Demo Bank, N.A.
Loan Servicing Department
November 1, 2026
Jordan Sample
NOTICE OF DEFAULT AND INTENT TO ACCELERATE
Your mortgage loan ending 0000 is in default because the payments due on September 1, 2026 and October 1, 2026 were not received. If the default is not cured on or before December 15, 2026, the lender may accelerate the loan and begin foreclosure.`,
    expect: { kind: "foreclosure", status: "read", dates: ["2026-11-01", "2026-09-01", "2026-10-01", "2026-12-15"], periods: [], helpers: ["hud", "floridalawhelp", "dial211"], redacted: 0 },
  },
  {
    id: "12-final-judgment-en", lang: "en", conf: 92,
    text: `IN THE COUNTY COURT IN AND FOR EXAMPLE COUNTY, FLORIDA
CASE NO. SAMPLE-2026-CC-000456
FINAL JUDGMENT
THIS CAUSE came before the Court on the plaintiff's motion. IT IS ORDERED AND ADJUDGED that the plaintiff, EXAMPLE CREDIT RECOVERY, LLC, recover from the defendant, DANA EXAMPLE, the sum of $2,100.00, for which let execution issue.
DONE AND ORDERED in Chambers in Example County, Florida on February 3, 2027.`,
    expect: { kind: "court_order", status: "read", dates: ["2027-02-03"], periods: [], helpers: ["floridalawhelp", "floridabar"], redacted: 0 },
  },
  {
    id: "13-subpoena-en", lang: "en", conf: 90,
    text: `IN THE COUNTY COURT IN AND FOR EXAMPLE COUNTY, FLORIDA
CASE NO. SAMPLE-2026-CC-000456
SUBPOENA FOR DEPOSITION DUCES TECUM
YOU ARE COMMANDED to appear before a notary public at 100 Sample Street, Anytown, Florida, on March 3, 2027 at 10:00 AM to testify in this action, and to bring the documents listed in Schedule A.`,
    expect: { kind: "subpoena", status: "read", dates: ["2027-03-03"], periods: [], helpers: ["floridalawhelp", "floridabar"], redacted: 0 },
  },
  {
    id: "14-benefits-notice-en", lang: "en", conf: 89,
    text: `Florida Department of Children and Families
NOTICE OF CASE ACTION
Notice date: November 6, 2026
Name: Avery Test
Your food assistance (SNAP) benefits will be reduced effective December 1, 2026 because your reported income changed.
If you disagree with this decision, you have the right to ask for a fair hearing within 90 days of the date of this notice.`,
    expect: { kind: "benefits_notice", status: "read", dates: ["2026-11-06", "2026-12-01"], periods: ["90 days"], helpers: ["floridalawhelp", "dial211"], redacted: 0 },
  },
  {
    id: "15-benefits-notice-es", lang: "es", conf: 85,
    text: `Departamento de Niños y Familias de Florida
AVISO DE ACCIÓN EN SU CASO
Nombre: Luis Sample
Sus beneficios de Medicaid terminarán el 30 de noviembre de 2026 porque no recibimos los documentos pedidos.
Usted tiene derecho a pedir una audiencia justa si no está de acuerdo con esta decisión.
Fecha del aviso: 6 de noviembre de 2026`,
    expect: { kind: "benefits_notice", status: "read", dates: ["2026-11-30", "2026-11-06"], periods: [], helpers: ["floridalawhelp", "dial211"], redacted: 0 },
  },
  {
    id: "16-irs-notice-en", lang: "en", conf: 90,
    text: `Department of the Treasury
Internal Revenue Service
Notice CP2000
Notice date: October 12, 2026
Tax year: 2024
Dana Example
We received information that does not match the income on your tax return. We propose changes to your tax return. Your response is due by November 12, 2026.`,
    expect: { kind: "irs_notice", status: "read", dates: ["2026-10-12", "2026-11-12"], periods: [], helpers: ["irs_litc", "irs_tas"], redacted: 0 },
  },
  {
    id: "17-immigration-en", lang: "en", conf: 88,
    text: `U.S. Department of Homeland Security
NOTICE TO APPEAR
In removal proceedings under section 240 of the Immigration and Nationality Act
Name: Jordan Sample   File number: A000000000
You are ordered to appear before an immigration judge of the United States Department of Justice at the address provided, on December 9, 2026 at 8:30 AM.`,
    expect: { kind: "immigration", status: "read", dates: ["2026-12-09"], periods: [], helpers: ["immigrationlawhelp", "floridalawhelp"], redacted: 0 },
  },
  {
    id: "18-hoa-lien-en", lang: "en", conf: 91,
    text: `PLACEHOLDER HOMEOWNERS ASSOCIATION, INC.
September 14, 2026
Avery Test, Lot 12
NOTICE OF INTENT TO RECORD A CLAIM OF LIEN
The association's records show unpaid assessments of $900.00. If the amount is not paid within 45 days of this notice, the association intends to record a claim of lien against the property.`,
    expect: { kind: "hoa_notice", status: "read", dates: ["2026-09-14"], periods: ["45 days"], helpers: ["dbpr", "floridalawhelp"], redacted: 0 },
  },
  {
    id: "19-insurance-cancel-en", lang: "en", conf: 92,
    text: `Sample Insurance Company
NOTICE OF CANCELLATION
Policy number: HO-0000000
Insured: Maria Placeholder
Notice date: December 12, 2026
This policy will be cancelled effective 12:01 AM on January 5, 2027 for nonpayment of premium.`,
    expect: { kind: "insurance_notice", status: "read", dates: ["2026-12-12", "2027-01-05"], periods: [], helpers: ["fl_dfs", "floridalawhelp"], redacted: 0 },
  },
  {
    id: "20-family-petition-en", lang: "en", conf: 93,
    text: `IN THE CIRCUIT COURT OF THE EXAMPLE JUDICIAL CIRCUIT, IN AND FOR EXAMPLE COUNTY, FLORIDA
FAMILY DIVISION   CASE NO. SAMPLE-2026-DR-000321
IN RE: THE MARRIAGE OF AVERY TEST, Petitioner, and JORDAN SAMPLE, Respondent.
PETITION FOR DISSOLUTION OF MARRIAGE
Filed: July 7, 2026`,
    expect: { kind: "family_paper", status: "read", dates: ["2026-07-07"], periods: [], helpers: ["floridalawhelp", "flcourts"], redacted: 0 },
  },
  {
    id: "21-ssn-dashes-en", lang: "en", conf: 90,
    text: `Example Credit Recovery, LLC
March 9, 2026
Dana Example
Social Security Number: 987-65-4321
This communication is from a debt collector. This is an attempt to collect a debt.
Total amount of the debt now: $1,842.17
Unless you dispute the debt by April 13, 2026, we will assume it is valid.`,
    expect: { kind: "debt_collection", status: "read", dates: ["2026-03-09", "2026-04-13"], periods: [], helpers: ["cfpb", "floridalawhelp"], redacted: 1 },
  },
  {
    id: "22-ssn-plain-es", lang: "es", conf: 87,
    text: `Example Credit Recovery, LLC
9 de marzo de 2026
Luis Sample
Número de Seguro Social 987654321
Esta comunicación es de un cobrador de deudas. Este es un intento de cobrar una deuda.
Si usted disputa la deuda antes del 13 de abril de 2026, daremos la deuda por válida.`,
    expect: { kind: "debt_collection", status: "read", dates: ["2026-03-09", "2026-04-13"], periods: [], helpers: ["cfpb", "floridalawhelp"], redacted: 1 },
  },
  {
    id: "23-not-a-legal-paper-en", lang: "en", conf: 94,
    text: `Happy birthday, Luis!
Hope you have a wonderful day. Come by for cake and music at the party on August 3, 2026.
Love, Auntie`,
    expect: { kind: null, status: "read", dates: ["2026-08-03"], periods: [], helpers: ["floridalawhelp", "dial211", "floridabar"], redacted: 0 },
  },
  {
    id: "24-blurry-photo", lang: "en", conf: 38,
    text: `ex1 amp1e cr3 d1t rec
sum m0ns 2o26 c0urt
p1aint1ff  de fen dant`,
    expect: { kind: null, status: "unclear", dates: [], periods: [], helpers: [], redacted: 0 },
  },
  {
    id: "25-no-text", lang: "en", conf: 0,
    text: ``,
    expect: { kind: null, status: "unreadable", dates: [], periods: [], helpers: [], redacted: 0 },
  },
  // A letter that tells the reader what to do in its own words. The helper may show those words as a quote
  // from the paper, but never says anything like it in its own voice.
  {
    id: "26-pushy-letter-en", lang: "en", conf: 91,
    text: `Example Credit Recovery, LLC
March 9, 2026
Dana Example
This communication is from a debt collector. This is an attempt to collect a debt.
You must pay $1,842.17 now. Do not ignore this letter or you will lose your home. You should call us today at (555) 555-0142.
Unless you dispute the debt within 30 days, we will assume it is valid.`,
    expect: { kind: "debt_collection", status: "read", dates: ["2026-03-09"], periods: ["30 days"], helpers: ["cfpb", "floridalawhelp"], redacted: 0 },
  },
];
