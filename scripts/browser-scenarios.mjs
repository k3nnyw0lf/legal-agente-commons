// SPDX-License-Identifier: AGPL-3.0-only
// Scenarios for scripts/browser-test.mjs. Each one drives the real pages in headless Chrome.
// Fictional sample data only (sample case code 11111111).
import assert from "node:assert/strict";

const text = (page, sel = "body") => page.eval(`document.querySelector(${JSON.stringify(sel)}).innerText`);

export async function openSample(page) {
  await page.resize(375, 812);
  await page.goto("/app");
  await page.waitFor("document.getElementById('code')");
  await page.type("#code", "11111111");
  await page.click("#enter");
  await page.waitFor("document.getElementById('app').style.display === 'flex'", 15000);
}

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

  async "the Spanish switch translates the new strings"(page) {
    await openSample(page);
    await page.click("#la-lang");
    await page.waitFor("document.documentElement.lang === 'es'");
    await page.click('.tab[data-view="timeline"]');
    await page.waitFor("document.getElementById('timeline-view').innerText.includes('Fechas encontradas')", 8000);
    assert.match(await text(page, "#briefbtn"), /Resumen de una página/);
  },
};
