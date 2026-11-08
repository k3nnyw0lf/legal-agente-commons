// SPDX-License-Identifier: AGPL-3.0-only
// Builds the FICTIONAL sample case documents: public/cf/sample-debt-ortega/*.pdf and _text.json.
// Run: node scripts/build-sample.mjs   (no install needed; uses the vendored pdf-lib in public/vendor)
// Every name, number and date is made up. Do not put real case material here.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const { PDFDocument, StandardFonts, rgb } = require(path.join(ROOT, "public/vendor/pdf-lib-1.17.1.min.js"));
const OUT = path.join(ROOT, "public/cf/sample-debt-ortega");
const BANNER = "FICTIONAL SAMPLE - NOT A REAL CASE. All names, numbers and dates are made up.";

// One entry per document; each page is a list of lines.
const DOCS = [
  { h: "01-collection-letter.pdf", n: "Doc 1 · Collection letter (9 Mar 2026) and envelope", g: "Letters", pages: [[
    "EXAMPLE CREDIT RECOVERY, LLC",
    "400 Placeholder Avenue, Suite 9, Example City, FL 00000   (850) 555-0177",
    "",
    "March 9, 2026",
    "",
    "Lucia Ortega",
    "123 Sample Street",
    "Example City, FL 00000",
    "",
    "Re: Account ending 0000   Original creditor: Demo Bank, N.A.",
    "",
    "Example Credit Recovery, LLC is a debt collector. We are trying to collect a debt",
    "that you owe to Example Credit Recovery, LLC. We will use any information you",
    "give us to help collect the debt.",
    "",
    "Our information shows:",
    "  Balance when the account was charged off ........ $1,642.17",
    "  Fees ............................................ $200.00",
    "  Total amount of the debt now .................... $1,842.17",
    "",
    "How can you dispute the debt?",
    "Call or write to us by April 13, 2026, to dispute all or part of the debt.",
    "If you write to us by April 13, 2026, we must stop collection on any amount",
    "you dispute until we send you information that shows you owe the debt.",
    "",
    "Collections Department",
  ], [
    "ENVELOPE (front), scanned by the client",
    "",
    "From: Example Credit Recovery, LLC, 400 Placeholder Avenue, Suite 9, Example City, FL 00000",
    "To:   Lucia Ortega, 123 Sample Street, Example City, FL 00000",
    "",
    "Postmark: EXAMPLE CITY FL   MAR 10 2026",
    "Client's note on the envelope: \"Got this in the mail on March 12.\"",
  ]] },
  { h: "02-dispute-letter.pdf", n: "Doc 2 · Written dispute sent by the client (20 Mar 2026)", g: "Letters", pages: [[
    "Lucia Ortega",
    "123 Sample Street, Example City, FL 00000",
    "",
    "March 20, 2026",
    "",
    "Example Credit Recovery, LLC",
    "Collections Department",
    "400 Placeholder Avenue, Suite 9, Example City, FL 00000",
    "",
    "Sent by certified mail, article number 0000 0000 0000 0000 0000",
    "",
    "Re: Account ending 0000",
    "",
    "I dispute this debt and the amount of $1,842.17 in your letter of March 9, 2026.",
    "Please send me proof that I owe this amount, a copy of the agreement, an",
    "explanation of the $200.00 in fees, and proof that you own the account.",
    "",
    "Please do not call me at work. My employer does not allow personal calls.",
    "",
    "Lucia Ortega",
  ]] },
  { h: "03-certified-mail-receipt.pdf", n: "Doc 3 · Certified-mail return card (24 Mar 2026)", g: "Letters", pages: [[
    "DOMESTIC RETURN RECEIPT (sample form, scanned by the client)",
    "",
    "Article addressed to: Example Credit Recovery, LLC, Collections Department",
    "Article number: 0000 0000 0000 0000 0000",
    "",
    "Signature of agent: J. Placeholder",
    "Date of delivery: 03/24/2026",
  ]] },
  { h: "04-call-log.pdf", n: "Doc 4 · Call log, work number (Apr-May 2026)", g: "Records the client kept", pages: [[
    "CALL LOG kept by Lucia Ortega - calls to her work number (850) 555-0190",
    "",
    "Date        Time      Caller ID          Notes",
    "04/06/2026  10:12 AM  (850) 555-0177     Asked for Lucia about the Demo Bank account.",
    "04/09/2026  11:40 AM  (850) 555-0177     Voicemail at the front desk.",
    "04/15/2026  09:05 AM  (850) 555-0177     Told the caller my employer does not allow personal calls.",
    "04/20/2026  02:31 PM  (850) 555-0177     Hung up when I answered.",
    "04/27/2026  10:55 AM  (850) 555-0177     Asked for a payment today.",
    "05/01/2026  03:15 PM  (850) 555-0177     Voicemail at the front desk.",
    "05/06/2026  09:47 AM  (850) 555-0177     Said the account will go to a lawyer.",
    "05/11/2026  01:20 PM  (850) 555-0177     Missed call.",
    "05/15/2026  10:02 AM  (850) 555-0177     Asked for Lucia by name.",
    "",
    "Total: 9 calls. Written by hand each day; typed up on May 16, 2026.",
  ]] },
  { h: "05-summons-and-complaint.pdf", n: "Doc 5 · Summons and complaint (served 28 Oct 2026)", g: "Court papers", pages: [[
    "IN THE COUNTY COURT IN AND FOR EXAMPLE COUNTY, FLORIDA (FICTIONAL)",
    "",
    "EXAMPLE CREDIT RECOVERY, LLC, Plaintiff,",
    "v.                                                    Case No. SAMPLE-2026-CC-000123",
    "LUCIA ORTEGA, Defendant.",
    "",
    "SUMMONS",
    "",
    "You are being sued (fictional sample). You have 20 days after you get this",
    "paper to give the clerk your written answer to the complaint on page 2.",
    "",
    "RETURN OF SERVICE (sample): Served on Lucia Ortega at 123 Sample Street,",
    "Example City, FL 00000, on October 28, 2026, at 6:40 PM.",
  ], [
    "IN THE COUNTY COURT IN AND FOR EXAMPLE COUNTY, FLORIDA (FICTIONAL)",
    "Case No. SAMPLE-2026-CC-000123        Filed: June 1, 2026",
    "",
    "COMPLAINT",
    "",
    "1. Plaintiff Example Credit Recovery, LLC says it is the owner of an account",
    "   first opened with Demo Bank, N.A., ending 0000.",
    "2. Plaintiff says Defendant owes $1,842.17.",
    "3. Plaintiff asks the Court for judgment for $1,842.17, plus costs.",
    "",
    "Sample & Placeholder, P.A., for Plaintiff",
    "By: Jordan Testwell (fictional), Florida Bar No. 0000000",
  ]] },
  { h: "06-final-bank-statement.pdf", n: "Doc 6 · Final Demo Bank statement (Aug 2021)", g: "Records the client kept", pages: [[
    "DEMO BANK, N.A. - CREDIT CARD STATEMENT (sample)",
    "Account ending 0000      Opened: 04/02/2019",
    "Statement closing date: 08/31/2021",
    "",
    "Last payment received: 01/15/2021   $75.00",
    "Previous balance ................................ $1,598.40",
    "Interest charged ................................ $43.77",
    "New balance ..................................... $1,642.17",
    "",
    "This account was closed and charged off on 08/31/2021.",
  ]] },
];

