// SPDX-License-Identifier: AGPL-3.0-only
// Scenarios for scripts/browser-test.mjs. Each one drives the real pages in headless Chrome.
// Fictional sample data only (sample case code 11111111).
import assert from "node:assert/strict";

const text = (page, sel = "body") => page.eval(`document.querySelector(${JSON.stringify(sel)}).innerText`);

export async function openSample(page) {
  await page.resize(375, 812);
  await page.goto("/app");
  await page.eval("localStorage.clear()"); // every scenario starts in English
  await page.goto("/app");
  await page.waitFor("document.getElementById('code')");
  await page.type("#code", "11111111");
  await page.click("#enter");
  await page.waitFor("document.getElementById('app').style.display === 'flex'", 15000);
}

// ---- made-up letters, drawn by the browser itself, so the real photo reader has something to read ----
const letterHtml = (lines, blur = 0) => "data:text/html;charset=utf-8," + encodeURIComponent(
  `<body style="margin:0;background:#fff"><div style="width:860px;padding:50px 60px;font:26px/1.55 Arial,Helvetica,sans-serif;color:#111;${blur ? `filter:blur(${blur}px)` : ""}">${lines.map(l => `<div>${l}</div>`).join("")}</div></body>`);
export const DEBT_LETTER = [
  "Example Credit Recovery, LLC", "PO Box 0000, Anytown, FL", "March 9, 2026", "Dana Example",
  "Social Security Number: 987-65-4321",
  "This communication is from a debt collector.", "This is an attempt to collect a debt.",
  "Total amount of the debt now: $1,842.17",
  "Unless you dispute the debt by April 13, 2026,", "we will assume it is valid. You have 30 days", "to dispute the debt in writing.",
];
async function makePng(page, url, name) {
  await page.resize(980, 1300, false, 2);
  await page.goto(url);
  return page.shot(name);
}
// Sharpness of a picture, worked out by the real code in the page, to tune the blur limit.
async function sharpOf(page, pngPath) {
  const b64 = (await import("node:fs")).readFileSync(pngPath).toString("base64");
  return page.eval(`(async()=>{const m=await import('/letter-check.mjs');const img=new Image();img.src='data:image/png;base64,${b64}';await img.decode();
    const w=640,h=Math.round(img.height*w/img.width),c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d');g.drawImage(img,0,0,w,h);
    const d=g.getImageData(0,0,w,h).data,gray=new Uint8Array(w*h);for(let i=0;i<w*h;i++)gray[i]=(d[4*i]*.299+d[4*i+1]*.587+d[4*i+2]*.114)|0;return m.sharpness(gray,w,h)})()`);
}

// Catches what the page saves as a download, without leaving the phone.
const catchDownloads = page => page.eval(`(()=>{window.__ics=[];const o=HTMLAnchorElement.prototype.click;HTMLAnchorElement.prototype.click=function(){if(this.download){const n=this.download;fetch(this.href).then(r=>r.text()).then(t=>window.__ics.push({name:n,text:t}));return}return o.call(this)};return 1})()`);

