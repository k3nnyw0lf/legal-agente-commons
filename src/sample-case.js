// SPDX-License-Identifier: AGPL-3.0-only
// ============================================================================
//  FICTIONAL SAMPLE CASE. NOT A REAL CASE.
//  Every person, company, court, number, date and document below is made up
//  for builders and testers. Any match with a real person or company is chance.
//  Never replace this with real case data: real cases live only in the private
//  store of a deployment (KV "case:<code>"), never in this repository.
// ============================================================================

const SLUG = "sample-debt-ortega";
const CF = "/cf/" + SLUG + "/";
const D = {
  1: "01-collection-letter.pdf",
  2: "02-dispute-letter.pdf",
  3: "03-certified-mail-receipt.pdf",
  4: "04-call-log.pdf",
  5: "05-summons-and-complaint.pdf",
  6: "06-final-bank-statement.pdf",
};
const doc = n => CF + D[n];

const data = {
  title: "SAMPLE (fictional): Example Credit Recovery v. Ortega",
  cn: "Made-up case · County Court, Example County, Florida · No. SAMPLE-2026-CC-000123",
  moneyNote: "FICTIONAL SAMPLE. A made-up Florida debt-collection dispute for builders and testers. Every name, number and document here is invented.",
  fictional: true,
  caption: {
    court: "IN THE COUNTY COURT IN AND FOR\nEXAMPLE COUNTY, FLORIDA (FICTIONAL)",
    plaintiff: "EXAMPLE CREDIT RECOVERY, LLC",
    defendant: "LUCIA ORTEGA",
    caseNo: "SAMPLE-2026-CC-000123",
  },
  cf: CF,
  textIndex: "_text.json",
  docBase: CF,
  docSuffix: "",
  docMap: D,

  // ---- people and parties (map) ----
  nodes: {
    client: { nm: "Lucia Ortega", rl: "Client (fictional)", role: "The person the collector says owes the debt. Lives in Example County, Florida.", x: 400, y: 270, w: 180,
      facts: [
        ["Opened a Demo Bank credit card ending 0000 in April 2019.", "Doc 6"],
        ["Got the collection letter on 12 March 2026 and kept the envelope.", "Doc 1"],
        ["Mailed a written dispute by certified mail on 20 March 2026.", "Doc 2"],
        ["Wrote down every call to her work number from 6 April to 15 May 2026.", "Doc 4"],
        ["Was handed the summons and complaint at home on 28 October 2026.", "Doc 5"],
      ] },
    bank: { nm: "Demo Bank, N.A.", rl: "Original creditor (fictional)", role: "Issued the credit card. Closed and charged off the account in August 2021.", x: 60, y: 60, w: 170,
      facts: [["Final statement shows a balance of $1,642.17 at charge-off, 31 August 2021.", "Doc 6"]] },
    buyer: { nm: "Example Credit Recovery, LLC", rl: "Debt buyer and collector (fictional)", role: "Says it bought the account. Sent the collection letter, made the calls and filed the suit.", x: 650, y: 60, w: 250,
      facts: [
        ["Collection letter dated 9 March 2026 asks for $1,842.17.", "Doc 1"],
        ["The certified-mail card shows it received the dispute on 24 March 2026.", "Doc 3"],
      ] },
    firm: { nm: "Sample & Placeholder, P.A.", rl: "Collector's law firm (fictional)", role: "Signed and filed the complaint for the collector.", x: 720, y: 420, w: 210,
      facts: [["Signed the complaint filed 1 June 2026.", "Doc 5"]] },
    court: { nm: "Example County Court", rl: "Court (fictional)", role: "Where the collector filed the case.", x: 430, y: 500, w: 190,
      facts: [["Case No. SAMPLE-2026-CC-000123, filed 1 June 2026.", "Doc 5"]] },
    lawyer: { nm: "Avery Lindqvist, Esq.", rl: "Volunteer lawyer (fictional)", role: "Accepted one task: review the papers and advise on the answer.", x: 60, y: 420, w: 200,
      facts: [["Accepted the review task on 3 November 2026.", "Task record"]] },
  },
  edges: [
    ["bank", "buyer", "money", "sold the account"],
    ["buyer", "client", "block", "letter and calls"],
    ["client", "buyer", "auth", "written dispute"],
    ["buyer", "firm", "auth", "hired"],
    ["firm", "court", "auth", "filed suit"],
    ["lawyer", "client", "auth", "review task"],
  ],
  contacts: {
    client: { who: "Lucia Ortega (fictional)", role: "Client", phones: ["(850) 555-0134"], address: "123 Sample Street, Example City, FL 00000", note: "Prefers Spanish. Calls after 5 PM." },
    buyer: { who: "Example Credit Recovery, LLC (fictional)", role: "Collector", phones: ["(850) 555-0177"], address: "400 Placeholder Avenue, Suite 9, Example City, FL 00000" },
    lawyer: { who: "Avery Lindqvist, Esq. (fictional)", role: "Volunteer lawyer", note: "Reach through the program; no direct contact details in the sample." },
  },

  // ---- timeline ----
  timeline: [
    { phase: "The account", events: [
      { d: "2 Apr 2019", t: "Lucia opens a Demo Bank credit card ending 0000.", s: "Doc 6, page 1", u: doc(6) },
      { d: "15 Jan 2021", t: "Last payment on the card: $75.00.", s: "Doc 6, page 1", u: doc(6) },
      { d: "31 Aug 2021", t: "Demo Bank charges off the account. Balance: $1,642.17.", s: "Doc 6, page 1", u: doc(6), f: "*" },
    ] },
    { phase: "Collection", events: [
      { d: "9 Mar 2026", t: "Example Credit Recovery dates a collection letter asking for $1,842.17, including $200.00 it calls fees.", s: "Doc 1, page 1", u: doc(1), f: "*" },
      { d: "12 Mar 2026", t: "Lucia receives the letter (postmark on the envelope).", s: "Doc 1, page 2", u: doc(1) + "#page=2" },
      { d: "20 Mar 2026", t: "Lucia mails a written dispute by certified mail and asks for proof of the debt.", s: "Doc 2, page 1", u: doc(2), f: "*" },
      { d: "24 Mar 2026", t: "The collector signs the certified-mail return card.", s: "Doc 3, page 1", u: doc(3) },
      { d: "6 Apr 2026", t: "First of nine calls to Lucia's work number.", s: "Doc 4, page 1", u: doc(4) },
      { d: "15 Apr 2026", t: "Lucia tells the caller her employer does not allow personal calls at work.", s: "Doc 4, page 1", u: doc(4), f: "!" },
      { d: "15 May 2026", t: "Last call in the log.", s: "Doc 4, page 1", u: doc(4) },
    ] },
    { phase: "The lawsuit", events: [
      { d: "1 Jun 2026", t: "Complaint filed in Example County Court, No. SAMPLE-2026-CC-000123.", s: "Doc 5, page 2", u: doc(5) + "#page=2" },
      { d: "28 Oct 2026", t: "Lucia is served with the summons and complaint at home.", s: "Doc 5, page 1", u: doc(5), f: "*" },
      { d: "3 Nov 2026", t: "A volunteer lawyer accepts the review task.", s: "Task record" },
    ] },
  ],

  // ---- money ----
  money: [
    ["$1,642.17", "", "Balance when Demo Bank charged off the account, 31 August 2021 (Doc 6, page 1)."],
    ["$1,842.17", "bad", "Amount the collection letter asks for: $200.00 more than the charge-off balance, listed as fees (Doc 1, page 1)."],
    ["$75.00", "in", "Last payment Lucia made, 15 January 2021 (Doc 6, page 1)."],
  ],

  // ---- letters ----
  letters: [
    { date: "9 Mar 2026", ref: "Doc 1", dir: "received", title: "Collection letter", party: "From Example Credit Recovery", body: "Asks for $1,842.17 and says Lucia has 30 days to dispute in writing." },
    { date: "20 Mar 2026", ref: "Doc 2", dir: "sent", title: "Written dispute", party: "To Example Credit Recovery, by certified mail", body: "Lucia disputes the amount and asks for proof of the debt and of the sale of the account." },
    { date: "28 Oct 2026", ref: "Doc 5", dir: "received", title: "Summons and complaint", party: "From Example County Court, filed by Sample & Placeholder, P.A.", body: "The summons says to answer within 20 days of service." },
  ],

  // ---- public sources (official sites only) ----
  portals: [
    { group: "Laws people in this sample asked about (official text)", items: [
      { t: "15 U.S.C. § 1692g", d: "Federal rule on the debt validation notice and written disputes.", u: "https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title15-section1692g&num=0&edition=prelim" },
      { t: "Fla. Stat. § 559.72", d: "Florida list of prohibited practices in consumer debt collection.", u: "http://www.leg.state.fl.us/statutes/index.cfm?App_mode=Display_Statute&URL=0500-0599/0559/Sections/0559.72.html" },
    ] },
    { group: "Public help", items: [
      { t: "Florida Courts self-help", d: "Official court information for people without a lawyer.", u: "https://www.flcourts.gov/Resources-Services/Office-of-Family-Courts/Self-Help-Information" },
      { t: "CFPB consumer complaint database", d: "Public complaints about companies, searchable by company name.", u: "https://www.consumerfinance.gov/data-research/consumer-complaints/search/" },
    ] },
  ],

  // ---- documents (hosted in public/cf/sample-debt-ortega/) ----
  files: {
    intro: "Every document in this made-up case. Select one to open it in the viewer.",
    groups: [
      { group: "Letters", items: [
        { t: "Doc 1 · Collection letter (9 Mar 2026) and envelope", d: "2 pages", h: D[1] },
        { t: "Doc 2 · Written dispute sent by the client (20 Mar 2026)", d: "1 page", h: D[2] },
        { t: "Doc 3 · Certified-mail return card (24 Mar 2026)", d: "1 page", h: D[3] },
      ] },
      { group: "Court papers", items: [
        { t: "Doc 5 · Summons and complaint (served 28 Oct 2026)", d: "2 pages", h: D[5] },
      ] },
      { group: "Records the client kept", items: [
        { t: "Doc 4 · Call log, work number (Apr-May 2026)", d: "1 page", h: D[4] },
        { t: "Doc 6 · Final Demo Bank statement (Aug 2021)", d: "1 page", h: D[6] },
      ] },
    ],
  },

  // ---- dates (they also feed the private calendar link) ----
  deadlines: [
    { d: "2026-11-12", what: "Review call with the volunteer lawyer" },
    { d: "2026-11-17", what: "Answer to the complaint due (20 days after service on 28 Oct 2026)", confirm: true },
  ],

  // ---- what the lawyer asked for ----
  tabLabels: { requests: "Lawyer's requests" },
  requests: {
    intro: "Items the volunteer lawyer needs from the client, and the status of each.",
    rows: [
      { who: "Volunteer lawyer", date: "3 Nov 2026", pri: "urgent", ask: "Upload the page of the summons that shows the date you were served.", resp: "Done: Doc 5, page 1." },
      { who: "Volunteer lawyer", date: "3 Nov 2026", pri: "reply", ask: "Do you have any letter that explains the $200.00 in fees?", resp: "No. The client is looking." },
      { who: "Volunteer lawyer", date: "3 Nov 2026", pri: "progress", ask: "Bring the envelope the collection letter came in.", resp: "Scanned as Doc 1, page 2." },
    ],
  },

  // ---- proof map: facts that need a page behind them (not legal claims) ----
  proof: {
    note: "Questions the lawyer wants answered with a page. Red means no page yet.",
    claims: [
      { id: "timing", name: "Was the dispute sent within 30 days?", why: "Set up by the program lead from the lawyer's request.", elements: [
        { id: "timing-1", el: "Date the collection letter arrived", ev: [{ t: "Envelope postmark", h: D[1], p: 2 }] },
        { id: "timing-2", el: "Date the dispute was mailed", ev: [{ t: "Dispute letter", h: D[2], p: 1 }] },
        { id: "timing-3", el: "Proof the collector received it", ev: [{ t: "Return card", h: D[3], p: 1 }] },
      ] },
      { id: "amount", name: "Where does the amount come from?", why: "Set up by the program lead from the lawyer's request.", elements: [
        { id: "amount-1", el: "Balance at charge-off", ev: [{ t: "Final statement", h: D[6], p: 1 }] },
        { id: "amount-2", el: "Amount now asked for", ev: [{ t: "Collection letter", h: D[1], p: 1 }] },
        { id: "amount-3", el: "A paper that explains the $200.00 difference", ev: [] },
      ] },
    ],
  },

  // ---- laws: plain-language summaries for the lawyer to check (not advice) ----
  laws: {
    intro: "Laws the volunteer lawyer asked to have ready. Plain-language summaries for the lawyer to check. Not legal advice.",
    totals: [],
    sections: [
      { name: "Debt collection", rows: [
        { law: '<a href="https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title15-section1692g&num=0&edition=prelim" target="_blank" rel="noopener">15 U.S.C. § 1692g</a>', doc: "Doc 1, Doc 2", did: "Federal rule about the notice a debt collector sends, and what happens after a person disputes in writing within 30 days.", caveat: "The lawyer decides whether and how it applies." },
        { law: '<a href="http://www.leg.state.fl.us/statutes/index.cfm?App_mode=Display_Statute&URL=0500-0599/0559/Sections/0559.72.html" target="_blank" rel="noopener">Fla. Stat. § 559.72</a>', doc: "Doc 4", did: "Florida list of things a person collecting a consumer debt may not do, including some calls to a workplace.", caveat: "The lawyer decides whether and how it applies." },
      ] },
    ],
    gates: ["Nothing here is advice. Only the volunteer lawyer tells the client what to do."],
  },
};

// Owner view (the client's own code) and a lawyer view of the same case without the shared notes.
export const SAMPLE_CASES = {
  "11111111": { slug: SLUG, data },
};
export const SAMPLE_COUNSEL_CODES = {
  "22222222": { base: "11111111", hideTabs: ["notes"] },
};