fs.mkdirSync(OUT, { recursive: true });
const index = { files: [], chunks: [], fictional: true };
for (const d of DOCS) {
  const pdf = await PDFDocument.create();
  pdf.setTitle(d.n); pdf.setAuthor("Legal Agente Commons (fictional sample)"); pdf.setSubject(BANNER);
  pdf.setCreationDate(new Date("2026-11-08T12:00:00Z")); pdf.setModificationDate(new Date("2026-11-08T12:00:00Z"));
  pdf.setProducer("pdf-lib"); pdf.setCreator("scripts/build-sample.mjs");
  const font = await pdf.embedFont(StandardFonts.Helvetica), bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const fi = index.files.length;
  index.files.push({ n: d.n, h: d.h, g: d.g });
  d.pages.forEach((lines, pi) => {
    const page = pdf.addPage([612, 792]);
    page.drawText(BANNER, { x: 50, y: 760, size: 9, font: bold, color: rgb(0.75, 0.1, 0.1) });
    let y = 728;
    for (const ln of lines) { if (ln) page.drawText(ln, { x: 56, y, size: 10.5, font }); y -= 16; }
    page.drawText(`Page ${pi + 1} of ${d.pages.length}`, { x: 520, y: 30, size: 8, font });
    index.chunks.push({ f: fi, p: pi + 1, t: [BANNER, ...lines].filter(Boolean).join("\n") });
  });
  fs.writeFileSync(path.join(OUT, d.h), await pdf.save({ useObjectStreams: false }));
}
fs.writeFileSync(path.join(OUT, "_text.json"), JSON.stringify(index, null, 1) + "\n");
console.log("built", DOCS.length, "sample documents and _text.json in", path.relative(ROOT, OUT));