export const SCENARIOS = {
  async "the sample case opens on a phone"(page) {
    await openSample(page);
    assert.match(await text(page, "#hTitle"), /SAMPLE/);
    await page.shot("01-case-open-375");
  },

  async "phone header: the summary button does not sit under the language or theme buttons"(page) {
    await openSample(page);
    const r = await page.eval(`(()=>{const b=id=>{const e=document.getElementById(id);const r=e.getBoundingClientRect();return {l:r.left,r:r.right,t:r.top,b:r.bottom}};
      const hit=(x,y)=>!(x.r<=y.l||y.r<=x.l||x.b<=y.t||y.b<=x.t);const s=b('briefbtn');
      return {lang:hit(s,b('la-lang')),theme:hit(s,b('theme')),wide:document.documentElement.scrollWidth>window.innerWidth,h:Math.round(s.b-s.t)}})()`);
    assert.equal(r.lang, false, "overlaps the language button");
    assert.equal(r.theme, false, "overlaps the theme button");
    assert.equal(r.wide, false, "page is wider than the phone screen");
    assert.ok(r.h >= 40, "touch target height " + r.h);
    await page.shot("01b-header-375");
  },

  async "the timeline has the 'Dates found in the papers' phase, each linked to a page"(page) {
    await openSample(page);
    await page.click('.tab[data-view="timeline"]');
    await page.waitFor("document.getElementById('timeline-view').innerText.includes('Dates found in the papers')");
    const t = await text(page, "#timeline-view");
    assert.match(t, /found by the computer, check it/);
    const links = await page.eval(`[...document.querySelectorAll('#timeline-view a.lnk')].filter(a=>/#page=\\d+/.test(a.getAttribute('href'))).length`);
    assert.ok(links > 3, "page links: " + links);
    await page.shot("02-timeline-375");
  },

  async "the one-page summary button builds the page"(page) {
    await openSample(page);
    await page.eval(`window.__w=[];window.open=function(){return {document:{write:s=>window.__w.push(s),open:()=>{window.__w=[]},close:()=>{},body:{}}}}`);
    await page.click("#briefbtn");
    await page.waitFor("window.__w.join('').includes('One-page summary for a volunteer')");
    const html = await page.eval("window.__w.join('')");
    assert.match(html, /FICTIONAL SAMPLE/);
    assert.ok(!/\(\d{3}\)\s?\d{3}-\d{4}/.test(html), "no phone numbers");
  },

  async "Ask AI: a Spanish advice question shows the fixed notice"(page) {
    await openSample(page);
    await page.click('.tab[data-view="search"]');
    await page.waitFor("document.getElementById('sq')");
    await page.type("#sq", "¿Debo pagar la deuda?");
    await page.click("#sask");
    await page.waitFor("document.querySelector('.ai-notice')", 15000);
    assert.match(await text(page, ".ai-notice"), /Esta pregunta es para un abogado/);
    await page.shot("03-ask-ai-notice-375");
  },

  async "letter check: the page works without signing in, on a phone, in both languages"(page) {
    await page.resize(375, 812);
    await page.goto("/letter");
    await page.waitFor("document.getElementById('la-file')");
    assert.match(await text(page, "h1"), /What is this letter\?/);
    assert.match(await text(page, ".promise"), /never train AI/);
    const r = await page.eval(`(()=>{const e=document.documentElement;return {wide:e.scrollWidth>innerWidth}})()`);
    assert.equal(r.wide, false, "wider than the phone");
    await page.click('.lang button[data-set="es"]');
    assert.match(await text(page, "h1"), /¿Qué es esta carta\?/);
    assert.match(await text(page, ".promise"), /Nunca usamos sus papeles/);
    await page.click('.lang button[data-set="en"]');
    await page.shot("10-letter-start-375");
  },

  async "letter check: a sharp photo of a made-up letter is read on the phone and nothing is stored"(page) {
    const png = await makePng(page, letterHtml(DEBT_LETTER), "letter-sharp");
    await page.resize(375, 812);
    await page.goto("/letter");
    console.log("     sharp letter: sharpness " + Math.round(await sharpOf(page, png)));
    await page.upload("#la-file2", png);
    await page.waitFor("document.querySelector('#la-result .kind')", 150000);
    const t = await text(page, "#la-result");
    assert.match(t, /Letter from a debt collector/);
    assert.match(t, /April 13, 2026/);
    assert.match(t, /March 9, 2026/);
    assert.match(t, /30 days/, "the time period is quoted");
    assert.match(t, /Consumer Financial Protection Bureau/);
    assert.ok(!/987/.test(t), "no Social Security number on screen");
    const cards = await page.eval(`[...document.querySelectorAll('#la-result ol.dates li')].map(li=>({iso:li.dataset.iso,crop:!!li.querySelector('canvas.crop')&&li.querySelector('canvas.crop').width>40,chk:!!li.querySelector('input[type=checkbox]')}))`);
    assert.ok(cards.length >= 2 && cards.every(c => c.crop && c.chk), "every date has its photo and a checkbox: " + JSON.stringify(cards));
    await page.shot("11-letter-result-375");
    // Add to my calendar: only after a date is ticked, and nothing goes to the server.
    await catchDownloads(page);
    assert.equal(await page.eval(`[...document.querySelectorAll('#la-result ol.dates li button')].every(b=>b.disabled)&&document.getElementById('la-cal-all').disabled`), true, "nothing can be added before a date is checked");
    const before = page.requests.length;
    const iso = await page.eval(`(()=>{const li=document.querySelector('#la-result ol.dates li[data-iso="2026-04-13"]');li.querySelector('input[type=checkbox]').click();return li.dataset.iso})()`);
    await page.eval(`document.querySelector('#la-result ol.dates li[data-iso="2026-04-13"] button').click()`);
    await page.waitFor("window.__ics.length === 1");
    const ics = await page.eval("window.__ics[0]");
    assert.equal(ics.name, "date-2026-04-13.ics");
    assert.match(ics.text, /DTSTART;VALUE=DATE:20260413/);
    assert.ok(!/DTSTART;VALUE=DATE:20260309/.test(ics.text), "the date that was not checked is not in the file");
    assert.match(ics.text, /court's paper is what counts/);
    assert.ok(!/ATTENDEE|ACTION:EMAIL/.test(ics.text));
    assert.deepEqual(page.requests.slice(before), [], "saving the calendar file sent nothing to the server");
    assert.match(await text(page, "#la-cal-msg"), /Saved a calendar file on this phone/);
    await page.eval(`document.querySelector('#la-result ol.dates li[data-iso="2026-03-09"] input[type=checkbox]').click()`);
    await page.eval(`document.getElementById('la-cal-all').click()`);
    await page.waitFor("window.__ics.length === 2");
    const both = await page.eval("window.__ics[1]");
    assert.equal(both.name, "dates-from-my-papers.ics");
    assert.equal((both.text.match(/BEGIN:VEVENT/g) || []).length, 2);
    await page.click('.lang button[data-set="es"]');
    assert.match(await text(page, ".calbox"), /Lo que cuenta es el papel del tribunal/);
    await page.click('.lang button[data-set="en"]');
    // nothing about the photo in browser storage
    const st = await page.eval(`({ls:Object.entries(localStorage).map(([k,v])=>[k,String(v).length]),ss:sessionStorage.length})`);
    assert.ok(st.ls.every(([k, n]) => /^la-/.test(k) && n < 100), "localStorage holds only small settings: " + JSON.stringify(st.ls));
    assert.equal(st.ss, 0);
    // delete now: the picture and the answer are gone
    await page.click("#la-delete");
    await page.waitFor("document.getElementById('la-result').hidden");
    const gone = await page.eval(`({canvases:document.querySelectorAll('#la-result canvas').length,status:document.getElementById('la-status').textContent,file:document.getElementById('la-file2').value})`);
    assert.equal(gone.canvases, 0);
    assert.match(gone.status, /deleted/);
    assert.equal(gone.file, "");
  },

  async "letter check: the Social Security number is blacked out in the saved photo"(page) {
    const png = await makePng(page, letterHtml(DEBT_LETTER), "letter-ssn");
    await page.resize(375, 812);
    await page.goto("/letter");
    await page.upload("#la-file2", png);
    await page.waitFor("document.querySelector('#la-result #la-code')", 150000);
    await page.type("#la-code", "11111111");
    await page.click("#la-savecase");
    await page.waitFor("document.getElementById('la-save-msg').textContent.includes('Saved')", 30000);
    const ups = JSON.parse(await page.env.COMMENTS.get("uploads:sample-debt-ortega"));
    const rec = ups.find(u => /letter-/.test(u.n));
    assert.ok(rec, "the photo was saved to the case");
    const stored = await page.env.FILES.get(rec.key);
    assert.ok(stored, "it is in the private bucket");
    // Read the SAVED picture again with the same photo reader: the number must not be there.
    const back = await page.eval(`(async()=>{const r=await fetch('/cf/sample-debt-ortega/up/${rec.key}?code=11111111');const b=await r.blob();
      const w=await Tesseract.createWorker(['eng'],1,{workerPath:'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/worker.min.js',corePath:'https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1'});
      const t=(await w.recognize(b)).data.text;await w.terminate();return t})()`);
    assert.match(back, /debt collector/i, "the saved photo is still readable");
    assert.ok(!/987|65[- ]?4321/.test(back), "the saved photo still shows the number: " + back);
    const textIdx = JSON.parse(await page.env.COMMENTS.get("text:sample-debt-ortega"));
    assert.ok(!/987-65-4321/.test(JSON.stringify(textIdx)), "the saved text hides it too");
    assert.match(JSON.stringify(textIdx), /\[hidden\]/);
  },

  async "letter check: a blurry photo gets a request for a new photo, not an answer"(page) {
    const png = await makePng(page, letterHtml(DEBT_LETTER, 7), "letter-blurry");
    await page.resize(375, 812);
    await page.goto("/letter");
    console.log("     blurry letter: sharpness " + Math.round(await sharpOf(page, png)));
    await page.upload("#la-file2", png);
    await page.waitFor("document.querySelector('#la-result .callout, #la-result .kind')", 150000);
    const t = await text(page, "#la-result");
    assert.match(t, /too blurry or too small/);
    assert.ok(!/April 13/.test(t), "no dates from a blurry photo");
    assert.equal(await page.eval(`document.querySelectorAll('#la-result ol.dates').length`), 0);
    await page.shot("12-letter-blurry-375");
  },

  async "found dates: tick one after checking it, save it as a calendar file, and the tick is kept for the case"(page) {
    await openSample(page);
    await catchDownloads(page);
    await page.click('.tab[data-view="timeline"]');
    await page.waitFor("document.querySelectorAll('#timeline-view input[type=checkbox]').length > 3");
    assert.match(await text(page, "#timeline-view"), /court's paper is what counts/);
    const before = page.requests.length;
    await page.eval(`(()=>{const b=[...document.querySelectorAll('#timeline-view .tphase')].find(p=>/Dates found/.test(p.innerText));window.__row=b.querySelector('.tev');window.__cb=window.__row.querySelector('input[type=checkbox]');window.__cb.click();return 1})()`);
    await page.waitFor("[...document.querySelectorAll('#timeline-view .la-muted')].some(x=>x.textContent.startsWith('✔'))");
    await page.eval("window.__row.querySelector('button').click()");
    await page.waitFor("window.__ics.length === 1");
    const f = await page.eval("window.__ics[0]");
    assert.match(f.text, /BEGIN:VEVENT/);
    assert.equal((f.text.match(/BEGIN:VEVENT/g) || []).length, 1, "only the ticked date");
    assert.deepEqual(page.requests.slice(before).filter(r => !/\/api\/store/.test(r)), [], "only the tick itself is saved on the server; the file is not");
    const kv = JSON.parse(await page.env.COMMENTS.get("datechecks:sample-debt-ortega"));
    assert.equal(Object.keys(kv).length, 1);
    assert.equal(kv[Object.keys(kv)[0]].by, "admin@example.org");
    // Open the case again: still ticked.
    await page.click("#lockbtn");
    await page.type("#code", "11111111"); await page.click("#enter");
    await page.waitFor("document.getElementById('app').style.display === 'flex'");
    await page.click('.tab[data-view="timeline"]');
    await page.waitFor("[...document.querySelectorAll('#timeline-view input[type=checkbox]')].some(c=>c.checked)");
    await page.click("#la-lang");
    await page.waitFor("document.getElementById('timeline-view').innerText.includes('Agregar a mi calendario')", 8000);
    await page.eval(`(()=>{const b=[...document.querySelectorAll('#timeline-view .tphase')].find(p=>/Fechas encontradas|Dates found/.test(p.innerText));b.scrollIntoView();return 1})()`);
    assert.equal(await page.eval("document.documentElement.scrollWidth <= innerWidth && document.getElementById('timeline-view').scrollWidth <= document.getElementById('timeline-view').clientWidth + 1"), true, "the timeline rows fit the phone screen");
    await page.shot("04-found-dates-375", false);
  },

  async "the Spanish switch translates the new strings"(page) {
    await openSample(page);
    await page.click("#la-lang");
    await page.waitFor("document.documentElement.lang === 'es'");
    await page.click('.tab[data-view="timeline"]');
    await page.waitFor("document.getElementById('timeline-view').innerText.includes('Fechas encontradas')", 8000);
    assert.match(await text(page, "#briefbtn"), /Resumen de una página/);
  },
};
