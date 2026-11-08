// SPDX-License-Identifier: AGPL-3.0-only
/* app-plus: Web graph, search inside documents, exhibit binder with Bates + redaction, audio player, viewer, proof map,
   requests, fingerprints, email in, citation checks, search by meaning, read aloud, talk, Spanish.
   Libraries are vendored under /vendor (same origin, behind sign-in). */
(function () {
  const css = `
#web-view{padding:18px 20px}
.webbar{display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin-bottom:10px}
.webbar .mhead{margin:0 8px 0 0}
.chip{border:1px solid var(--line);background:var(--panel);color:var(--soft);border-radius:0;padding:5px 11px;font-size:15px;cursor:pointer;display:inline-flex;gap:6px;align-items:center}
.chip.on{color:var(--ink);border-color:var(--accent)}
.chip i{width:9px;height:9px;border-radius:50%;display:inline-block}
.inp{padding:8px 11px;border:1px solid var(--line);border-radius:0;background:var(--panel);color:var(--ink);font-size:16px;min-width:200px}
#webwrap{position:relative;height:calc(100vh - 190px);min-height:420px;border:1px solid var(--line);border-radius:0;overflow:hidden;background:var(--panel2)}
#webcanvas{position:absolute;inset:0}
.webinfo{position:absolute;right:12px;top:12px;width:min(360px,calc(100% - 24px));max-height:calc(100% - 24px);overflow:auto;background:var(--panel);border:1px solid var(--line);border-radius:0;padding:13px 15px;font-size:15.5px;line-height:1.5;display:none;box-shadow:0 8px 30px rgba(0,0,0,.25)}
.webinfo .k{font-family:var(--mono);font-size:12.5px;text-transform:uppercase;letter-spacing:.08em;color:var(--accent2)}
.webinfo h4{margin:4px 0 6px;font-size:18px}
.webinfo .x{float:right;cursor:pointer;color:var(--soft);border:0;background:none;font-size:19px}
.weblegend{font-size:14.5px;color:var(--soft);margin-top:8px}
.fsearch{max-width:720px;margin:0 0 18px;padding:12px 14px;border:1px solid var(--line);border-radius:0;background:var(--panel)}
.fsearch .row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.fres{margin-top:10px}
.fres a{display:block;padding:8px 10px;border-radius:0;text-decoration:none;border:1px solid transparent}
.fres a:hover{border-color:var(--line);background:var(--panel2)}
.fres .fn{font-weight:600;font-size:15.5px}
.fres .sn{font-size:15px;color:var(--soft);margin-top:2px}
.fres mark{background:rgba(201,145,58,.35);color:inherit;border-radius:0;padding:0 1px}
.frow{display:flex;gap:8px;align-items:flex-start;max-width:720px}
.frow input[type=checkbox]{margin-top:13px;width:16px;height:16px;flex:none}
.frow .plink{flex:1}
.frow .alt{font-size:14px;color:var(--soft);margin-top:12px;white-space:nowrap;text-decoration:none}
.binder{position:sticky;top:0;z-index:5;max-width:720px;margin:0 0 16px;padding:12px 14px;border:1px solid var(--accent);border-radius:0;background:var(--panel);display:none}
.binder.on{display:block}
.binder .row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.binder .sel{margin-top:8px;font-size:15px;color:var(--soft)}
.binder .sel div{display:flex;gap:8px;align-items:center;justify-content:space-between;padding:3px 0;border-top:1px dashed var(--line)}
.btn{border:1px solid var(--line);background:var(--panel2);color:var(--ink);border-radius:0;padding:6px 11px;font-size:15px;cursor:pointer}
.btn.pri{background:var(--accent);border-color:var(--accent);color:#fff}
.btn:disabled{opacity:.5;cursor:default}
.warn{color:var(--block);font-size:14.5px}
#redact{position:fixed;inset:0;z-index:80;background:rgba(0,0,0,.6);display:none;align-items:center;justify-content:center}
#redact.on{display:flex}
#redact .box{background:var(--panel);border:1px solid var(--line);border-radius:0;padding:12px;max-width:min(900px,96vw);max-height:94vh;display:flex;flex-direction:column;gap:8px}
#redact .stage{position:relative;overflow:auto;max-height:76vh}
#redact canvas{display:block}
#redact .rect{position:absolute;background:#000;opacity:.85;outline:1px solid #f33}
#audio-view .wave{border:1px solid var(--line);border-radius:0;background:var(--panel2);padding:10px;max-width:980px}
.aud-ctl{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:10px 0;max-width:980px}
.moments{max-width:980px;display:grid;gap:6px;margin:8px 0 18px}
.moments button{text-align:left;border:1px solid var(--line);background:var(--panel);color:var(--ink);border-radius:0;padding:8px 11px;cursor:pointer;font-size:15.5px}
.moments button b{font-family:var(--mono);color:var(--accent2);margin-right:8px}
.trans{max-width:980px;max-height:46vh;overflow:auto;border:1px solid var(--line);border-radius:0;background:var(--panel)}
.trans div{padding:4px 10px;font-size:15.5px;cursor:pointer;border-bottom:1px solid var(--line)}
.trans div b{font-family:var(--mono);color:var(--soft);font-weight:400;margin-right:8px}
.trans div.cur{background:rgba(91,155,213,.18)}
`;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  const loaded = {};
  function loadScript(src) {
    if (loaded[src]) return loaded[src];
    return loaded[src] = new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('load ' + src)); document.head.appendChild(s); });
  }
  const E = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const strip = s => String(s || '').replace(/<[^>]+>/g, '');
  function cf(path) { return path ? (CASE.cf || '') + path + '?code=' + encodeURIComponent(CODE) : null; }
  function cssv(n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); }

  /* ================= WEB GRAPH ================= */
  let G = null, HOVER = null, HL = new Set(), HLL = new Set(), SHOW = { person: 1, event: 1, money: 1, doc: 1 };
  const STOP = new Set(['the', 'and', 'law', 'firm', 'inc', 'llc', 'group', 'esq', 'pllc', 'clerk', 'county', 'court', 'house', 'from', 'with', 'for']);
  function buildWeb() {
    const nodes = [], links = [], byId = {}, kw = {};
    const add = n => { if (!byId[n.id]) { byId[n.id] = n; nodes.push(n); } return byId[n.id]; };
    for (const id in CASE.nodes) {
      const n = CASE.nodes[id];
      add({ id: 'p:' + id, kind: 'person', label: n.nm, sub: n.rl, text: n.role, ref: id });
      const k = new Set((n.aka || []).map(norm));
      norm(n.nm).split(/[^a-z0-9]+/).forEach(w => { if (w.length >= 4 && !STOP.has(w)) k.add(w); });
      if (id.length >= 3) k.add(norm(id));
      kw[id] = [...k];
    }
    const mentions = (text, from, type) => {
      const t = ' ' + norm(strip(text)) + ' ';
      for (const id in kw) if (kw[id].some(w => t.includes(w.length <= 4 ? ' ' + w : w))) links.push({ source: from, target: 'p:' + id, type });
    };
    (CASE.edges || []).forEach(e => links.push({ source: 'p:' + e[0], target: 'p:' + e[1], type: e[2], label: e[3] || '' }));
    const docByU = {};
    (CASE.files ? CASE.files.groups : []).forEach(g => g.items.forEach(it => { docByU[it.u] = it; }));
    let ei = 0;
    (CASE.timeline || []).forEach(ph => ph.events.forEach(ev => {
      const id = 'e:' + (ei++);
      add({ id, kind: 'event', label: ev.d, text: strip(ev.t), src: ev.s, u: ev.u, phase: ph.phase, star: ev.f === '*' });
      mentions(ev.t, id, 'mention');
      if (ev.u) {
        const it = docByU[ev.u] || {};
        add({ id: 'd:' + ev.u, kind: 'doc', label: it.t || ev.s || 'Document', text: it.d || '', u: ev.u, h: it.h });
        links.push({ source: id, target: 'd:' + ev.u, type: 'source' });
      }
    }));
    (CASE.money || []).forEach((m, i) => {
      const id = 'm:' + i;
      add({ id, kind: 'money', label: strip(m[0]), text: strip(m[2]) });
      mentions(m[2], id, 'money');
    });
    (CASE.files ? CASE.files.groups : []).forEach(g => g.items.forEach(it => {
      if (!it.d || /^in /.test(it.d) || /^Private/.test(g.group)) return;
      const id = 'd:' + it.u;
      add({ id, kind: 'doc', label: it.t, text: it.d, u: it.u, h: it.h, group: g.group });
      mentions(it.d, id, 'mention');
    }));
    const deg = {};
    links.forEach(l => { deg[l.source] = (deg[l.source] || 0) + 1; deg[l.target] = (deg[l.target] || 0) + 1; });
    const keep = nodes.filter(n => n.kind === 'person' || deg[n.id]);
    keep.forEach(n => n.val = 1 + (deg[n.id] || 0));
    const ok = new Set(keep.map(n => n.id));
    return { nodes: keep, links: links.filter(l => ok.has(l.source) && ok.has(l.target)) };
  }
  const KCOL = () => ({ person: cssv('--accent'), event: cssv('--info') || cssv('--accent2'), money: cssv('--money'), doc: cssv('--auth') });
  const LCOL = () => ({ money: cssv('--money'), auth: cssv('--auth'), block: cssv('--block'), mention: cssv('--faint'), source: cssv('--auth') });
  function info(n) {
    const box = document.getElementById('webinfo'); if (!n) { box.style.display = 'none'; return; }
    const kind = { person: 'Party / key item', event: 'Event', money: 'Money', doc: 'Document' }[n.kind];
    let h = `<button class="x" onclick="this.parentNode.style.display='none'">×</button><div class="k">${kind}${n.phase ? ' · ' + E(n.phase) : ''}</div><h4>${E(n.label)}</h4>`;
    if (n.sub) h += `<div style="color:var(--soft)">${E(n.sub)}</div>`;
    if (n.text) h += `<div style="margin-top:6px">${E(n.text)}</div>`;
    if (n.src) h += `<div style="margin-top:6px;color:var(--soft)">Source: ${E(n.src)}</div>`;
    const open = n.h ? cf(n.h) : n.u;
    if (open) h += `<div style="margin-top:8px"><a class="lnk" href="${E(open)}" target="_blank" rel="noopener">Open document ↗</a></div>`;
    const nb = G.graphData().links.filter(l => l.source.id === n.id || l.target.id === n.id).map(l => l.source.id === n.id ? l.target : l.source);
    if (nb.length) h += `<div class="k" style="margin-top:10px">Connected (${nb.length})</div><div>` + nb.slice(0, 40).map(m => `<a href="#" data-id="${E(m.id)}" class="lnk" style="display:block;margin:2px 0">${E(m.label)}</a>`).join('') + `</div>`;
    box.innerHTML = h; box.style.display = 'block';
    box.querySelectorAll('a[data-id]').forEach(a => a.onclick = ev => { ev.preventDefault(); focus(a.dataset.id); });
  }
  function setHL(n) {
    HL = new Set(); HLL = new Set();
    if (n) { HL.add(n.id); G.graphData().links.forEach(l => { if (l.source.id === n.id || l.target.id === n.id) { HLL.add(l); HL.add(l.source.id); HL.add(l.target.id); } }); }
  }
  function focus(id) {
    const n = G.graphData().nodes.find(x => x.id === id); if (!n) return;
    HOVER = n; setHL(n); info(n); G.centerAt(n.x, n.y, 600); G.zoom(3, 600);
  }
  function applyFilter() {
    const full = G.__full;
    const ns = full.nodes.filter(n => SHOW[n.kind]); const ok = new Set(ns.map(n => n.id));
    G.graphData({ nodes: ns, links: full.links.filter(l => ok.has(l.source.id || l.source) && ok.has(l.target.id || l.target)) });
  }
  window.webView = async function () {
    const v = document.getElementById('web-view');
    if (!window.ForceGraph) { v.innerHTML = '<p class="mnote">Loading the graph…</p>'; await loadScript('/vendor/force-graph-1.52.0.min.js'); }
    const data = buildWeb(), col = KCOL(), lcol = LCOL();
    const counts = data.nodes.reduce((a, n) => (a[n.kind] = (a[n.kind] || 0) + 1, a), {});
    const chip = (k, lab) => `<span class="chip on" data-k="${k}"><i style="background:${col[k]}"></i>${lab} ${counts[k] || 0}</span>`;
    v.innerHTML = `<div class="webbar"><h2 class="mhead">Web</h2>${chip('person', 'Parties')}${chip('event', 'Events')}${chip('money', 'Money')}${chip('doc', 'Documents')}<input id="webq" class="inp" placeholder="Find a person, event or document…" autocomplete="off"></div>
      <div id="webwrap"><div id="webcanvas"></div><div id="webinfo" class="webinfo"></div></div>
      <div class="weblegend">Bigger = more connections. Lines: <b style="color:${lcol.money}">money</b> · <b style="color:${lcol.auth}">ownership / authority</b> · <b style="color:${lcol.block}">blocked or against</b> · grey = mentioned in. Hover to light up connections, click for details, drag to move, scroll to zoom.</div>`;
    const el = document.getElementById('webcanvas');
    if (G) { try { G._destructor && G._destructor(); } catch (e) { } }
    G = ForceGraph()(el).width(el.clientWidth).height(el.clientHeight).backgroundColor('rgba(0,0,0,0)')
      .graphData(data).nodeId('id').nodeVal('val').nodeLabel(n => `<b>${E(n.label)}</b>${n.text ? '<br>' + E(n.text.slice(0, 160)) + (n.text.length > 160 ? '…' : '') : ''}`)
      .nodeCanvasObject((n, ctx, s) => {
        const r = Math.sqrt(n.val) * (n.kind === 'person' ? 4.2 : 2.6), dim = HL.size && !HL.has(n.id);
        ctx.globalAlpha = dim ? 0.15 : 1;
        ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, 2 * Math.PI); ctx.fillStyle = col[n.kind]; ctx.fill();
        if (n.star) { ctx.lineWidth = 1.5 / s; ctx.strokeStyle = cssv('--ink'); ctx.stroke(); }
        if (n.kind === 'person' || HL.has(n.id) || s > 2.6) {
          const fs = (n.kind === 'person' ? 13 : 11) / s; ctx.font = `${n.kind === 'person' ? 600 : 400} ${fs}px system-ui,sans-serif`;
          ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillStyle = cssv('--ink');
          const lab = n.label.length > 42 ? n.label.slice(0, 40) + '…' : n.label; ctx.fillText(lab, n.x, n.y + r + 2 / s);
        }
        ctx.globalAlpha = 1;
      })
      .nodePointerAreaPaint((n, c, ctx) => { const r = Math.sqrt(n.val) * (n.kind === 'person' ? 4.2 : 2.6) + 2; ctx.fillStyle = c; ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, 2 * Math.PI); ctx.fill(); })
      .linkColor(l => { const c = lcol[l.type] || lcol.mention; return HL.size && !HLL.has(l) ? 'rgba(128,128,128,.08)' : c; })
      .linkWidth(l => HLL.has(l) ? 2.2 : (['money', 'auth', 'block'].includes(l.type) ? 1.4 : 0.5))
      .linkCurvature(l => ['money', 'auth', 'block'].includes(l.type) ? 0.18 : 0)
      .linkDirectionalArrowLength(l => ['money', 'auth', 'block', 'source'].includes(l.type) ? 5 : 0).linkDirectionalArrowRelPos(0.92)
      .linkDirectionalParticles(l => HLL.has(l) ? 2 : 0).linkDirectionalParticleWidth(2.4)
      .linkLabel(l => l.label ? E(l.label) : '')
      .onNodeHover(n => { el.style.cursor = n ? 'pointer' : ''; if (!HOVER) setHL(n); })
      .onNodeClick(n => { HOVER = n; setHL(n); info(n); })
      .onBackgroundClick(() => { HOVER = null; setHL(null); info(null); })
      .autoPauseRedraw(false).cooldownTicks(220).onEngineStop(() => { if (!G.__fit) { G.zoomToFit(500, 50); G.__fit = 1; } });
    G.__full = data;
    G.d3Force('charge').strength(-110);
    G.d3Force('link').distance(l => ['money', 'auth', 'block'].includes(l.type) ? 120 : 45);
    v.querySelectorAll('.chip').forEach(c => c.onclick = () => { const k = c.dataset.k; SHOW[k] = !SHOW[k]; c.classList.toggle('on', !!SHOW[k]); applyFilter(); });
    const q = document.getElementById('webq');
    q.onkeydown = ev => { if (ev.key !== 'Enter') return; const s = norm(q.value.trim()); if (!s) return; const n = G.graphData().nodes.find(x => norm(x.label + ' ' + (x.text || '')).includes(s)); if (n) focus(n.id); };
    const ro = new ResizeObserver(() => { if (G) G.width(el.clientWidth).height(el.clientHeight); }); ro.observe(el);
  };

  /* ================= CASE FILES: search inside, binder ================= */
  let IDX = null, TEXT = null, SEL = new Map(), RED = {}, REDCODE = null;
  const saveRed = () => { try { localStorage.setItem('la-redact-' + CODE, JSON.stringify(RED)); } catch (e) { } };
  async function loadText() {
    if (TEXT) return TEXT;
    await loadScript('/vendor/minisearch-7.2.0.umd.js');
    let base = { files: [], chunks: [] };
    if (CASE.textIndex && CASE.textIndex !== '@kv') { const r = await fetch(cf(CASE.textIndex)); if (r.ok) base = await r.json(); }
    const sn = base.chunks.length;
    try { const r2 = await fetch('/api/text?code=' + encodeURIComponent(CODE)); if (r2.ok) { const x = await r2.json(); if (x && x.files && x.files.length) { const off = base.files.length; base.files = base.files.concat(x.files); base.chunks = base.chunks.concat(x.chunks.map(c => ({ f: c.f + off, p: c.p, t: c.t }))); } } } catch (e) { }
    if (!base.chunks.length) throw new Error('no text yet');
    TEXT = base; TEXT.__sn = sn; // parts from the built index come first (search by meaning counts on it)
    IDX = new MiniSearch({ fields: ['t', 'n'], storeFields: ['f', 'p'], searchOptions: { prefix: true, fuzzy: 0.15, boost: { n: 2 }, combineWith: 'AND' }, processTerm: t => norm(t) });
    IDX.addAll(TEXT.chunks.map((c, i) => ({ id: i, f: c.f, p: c.p, t: c.t, n: TEXT.files[c.f].n })));
    return TEXT;
  }
  function snippet(t, terms) {
    const nt = norm(t); let pos = -1;
    for (const w of terms) { pos = nt.indexOf(norm(w)); if (pos >= 0) break; }
    const a = Math.max(0, pos - 90), s = t.slice(a, a + 260);
    let h = E(s); terms.forEach(w => { if (w.length > 1) h = h.replace(new RegExp('(' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig'), '<mark>$1</mark>'); });
    return (a > 0 ? '…' : '') + h + '…';
  }
  async function runSearch(q) {
    const out = document.getElementById('fres'); q = q.trim();
    if (!q) { out.innerHTML = ''; return; }
    out.innerHTML = '<div class="mnote">Searching…</div>';
    try { await loadText(); } catch (e) { out.innerHTML = '<div class="warn">The document text is not available yet.</div>'; return; }
    const res = IDX.search(q).slice(0, 40);
    if (!res.length) { out.innerHTML = '<div class="mnote">Nothing found inside the documents.</div>'; return; }
    out.innerHTML = `<div class="mnote">${res.length >= 40 ? 'Top 40' : res.length} matches</div>` + res.map(r => {
      const f = TEXT.files[r.f], c = TEXT.chunks[r.id], isPdf = /\.pdf$/i.test(f.n);
      const href = f.h ? cf(f.h) + (isPdf ? '#page=' + r.p : '') : '#';
      return `<a href="${E(href)}" target="_blank" rel="noopener"><div class="fn">${E(f.n)} <span style="color:var(--soft);font-weight:400">· ${isPdf ? 'page ' + r.p : 'part ' + r.p} · ${E(f.g)}</span></div><div class="sn">${snippet(c.t, r.terms)}</div></a>`;
    }).join('');
  }
  function ssnPages(h) {
    if (!TEXT) return [];
    const fi = TEXT.files.findIndex(f => f.h === h); if (fi < 0) return [];
    const re = /\b\d{3}-\d{2}-\d{4}\b/;
    return [...new Set(TEXT.chunks.filter(c => c.f === fi && re.test(c.t)).map(c => c.p))];
  }
  function drawBinder() {
    const b = document.getElementById('binder'); if (!b) return;
    b.classList.toggle('on', SEL.size > 0);
    const list = [...SEL.values()];
    b.querySelector('.cnt').textContent = list.length + ' selected';
    b.querySelector('.sel').innerHTML = list.map((it, i) => {
      const pdf = /\.pdf$/i.test(it.h), ss = pdf ? ssnPages(it.h) : [], nr = Object.values(RED[it.h] || {}).reduce((a, r) => a + r.length, 0);
      return `<div><span>Ex. ${i + 1}: ${E(it.t)}${ss.length ? ` <span class="warn">· possible SSN on page ${ss.join(', ')}</span>` : ''}${nr ? ` · ${nr} redaction${nr > 1 ? 's' : ''}` : ''}</span>${pdf ? `<button class="btn" data-h="${E(it.h)}" data-p="${ss[0] || 1}">Redact…</button>` : ''}</div>`;
    }).join('');
    b.querySelectorAll('button[data-h]').forEach(x => x.onclick = () => openRedact(x.dataset.h, +x.dataset.p));
  }
  window.filesView = function () {
    if (REDCODE !== CODE) { try { RED = JSON.parse(localStorage.getItem('la-redact-' + CODE) || '{}'); } catch (e) { RED = {}; } REDCODE = CODE; TEXT = null; IDX = null; SEL.clear(); }
    const F = CASE.files, v = document.getElementById('files-view'); if (!F) { v.innerHTML = ''; return; }
    const total = F.groups.reduce((a, g) => a + g.items.length, 0);
    v.innerHTML = `<h2 class="mhead">Case files</h2><p class="mnote">${E(F.intro || '')} ${total} documents.${F.folder ? ` <a class="lnk" href="${E(F.folder)}" target="_blank" rel="noopener">Google Drive folder ↗</a>` : ''}</p>
      ${CASE.textIndex ? `<div class="fsearch"><div class="row"><input id="fq" class="inp" style="flex:1" placeholder="Search INSIDE the documents (e.g. validation notice, account ending, pago)" autocomplete="off"><button class="btn pri" id="fgo">Search</button></div><div id="fres" class="fres"></div></div>` : ''}
      <div id="binder" class="binder"><div class="row"><b class="cnt"></b><span style="color:var(--soft);font-size:12.5px">Bates prefix</span><input id="bpre" class="inp" style="min-width:0;width:90px" value="EXH"><span style="color:var(--soft);font-size:12.5px">start</span><input id="bstart" class="inp" style="min-width:0;width:80px" type="number" value="1" min="1"><button class="btn pri" id="bbuild">Build exhibit binder (PDF)</button><button class="btn" id="bclear">Clear</button><span id="bmsg" style="font-size:12.5px;color:var(--soft)"></span></div><div class="sel"></div></div>
      <input id="ffilter" class="ffilter" placeholder="Filter by name or description (letter, statement, summons…)" autocomplete="off"><div id="flist"></div>`;
    const draw = q => {
      q = norm(q || '').trim();
      document.getElementById('flist').innerHTML = F.groups.map(g => {
        const it = g.items.filter(x => !q || norm(x.t + ' ' + (x.d || '') + ' ' + g.group).includes(q)); if (!it.length) return '';
        return `<div class="pgroup"><div class="pgh">${E(g.group)} · ${it.length}</div>` + it.map(x => {
          const can = x.h && /\.(pdf|jpe?g|png)$/i.test(x.h), main = x.h ? cf(x.h) : x.u;
          return `<div class="frow">${can ? `<input type="checkbox" data-h="${E(x.h)}" ${SEL.has(x.h) ? 'checked' : ''} title="Add to exhibit binder">` : '<span style="width:16px;flex:none"></span>'}<a class="plink fl" href="${E(main)}" target="_blank" rel="noopener"><span class="pt">${E(x.t)} ↗</span>${x.d ? `<span class="pd">${E(x.d)}</span>` : ''}</a>${x.h && x.u ? `<a class="alt" href="${E(x.u)}" target="_blank" rel="noopener">Drive</a>` : ''}</div>`;
        }).join('') + `</div>`;
      }).join('') || '<p class="mnote">No documents match.</p>';
      document.querySelectorAll('#flist input[type=checkbox]').forEach(cb => cb.onchange = async () => {
        const it = F.groups.flatMap(g => g.items).find(x => x.h === cb.dataset.h);
        if (cb.checked) SEL.set(it.h, it); else SEL.delete(it.h);
        if (cb.checked && /\.pdf$/i.test(it.h)) { try { await loadText(); } catch (e) { } }
        drawBinder();
      });
    };
    draw('');
    document.getElementById('ffilter').oninput = e => draw(e.target.value);
    const fq = document.getElementById('fq');
    if (fq) { document.getElementById('fgo').onclick = () => runSearch(fq.value); fq.onkeydown = e => { if (e.key === 'Enter') runSearch(fq.value); }; }
    document.getElementById('bclear').onclick = () => { SEL.clear(); draw(document.getElementById('ffilter').value); drawBinder(); };
    document.getElementById('bbuild').onclick = buildBinder;
    drawBinder();
  };

  /* ---- pdf.js loader ---- */
  // pdf.js 6 decodes scanned images (JPEG 2000, JBIG2) and colour profiles with WebAssembly; without these, scans draw blank.
  const PDFOPTS = { wasmUrl: '/vendor/pdfjs-6.5.438/wasm/', standardFontDataUrl: '/vendor/pdfjs-6.5.438/standard_fonts/' };
  let PDFJS = null;
  async function pdfjs() {
    if (PDFJS) return PDFJS;
    PDFJS = await import('/vendor/pdfjs-6.5.438.min.mjs');
    PDFJS.GlobalWorkerOptions.workerSrc = '/vendor/pdfjs-6.5.438.worker.min.mjs';
    return PDFJS;
  }
  const bytesCache = {};
  async function bytes(h) { if (!bytesCache[h]) { const r = await fetch(cf(h)); if (!r.ok) throw new Error(h + ' ' + r.status); bytesCache[h] = new Uint8Array(await r.arrayBuffer()); } return bytesCache[h]; }

  /* ---- redaction modal ---- */
  let RX = null;
  async function openRedact(h, page) {
    let m = document.getElementById('redact');
    if (!m) {
      m = document.createElement('div'); m.id = 'redact';
      m.innerHTML = `<div class="box"><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><b id="rxt"></b><button class="btn" id="rxp">◀</button><span id="rxn"></span><button class="btn" id="rxx">▶</button><input id="rxg" class="inp" style="min-width:0;width:70px" type="number" min="1"><button class="btn" id="rxu">Undo box</button><button class="btn pri" id="rxd">Done</button></div><div style="font-size:12px;color:var(--soft)">Drag on the page to black out an area. Redacted pages are flattened into an image in the binder, so the hidden text is truly removed.</div><div class="stage" id="rxs"></div></div>`;
      document.body.appendChild(m);
      m.querySelector('#rxd').onclick = () => { m.classList.remove('on'); saveRed(); drawBinder(); };
      m.querySelector('#rxp').onclick = () => rxShow(RX.page - 1);
      m.querySelector('#rxx').onclick = () => rxShow(RX.page + 1);
      m.querySelector('#rxg').onchange = e => rxShow(+e.target.value);
      m.querySelector('#rxu').onclick = () => { const a = (RED[RX.h] || {})[RX.page]; if (a && a.length) { a.pop(); rxShow(RX.page); } };
    }
    m.classList.add('on');
    const pj = await pdfjs();
    RX = { h, page: page || 1, doc: await pj.getDocument({ data: (await bytes(h)).slice(), ...PDFOPTS }).promise };
    m.querySelector('#rxt').textContent = (SEL.get(h) || {}).t || h;
    rxShow(RX.page);
  }
  async function rxShow(p) {
    p = Math.max(1, Math.min(RX.doc.numPages, p || 1)); RX.page = p;
    const m = document.getElementById('redact'), stage = m.querySelector('#rxs');
    m.querySelector('#rxn').textContent = `page ${p} of ${RX.doc.numPages}`; m.querySelector('#rxg').value = p;
    const pg = await RX.doc.getPage(p), vp = pg.getViewport({ scale: 1.3 });
    const c = document.createElement('canvas'); c.width = vp.width; c.height = vp.height;
    await pg.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
    stage.innerHTML = ''; const wrap = document.createElement('div'); wrap.style.position = 'relative'; wrap.style.width = vp.width + 'px'; wrap.appendChild(c); stage.appendChild(wrap);
    const rects = (RED[RX.h] = RED[RX.h] || {})[p] = (RED[RX.h][p] || []);
    const paint = () => { wrap.querySelectorAll('.rect').forEach(x => x.remove()); rects.forEach(r => { const d = document.createElement('div'); d.className = 'rect'; Object.assign(d.style, { left: r[0] * vp.width + 'px', top: r[1] * vp.height + 'px', width: r[2] * vp.width + 'px', height: r[3] * vp.height + 'px' }); wrap.appendChild(d); }); };
    paint();
    let s = null, tmp = null;
    wrap.onpointerdown = e => { const b = wrap.getBoundingClientRect(); s = [e.clientX - b.left, e.clientY - b.top]; tmp = document.createElement('div'); tmp.className = 'rect'; wrap.appendChild(tmp); wrap.setPointerCapture(e.pointerId); };
    wrap.onpointermove = e => { if (!s) return; const b = wrap.getBoundingClientRect(), x = e.clientX - b.left, y = e.clientY - b.top; Object.assign(tmp.style, { left: Math.min(x, s[0]) + 'px', top: Math.min(y, s[1]) + 'px', width: Math.abs(x - s[0]) + 'px', height: Math.abs(y - s[1]) + 'px' }); };
    wrap.onpointerup = e => { if (!s) return; const b = wrap.getBoundingClientRect(), x = e.clientX - b.left, y = e.clientY - b.top; const w = Math.abs(x - s[0]), h = Math.abs(y - s[1]); if (w > 4 && h > 4) rects.push([Math.min(x, s[0]) / vp.width, Math.min(y, s[1]) / vp.height, w / vp.width, h / vp.height]); s = null; paint(); saveRed(); };
  }

  /* ---- binder build ---- */
  async function buildBinder() {
    const msg = document.getElementById('bmsg'), btn = document.getElementById('bbuild');
    const list = [...SEL.values()]; if (!list.length) return;
    btn.disabled = true;
    try {
      msg.textContent = 'Loading tools…';
      await loadScript('/vendor/pdf-lib-1.17.1.min.js');
      const { PDFDocument, StandardFonts, rgb } = PDFLib;
      const out = await PDFDocument.create(), font = await out.embedFont(StandardFonts.Helvetica), bold = await out.embedFont(StandardFonts.HelveticaBold);
      const pre = (document.getElementById('bpre').value || 'EXH').trim().toUpperCase(), start = Math.max(1, +document.getElementById('bstart').value || 1);
      const ex = [];
      const EVM = {}; try { (await evidenceList()).items.forEach(x => { EVM[x.h] = x; }); } catch (e) { }
      for (let i = 0; i < list.length; i++) {
        const it = list[i]; msg.textContent = `Adding exhibit ${i + 1} of ${list.length}…`;
        const first = out.getPageCount(), b = await bytes(it.h);
        const fp = hexOf(await crypto.subtle.digest('SHA-256', b)); // fingerprint of the original file, before any redaction
        if (/\.pdf$/i.test(it.h)) {
          const src = await PDFDocument.load(b, { ignoreEncryption: true }), n = src.getPageCount(), red = RED[it.h] || {};
          let pj = null, jd = null;
          for (let p = 0; p < n; p++) {
            if ((red[p + 1] || []).length) {
              pj = pj || await pdfjs(); jd = jd || await pj.getDocument({ data: b.slice(), ...PDFOPTS }).promise;
              const pg = await jd.getPage(p + 1), v1 = pg.getViewport({ scale: 1 }), vp = pg.getViewport({ scale: 2.2 });
              const c = document.createElement('canvas'); c.width = vp.width; c.height = vp.height; const ctx = c.getContext('2d');
              await pg.render({ canvasContext: ctx, viewport: vp }).promise;
              ctx.fillStyle = '#000'; red[p + 1].forEach(r => ctx.fillRect(r[0] * c.width, r[1] * c.height, r[2] * c.width, r[3] * c.height));
              const jpg = await out.embedJpg(c.toDataURL('image/jpeg', 0.88));
              out.addPage([v1.width, v1.height]).drawImage(jpg, { x: 0, y: 0, width: v1.width, height: v1.height });
            } else {
              const [cp] = await out.copyPages(src, [p]); out.addPage(cp);
            }
          }
        } else {
          const img = /\.png$/i.test(it.h) ? await out.embedPng(b) : await out.embedJpg(b);
          const pg = out.addPage([612, 792]), sc = Math.min(560 / img.width, 720 / img.height);
          pg.drawImage(img, { x: (612 - img.width * sc) / 2, y: (792 - img.height * sc) / 2, width: img.width * sc, height: img.height * sc });
        }
        ex.push({ t: it.t, first, last: out.getPageCount() - 1, fp, rec: EVM[it.h] });
      }
      const bates = k => pre + '-' + String(start + k).padStart(6, '0');
      out.getPages().forEach((pg, k) => {
        const { width } = pg.getSize(), rot = pg.getRotation().angle % 360, lab = bates(k), w = font.widthOfTextAtSize(lab, 9);
        const exn = ex.findIndex(e => k >= e.first && k <= e.last) + 1;
        if (rot === 0) {
          pg.drawRectangle({ x: width - w - 22, y: 8, width: w + 10, height: 15, color: rgb(1, 1, 1), opacity: 0.85 });
          pg.drawText(lab, { x: width - w - 17, y: 12, size: 9, font, color: rgb(0, 0, 0) });
          pg.drawText('Ex. ' + exn, { x: 18, y: 12, size: 9, font: bold, color: rgb(0, 0, 0) });
        } else {
          pg.drawText(lab + '  Ex. ' + exn, { x: 18, y: 18, size: 9, font, color: rgb(0, 0, 0), rotate: PDFLib.degrees(rot) });
        }
      });
      const cover = out.insertPage(0, [612, 792]);
      cover.drawText((CASE.title || 'Case') + ' — Exhibit binder', { x: 54, y: 730, size: 16, font: bold });
      cover.drawText(CASE.cn ? CASE.cn.slice(0, 95) : '', { x: 54, y: 710, size: 9, font });
      cover.drawText('Prepared ' + new Date().toLocaleDateString() + ' · ' + ex.length + ' exhibits · Bates ' + bates(0) + ' to ' + bates(out.getPageCount() - 2), { x: 54, y: 694, size: 9, font });
      let y = 664;
      cover.drawText('Ex.', { x: 54, y, size: 9, font: bold }); cover.drawText('Document', { x: 84, y, size: 9, font: bold }); cover.drawText('Bates range', { x: 430, y, size: 9, font: bold });
      ex.forEach((e, i) => {
        y -= 27; if (y < 70) return;
        const name = e.t.length > 70 ? e.t.slice(0, 68) + '…' : e.t;
        cover.drawText(String(i + 1), { x: 54, y, size: 9, font }); cover.drawText(name, { x: 84, y, size: 9, font });
        cover.drawText(bates(e.first) + ' – ' + bates(e.last), { x: 430, y, size: 9, font });
        const note = e.rec ? (e.rec.sha === e.fp ? 'same as the fingerprint recorded ' + String(e.rec.ts).slice(0, 10) : 'DIFFERENT from the fingerprint recorded ' + String(e.rec.ts).slice(0, 10)) : 'no earlier fingerprint on record';
        cover.drawText('SHA-256 ' + e.fp + '   ' + note, { x: 84, y: y - 10, size: 6.5, font, color: rgb(0.3, 0.3, 0.3) });
      });
      cover.drawText('SHA-256 fingerprints are of the original files in the case, before any redaction. Legal Agente records each file\'s fingerprint when it comes in.', { x: 54, y: 40, size: 7, font, color: rgb(0.3, 0.3, 0.3) });
      msg.textContent = 'Saving…';
      const blob = new Blob([await out.save()], { type: 'application/pdf' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${(CASE.title || 'case').split(' —')[0]} - exhibit binder ${new Date().toLocaleDateString('en-CA')}.pdf`;
      document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
      msg.textContent = `Done: ${out.getPageCount()} pages.`;
    } catch (e) { msg.textContent = 'Could not build: ' + e.message; }
    btn.disabled = false;
  }

  /* ================= AUDIO ================= */
  let WS = null;
  window.audioView = async function () {
    const A = CASE.audio, v = document.getElementById('audio-view'); if (!A) { v.innerHTML = ''; return; }
    if (WS) return;
    v.innerHTML = '<h2 class="mhead">' + E(A.title || 'Trial audio') + '</h2><p class="mnote">Loading…</p>';
    const meta = await (await fetch(cf(A.meta))).json();
    await loadScript('/vendor/wavesurfer-8.0.5.min.js');
    const hms = s => { s = Math.floor(s); return [Math.floor(s / 3600), Math.floor(s % 3600 / 60), s % 60].map((x, i) => i ? String(x).padStart(2, '0') : x).join(':'); };
    v.innerHTML = `<h2 class="mhead">${E(A.title || 'Trial audio')}</h2><p class="mnote">${E(A.note || '')}</p>
      <div class="wave"><div id="wv"></div></div>
      <div class="aud-ctl"><button class="btn pri" id="aplay">▶ Play</button><button class="btn" id="aback">−15s</button><button class="btn" id="afwd">+15s</button><span id="atime" style="font-family:var(--mono);font-size:13px"></span>
      <select id="arate" class="inp" style="min-width:0"><option>1</option><option>1.25</option><option>1.5</option><option>2</option></select><label style="font-size:12.5px;color:var(--soft)"><input type="checkbox" id="afollow" checked> follow transcript</label><input id="aq" class="inp" placeholder="Search the transcript…"></div>
      <div class="pgh" style="font-family:var(--mono);font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--accent2)">Key moments · ${meta.moments.length}</div>
      <div class="moments">${meta.moments.map(m => `<button data-t="${m[0]}"><b>${hms(m[0])}</b>${E(m[1])}</button>`).join('')}</div>
      <div class="pgh" style="font-family:var(--mono);font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--accent2)">Transcript (machine-made, unofficial) · ${meta.transcript.length} lines</div>
      <div class="trans" id="atr">${meta.transcript.map((t, i) => `<div data-i="${i}" data-t="${t[0]}"><b>${hms(t[0])}</b>${E(t[1])}</div>`).join('')}</div>`;
    WS = WaveSurfer.create({ container: '#wv', height: 90, waveColor: cssv('--faint'), progressColor: cssv('--accent'), cursorColor: cssv('--block'), url: cf(A.src), peaks: [meta.peaks], duration: meta.duration, normalize: true, barWidth: 2, barGap: 1, dragToSeek: true });
    const tr = meta.transcript, rows = v.querySelectorAll('#atr div'), box = v.querySelector('#atr');
    let cur = -1;
    WS.on('timeupdate', t => {
      v.querySelector('#atime').textContent = hms(t) + ' / ' + hms(meta.duration);
      let lo = 0, hi = tr.length - 1, k = -1; while (lo <= hi) { const mid = (lo + hi) >> 1; if (tr[mid][0] <= t) { k = mid; lo = mid + 1; } else hi = mid - 1; }
      if (k !== cur) { if (cur >= 0) rows[cur].classList.remove('cur'); cur = k; if (k >= 0) { rows[k].classList.add('cur'); if (v.querySelector('#afollow').checked) box.scrollTop = rows[k].offsetTop - box.offsetTop - 60; } }
    });
    WS.on('play', () => v.querySelector('#aplay').textContent = '❚❚ Pause'); WS.on('pause', () => v.querySelector('#aplay').textContent = '▶ Play');
    v.querySelector('#aplay').onclick = () => WS.playPause();
    v.querySelector('#aback').onclick = () => WS.setTime(Math.max(0, WS.getCurrentTime() - 15));
    v.querySelector('#afwd').onclick = () => WS.setTime(WS.getCurrentTime() + 15);
    v.querySelector('#arate').onchange = e => WS.setPlaybackRate(+e.target.value);
    const go = t => { WS.setTime(+t); WS.play(); };
    v.querySelectorAll('.moments button').forEach(b => b.onclick = () => go(b.dataset.t));
    rows.forEach(r => r.onclick = () => go(r.dataset.t));
    v.querySelector('#aq').oninput = e => { const q = norm(e.target.value.trim()); rows.forEach((r, i) => r.style.display = !q || norm(tr[i][1]).includes(q) ? '' : 'none'); };
  };
  /* ================= DOCUMENT VIEWER (opens any case file at the right page, phones included) ================= */
  const css2 = `
#docv{position:fixed;inset:0;z-index:85;background:rgba(0,0,0,.66);display:none;justify-content:center}
#docv.on{display:flex}
#docv .box{background:var(--panel);width:min(1100px,100vw);height:100%;display:flex;flex-direction:column;box-shadow:0 0 60px rgba(0,0,0,.4)}
#docv .dbar{display:flex;gap:6px;align-items:center;flex-wrap:wrap;padding:9px 12px;border-bottom:1px solid var(--line)}
#docv .dbar b{flex:1 1 180px;min-width:0;font-size:17px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#docv .dbar .pg{font-size:15px;color:var(--soft);white-space:nowrap}
#docv .dstage{flex:1;overflow:auto;background:var(--panel2);padding:14px;text-align:center}
#docv canvas{box-shadow:0 4px 24px rgba(0,0,0,.25);background:#fff;display:inline-block}
#docv img{max-width:100%;height:auto}
#docv pre{white-space:pre-wrap;text-align:left;font:13px/1.6 var(--mono);color:var(--ink);max-width:900px;margin:0 auto}
#docv .dmsg{color:var(--soft);font-size:15.5px;padding:30px}
.tlbar{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:0 0 14px}
.tlbar .tlhint{font-size:14.5px;color:var(--soft)}
#tlzoom{border:1px solid var(--line);border-radius:0;overflow:hidden;background:var(--panel);display:none}
#tlzoom.on{display:block}
#tldetail{max-width:900px;margin:12px 0 18px;padding:12px 14px;border:1px solid var(--line);border-radius:0;background:var(--panel);font-size:16px;line-height:1.55;display:none}
#tldetail.on{display:block}
#tldetail .k{font-family:var(--mono);font-size:13px;color:var(--accent2);text-transform:uppercase;letter-spacing:.06em}
.tl-legend{display:flex;gap:12px;flex-wrap:wrap;font-size:14.5px;color:var(--soft);margin:8px 2px}
.tl-legend i{display:inline-block;width:10px;height:10px;border-radius:0;margin-right:5px;vertical-align:-1px}
.vis-timeline{border:0!important;font-family:inherit!important}
.vis-panel.vis-center,.vis-panel.vis-left,.vis-panel.vis-right,.vis-panel.vis-top,.vis-panel.vis-bottom{border-color:var(--line)!important}
.vis-labelset .vis-label{color:var(--ink)!important;border-color:var(--line)!important;font-size:15px}
.vis-labelset .vis-label .vis-inner{padding:6px 10px!important}
.vis-time-axis .vis-text{color:var(--soft)!important;font-size:14px}
.vis-time-axis .vis-grid.vis-minor{border-color:var(--line)!important;opacity:.55}
.vis-time-axis .vis-grid.vis-major{border-color:var(--line)!important}
.vis-foreground .vis-group{border-color:var(--line)!important}
.vis-item{border-radius:0!important;font-size:14.5px!important;color:var(--ink)!important;background:var(--panel2)!important;border-color:var(--line)!important}
.vis-item .vis-item-content{padding:3px 7px!important}
.vis-item.vis-selected{box-shadow:0 0 0 2px var(--accent)!important}
.vis-item.g-court{border-left:4px solid var(--block)!important}
.vis-item.g-money{border-left:4px solid var(--money)!important}
.vis-item.g-house{border-left:4px solid var(--auth)!important}
.vis-item.g-msg{border-left:4px solid var(--accent)!important}
.vis-item.g-other{border-left:4px solid var(--soft)!important}
.vis-item.vis-range{background:color-mix(in srgb,var(--panel2) 70%,var(--accent) 30%)!important}
.vis-item.star .vis-item-content::before{content:"★ ";color:#c9913a}
.vis-item.vis-point{background:transparent!important;border:0!important}
.vis-item.vis-point .vis-item-content{padding:1px 4px!important}
.vis-item .vis-dot{border-width:5px!important;border-radius:50%!important}
.vis-item.g-court .vis-dot{border-color:var(--block)!important}.vis-item.g-money .vis-dot{border-color:var(--money)!important}
.vis-item.g-house .vis-dot{border-color:var(--auth)!important}.vis-item.g-msg .vis-dot{border-color:var(--accent)!important}.vis-item.g-other .vis-dot{border-color:var(--soft)!important}
.vis-item.vis-point.vis-selected .vis-item-content{background:var(--panel2);border-radius:0;box-shadow:0 0 0 2px var(--accent)}
.vis-item.vis-cluster{background:var(--panel2)!important;border:1px dashed var(--soft)!important;border-radius:0!important;color:var(--soft)!important}
.vis-current-time{display:none}
.flowbox{display:grid;gap:16px;margin:4px 0 22px;max-width:1100px}
.fcard{border:1px solid var(--line);border-radius:0;background:var(--panel);padding:14px 16px}
.fcard h3{margin:0 0 6px;font-size:18px}
.fcard .mnote{margin:8px 0 0}
`;
  const st2 = document.createElement('style'); st2.textContent = css2; document.head.appendChild(st2);
  function loadCss(href) { if (loaded[href]) return loaded[href]; return loaded[href] = new Promise(res => { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = href; l.onload = res; l.onerror = res; document.head.appendChild(l); }); }

  let DMAP = null, DMAPFOR = null;
  function driveMap() {
    if (DMAPFOR === CASE && DMAP) return DMAP;
    DMAP = {}; DMAPFOR = CASE;
    ((CASE.files || {}).groups || []).forEach(g => g.items.forEach(it => { const id = ((it.u || '').match(/\/d\/([A-Za-z0-9_-]{10,})/) || [])[1]; if (id && it.h) DMAP[id] = it; }));
    return DMAP;
  }
  function fileInfo(h) { for (const g of ((CASE.files || {}).groups || [])) for (const it of g.items) if (it.h === h) return it; return null; }

  let DV = null;
  function dvEl() {
    let m = document.getElementById('docv'); if (m) return m;
    m = document.createElement('div'); m.id = 'docv'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true');
    m.innerHTML = `<div class="box"><div class="dbar"><b id="dvt"></b>
      <button class="btn" id="dvp" title="Previous page">◀</button><span class="pg" id="dvn"></span><button class="btn" id="dvx" title="Next page">▶</button>
      <input id="dvg" class="inp" style="min-width:0;width:64px" type="number" min="1" title="Go to page">
      <button class="btn" id="dvzo" title="Smaller">−</button><button class="btn" id="dvzi" title="Bigger">+</button><button class="btn" id="dvfit" title="Fit to width">Fit</button>
      <a class="btn" id="dvo" target="_blank" rel="noopener" data-noview style="text-decoration:none">Open file ↗</a>
      <a class="btn" id="dvd" target="_blank" rel="noopener" data-noview style="text-decoration:none">Drive ↗</a>
      <button class="btn pri" id="dvc" title="Close (Esc)">✕</button></div><div class="dstage" id="dvs"></div></div>`;
    document.body.appendChild(m);
    m.addEventListener('click', e => { if (e.target === m) closeDoc(); });
    m.querySelector('#dvc').onclick = closeDoc;
    m.querySelector('#dvp').onclick = () => dvShow(DV.page - 1);
    m.querySelector('#dvx').onclick = () => dvShow(DV.page + 1);
    m.querySelector('#dvg').onchange = e => dvShow(+e.target.value);
    m.querySelector('#dvzi').onclick = () => { DV.scale = Math.min(4, (DV.scale || 1) * 1.2); dvShow(DV.page); };
    m.querySelector('#dvzo').onclick = () => { DV.scale = Math.max(0.3, (DV.scale || 1) / 1.2); dvShow(DV.page); };
    m.querySelector('#dvfit').onclick = () => { DV.scale = 0; dvShow(DV.page); };
    document.addEventListener('keydown', e => {
      if (!m.classList.contains('on')) return;
      if (e.key === 'Escape') closeDoc();
      else if (DV && DV.doc && e.key === 'ArrowRight' && e.target.tagName !== 'INPUT') dvShow(DV.page + 1);
      else if (DV && DV.doc && e.key === 'ArrowLeft' && e.target.tagName !== 'INPUT') dvShow(DV.page - 1);
    });
    return m;
  }
  function closeDoc() { const m = document.getElementById('docv'); if (m) { m.classList.remove('on'); m.querySelector('#dvs').innerHTML = ''; } DV = null; document.body.style.overflow = ''; }
  async function openDoc(h, page, title, drive) {
    const m = dvEl(), stage = m.querySelector('#dvs'), info = fileInfo(h) || {};
    m.classList.add('on'); document.body.style.overflow = 'hidden';
    m.querySelector('#dvt').textContent = title || info.t || h.split('/').pop();
    const o = m.querySelector('#dvo'); o.href = cf(h);
    const d = m.querySelector('#dvd'); const du = drive || info.u; d.style.display = du ? '' : 'none'; if (du) d.href = du;
    const pdfOnly = ['#dvp', '#dvx', '#dvn', '#dvg', '#dvzo', '#dvzi', '#dvfit'];
    const isPdf = /\.pdf$/i.test(h);
    pdfOnly.forEach(s => m.querySelector(s).style.display = isPdf ? '' : 'none');
    stage.innerHTML = '<div class="dmsg">Opening…</div>';
    DV = { h, page: page || 1, scale: 0, doc: null };
    try {
      if (isPdf) {
        const pj = await pdfjs();
        const doc = await pj.getDocument({ data: (await bytes(h)).slice(), ...PDFOPTS }).promise;
        if (!DV || DV.h !== h) return;
        DV.doc = doc; await dvShow(DV.page);
      } else if (/\.(jpe?g|png|gif|webp)$/i.test(h)) {
        stage.innerHTML = `<img src="${E(cf(h))}" alt="${E(info.t || '')}">`;
      } else if (/\.(webm|mp3|m4a|ogg|wav)$/i.test(h)) {
        stage.innerHTML = `<audio controls src="${E(cf(h))}" style="width:min(700px,100%);margin-top:40px"></audio>`;
      } else if (/\.(mp4|mov)$/i.test(h)) {
        stage.innerHTML = `<video controls src="${E(cf(h))}" style="max-width:100%"></video>`;
      } else {
        const r = await fetch(cf(h)); if (!r.ok) throw new Error(r.status);
        const t = await r.text();
        stage.innerHTML = `<pre>${E(t)}</pre>`;
      }
    } catch (e) { stage.innerHTML = `<div class="dmsg">Could not open this file here. Use "Open file ↗".</div>`; }
  }
  async function dvShow(p) {
    if (!DV || !DV.doc) return;
    p = Math.max(1, Math.min(DV.doc.numPages, p || 1)); DV.page = p;
    const m = document.getElementById('docv'), stage = m.querySelector('#dvs');
    m.querySelector('#dvn').textContent = `page ${p} of ${DV.doc.numPages}`; m.querySelector('#dvg').value = p;
    const pg = await DV.doc.getPage(p);
    const base = pg.getViewport({ scale: 1 });
    const fit = Math.max(0.3, (stage.clientWidth - 46) / base.width);
    const scale = DV.scale || Math.min(fit, 2.2);
    const vp = pg.getViewport({ scale }), dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const c = document.createElement('canvas'); c.width = Math.floor(vp.width * dpr); c.height = Math.floor(vp.height * dpr);
    c.style.width = Math.floor(vp.width) + 'px'; c.style.height = Math.floor(vp.height) + 'px';
    const ctx = c.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    await pg.render({ canvasContext: ctx, viewport: vp }).promise;
    if (!DV || DV.page !== p) return;
    stage.innerHTML = ''; stage.appendChild(c); stage.scrollTop = 0;
  }
  window.openDoc = openDoc;

  // Any link to a case file (hosted copy or its Google Drive original) opens in the viewer, at the page the text names.
  const PAGE_RE = /\b(?:pp?\.|page|pág\.?)\s?(\d{1,4})\b/i;
  document.addEventListener('click', e => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest && e.target.closest('a[href]');
    if (!a || a.hasAttribute('data-noview') || a.classList.contains('alt') || typeof CASE === 'undefined' || !CASE || !CASE.files) return;
    const href = a.getAttribute('href') || '';
    let h = null, page = 0, drive = null;
    if (CASE.cf && href.startsWith(CASE.cf)) {
      h = decodeURIComponent(href.slice(CASE.cf.length).split(/[?#]/)[0]);
      const pm = href.match(/#page=(\d+)/); if (pm) page = +pm[1];
    } else {
      const id = (href.match(/drive\.google\.com\/(?:file\/d\/|open\?id=)([A-Za-z0-9_-]{10,})/) || [])[1];
      const it = id && driveMap()[id]; if (it) { h = it.h; drive = href; }
    }
    if (!h) return;
    if (!page) {
      const ctx = a.closest('.tev,.lcard,.webinfo,.lwrow,.prow,.frow');
      const pm = ((a.textContent || '') + ' ' + (ctx ? ctx.textContent : '')).match(PAGE_RE);
      if (pm) page = +pm[1];
    }
    e.preventDefault(); e.stopPropagation();
    openDoc(h, page || 1, null, drive);
  }, true);

  /* ================= ZOOMABLE TIMELINE ================= */
  const MON = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11, ene: 0, abr: 3, ago: 7, dic: 11 };
  const mo = w => MON[String(w).slice(0, 3).toLowerCase()];
  function parseD(raw) {
    let s = String(raw || '').replace(/\(.*?\)/g, '').replace(/,\s*[a-z].*$/i, '').replace(/\s+/g, ' ').trim();
    let m;
    const D = (y, mth, d) => (mth === undefined || isNaN(y)) ? null : new Date(+y, mth, +d || 1);
    if ((m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/))) return { a: new Date(+m[1], +m[2] - 1, +m[3]) };
    if ((m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/))) return { a: new Date(+m[3], +m[1] - 1, +m[2]) };
    if ((m = s.match(/^(\d{1,2})\s*[–-]\s*(\d{1,2})\s+([A-Za-z]{3,})\.?\s+(\d{4})$/))) { const a = D(m[4], mo(m[3]), m[1]), b = D(m[4], mo(m[3]), +m[2] + 1); return a && { a, b }; }
    if ((m = s.match(/^(\d{1,2})\s+([A-Za-z]{3,})\.?\s*[–-]\s*(\d{1,2})\s+([A-Za-z]{3,})\.?\s+(\d{4})$/))) { const a = D(m[5], mo(m[2]), m[1]), b = D(m[5], mo(m[4]), +m[3] + 1); return a && b && { a, b }; }
    if ((m = s.match(/^(\d{1,2})\s+([A-Za-z]{3,})\.?\s+(\d{4})$/))) { const a = D(m[3], mo(m[2]), m[1]); return a && { a }; }
    if ((m = s.match(/^([A-Za-z]{3,})\.?\s+(\d{4})\s*[–-]\s*([A-Za-z]{3,})\.?\s+(\d{4})$/))) { const a = D(m[2], mo(m[1]), 1), b = D(m[4], mo(m[3]) + 1, 1); return a && b && { a, b }; }
    if ((m = s.match(/^([A-Za-z]{3,})\s*[–-]\s*([A-Za-z]{3,})\.?\s+(\d{4})$/))) { const a = D(m[3], mo(m[1]), 1), b = D(m[3], mo(m[2]) + 1, 1); return a && b && { a, b }; }
    if ((m = s.match(/^([A-Za-z]{3,})\.?\s+(\d{4})$/))) { const a = D(m[2], mo(m[1]), 1), b = D(m[2], mo(m[1]) + 1, 1); return a && { a, b }; }
    if ((m = s.match(/^(\d{4})\s*[–-]\s*(\d{4})$/))) return { a: new Date(+m[1], 0, 1), b: new Date(+m[2] + 1, 0, 1) };
    if ((m = s.match(/^(\d{4})$/))) return { a: new Date(+m[1], 0, 1), b: new Date(+m[1] + 1, 0, 1) };
    if ((m = s.match(/(\d{1,2})\s+([A-Za-z]{3,})\.?\s+(\d{4})/))) { const a = D(m[3], mo(m[2]), m[1]); return a && { a }; }
    return null;
  }
  const LANES = [
    { id: 'court', content: 'Court', re: /docket|order|motion|complaint|compl\.|court|hearing|judge|\bmtd\b|deposition|trial|filed|proposal for settlement|dismiss|affidavit|subpoena|counsel|attorney|lawyer|bar\b/i },
    { id: 'money', content: 'Money', re: /\bbank|\$|wire|zelle|transfer|payment|paid|fee|invoice|loan|mortgage|heloc|refinanc|check\b/i },
    { id: 'house', content: 'House', re: /deed|title|official records|closing|house|property|\bfpl\b|lis pendens|efficienc|rent|tenant|appraisal|zillow/i },
    { id: 'msg', content: 'Messages', re: /whatsapp|e-?mail|mailbox|letter|text|call|zoom|message|voicemail|envelope/i },
  ];
  // Sort by what the event is about first; the source (a complaint, the docket) only decides when the text doesn't.
  function laneFor(ev) {
    const s = ev.s || '', t = strip(ev.t || '');
    if (/ousted|quit ?claim|\bdeed\b|\btitle\b|\bhouse\b|property|efficienc|\brent\b|tenant|\bfpl\b|lis pendens|\bkeys?\b|locks?\b|moved (in|out)/i.test(t) || /official records/i.test(s)) return 'house';
    if (/\$\s?\d|\bwire|zelle|transfer|down payment|\bloan|mortgage|heloc|refinanc|\bbank\b|statement|\bcash\b/i.test(t) || /\bbank\b|statement/i.test(s)) return 'money';
    if (/whatsapp|e-?mails?\b|emailed|mailbox|\bletter|\btexts?\b|\bcalls?\b|called|voicemail|\bzoom\b|message/i.test(t) || /whatsapp|mailbox|e-?mail|envelope|letter/i.test(s)) return 'msg';
    if (LANES[0].re.test(t) || /docket|order|motion|complaint|compl\.|court|transcript|hearing|deposition/i.test(s)) return 'court';
    return 'other';
  }
  let TL = null;
  async function tlZoom(host, detail) {
    await Promise.all([loadCss('/vendor/vis-timeline-7.7.3.min.css'), loadScript('/vendor/vis-timeline-7.7.3.min.js')]);
    if (TL) { try { TL.destroy(); } catch (e) { } TL = null; }
    const evs = [], skipped = [];
    CASE.timeline.forEach((ph, pi) => ph.events.forEach((ev, i) => {
      const d = parseD(ev.d); if (!d) { skipped.push(ev); return; }
      const lane = laneFor(ev), short = strip(ev.t).replace(/\s+/g, ' ');
      evs.push({ id: pi + '-' + i, group: lane, start: d.a, end: d.b, type: d.b ? 'range' : 'point',
        content: E(short.length > 56 ? short.slice(0, 54) + '…' : short),
        title: E(ev.d + ' — ' + short + (ev.s ? ' [' + ev.s + ']' : '')),
        className: 'g-' + lane + (ev.f === '*' ? ' star' : ''), ev, ph: ph.phase });
    }));
    const used = new Set(evs.map(x => x.group));
    const groups = LANES.concat([{ id: 'other', content: 'Other' }]).filter(g => used.has(g.id)).map((g, i) => ({ id: g.id, content: g.content, order: i }));
    const ts = evs.map(x => +x.start), te = evs.map(x => +(x.end || x.start));
    const lo = new Date(Math.min(...ts)), hi = new Date(Math.max(...te));
    const pad = (hi - lo) * 0.04 || 864e5 * 30;
    TL = new vis.Timeline(host, new vis.DataSet(evs.map(({ ev, ph, ...x }) => x)), new vis.DataSet(groups), {
      stack: true, orientation: 'top', zoomMin: 864e5 * 5, zoomMax: 864e5 * 365 * 12,
      min: new Date(+lo - pad * 3), max: new Date(+hi + pad * 3), start: new Date(+lo - pad), end: new Date(+hi + pad),
      margin: { item: { horizontal: 4, vertical: 5 } }, maxHeight: Math.max(420, Math.round(window.innerHeight * 0.68)),
      tooltip: { followMouse: true, overflowMethod: 'cap' }, showCurrentTime: false, horizontalScroll: false, zoomKey: '',
      cluster: { maxItems: 3, showStipes: false, fitOnDoubleClick: true, titleTemplate: '{count} events here — zoom in or double-click' },
    });
    const byId = Object.fromEntries(evs.map(x => [x.id, x]));
    TL.on('select', p => {
      const x = byId[p.items[0]]; if (!x) { detail.classList.remove('on'); return; }
      const ev = x.ev;
      detail.innerHTML = `<div class="k">${E(ev.d)} · ${E(x.ph)}</div><div style="margin:4px 0 6px">${ev.f === '*' ? '★ ' : ev.f === '!' ? '⚠ ' : ''}${E(strip(ev.t))}</div><div style="font-size:12.5px;color:var(--soft)">Source: ${ev.u ? `<a class="lnk" href="${E(ev.u)}" target="_blank" rel="noopener">${E(ev.s)} ↗</a>` : E(ev.s || '')}</div>`;
      detail.classList.add('on');
    });
    return { shown: evs.length, skipped: skipped.length };
  }
  function tlEnhance() {
    const v = document.getElementById('timeline-view'); if (!v || !CASE.timeline) return;
    const note = v.querySelector('.mnote'); if (!note) return;
    let mode = 'list'; try { mode = localStorage.getItem('la-tlmode') || 'list'; } catch (e) { }
    const bar = document.createElement('div'); bar.className = 'tlbar';
    bar.innerHTML = `<button class="chip" data-m="list">☰ List</button><button class="chip" data-m="zoom">⟷ Zoomable timeline</button><span class="tlhint" id="tlhint"></span>`;
    note.after(bar);
    const leg = document.createElement('div'); leg.className = 'tl-legend';
    leg.innerHTML = `<span><i style="background:var(--block)"></i>Court</span><span><i style="background:var(--money)"></i>Money</span><span><i style="background:var(--auth)"></i>House</span><span><i style="background:var(--info)"></i>Messages</span><span>★ pivotal</span>`;
    const host = document.createElement('div'); host.id = 'tlzoom';
    const detail = document.createElement('div'); detail.id = 'tldetail';
    bar.after(leg); leg.after(host); host.after(detail);
    const phases = () => v.querySelectorAll('.tphase');
    const set = async m => {
      mode = m; try { localStorage.setItem('la-tlmode', m); } catch (e) { }
      bar.querySelectorAll('.chip').forEach(c => c.classList.toggle('on', c.dataset.m === m));
      const z = m === 'zoom';
      host.classList.toggle('on', z); leg.style.display = z ? '' : 'none'; if (!z) detail.classList.remove('on');
      phases().forEach(p => p.style.display = z ? 'none' : '');
      const hint = bar.querySelector('#tlhint');
      if (z) {
        hint.textContent = 'Loading…';
        try { const r = await tlZoom(host, detail); hint.textContent = `Scroll or pinch to zoom · drag to move · click an item for details · ${r.shown} events${r.skipped ? ` (${r.skipped} without a date are only in the list)` : ''}`; }
        catch (e) { hint.textContent = 'The zoomable view could not load. The list still works.'; }
      } else hint.textContent = '';
    };
    bar.querySelectorAll('.chip').forEach(c => c.onclick = () => set(c.dataset.m));
    set(mode);
  }

  /* ================= MONEY FLOW CHARTS ================= */
  let CH = [];
  const usd = n => '$' + Math.round(n).toLocaleString('en-US');
  async function moneyCharts() {
    CH.forEach(c => { try { c.dispose(); } catch (e) { } }); CH = [];
    const F = CASE.flow, v = document.getElementById('money-view'); if (!F || !v) return;
    const note = v.querySelector('.mnote'); if (!note) return;
    const box = document.createElement('div'); box.className = 'flowbox';
    box.innerHTML = `<div class="fcard"><h3>${E(F.title)}</h3><div class="fchart" id="fsankey"></div><p class="mnote">${E(F.note)}</p></div>` +
      (F.loans ? `<div class="fcard"><h3>${E(F.loans.title)}</h3><div class="fchart" id="floans"></div><p class="mnote">${E(F.loans.note)}</p></div>` : '');
    note.after(box);
    try { await loadScript('/vendor/echarts-5.5.1.min.js'); } catch (e) { box.innerHTML = '<p class="warn">The charts could not load.</p>'; return; }
    const ink = cssv('--ink') || '#e8eaed', soft = cssv('--soft') || '#9aa4b0', line = cssv('--line') || '#2a323c', panel = cssv('--panel') || '#161b22';
    const col = { accent: cssv('--info') || cssv('--accent') || '#5b9bd5', money: cssv('--money') || '#57a773', auth: cssv('--auth') || '#c9913a', block: cssv('--block') || '#c25b5b', faint: cssv('--faint') || '#5f6b78' };
    const narrow = box.clientWidth < 640;
    const tip = { backgroundColor: panel, borderColor: line, textStyle: { color: ink, fontSize: 12.5 }, extraCssText: 'max-width:340px;white-space:normal;' };
    // Sankey
    const nodeColor = [col.accent, col.block, col.faint, col.auth, col.money, col.faint, ink];
    const sk = box.querySelector('#fsankey'); sk.style.height = (narrow ? 520 : 380) + 'px';
    const c1 = echarts.init(sk, null, { renderer: 'svg' }); CH.push(c1);
    const into = {}; F.links.forEach(l => { into[l.t] = (into[l.t] || 0) + l.v; });
    const out = {}; F.links.forEach(l => { out[l.s] = (out[l.s] || 0) + l.v; });
    c1.setOption({
      tooltip: { ...tip, trigger: 'item', formatter: p => p.dataType === 'edge'
        ? `${E(p.data.source)} → ${E(p.data.target)}<br><b>${usd(p.data.value)}</b> · ${E(p.data.d || '')}<br><span style="color:${soft}">${E(p.data.src || '')}</span>`
        : `<b>${E(p.name)}</b><br>${E((F.nodes.find(n => n.name === p.name) || {}).note || '')}` },
      series: [{
        type: 'sankey', orient: narrow ? 'vertical' : 'horizontal', left: narrow ? 10 : 8, right: narrow ? 10 : 310, top: narrow ? 20 : 12, bottom: narrow ? 90 : 12,
        nodeAlign: 'left', nodeGap: 16, nodeWidth: 14, draggable: false, emphasis: { focus: 'adjacency' },
        data: F.nodes.map((n, i) => ({ name: n.name, itemStyle: { color: nodeColor[i] || col.accent, borderWidth: 0 },
          label: { color: ink, fontSize: 12, formatter: () => n.name + '\n' + usd(Math.max(into[i] || 0, out[i] || 0)) } })),
        links: F.links.map(l => ({ source: F.nodes[l.s].name, target: F.nodes[l.t].name, value: l.v, d: l.d, src: l.src })),
        lineStyle: { color: 'gradient', curveness: 0.5, opacity: 0.38 },
        label: { position: narrow ? 'bottom' : 'right', color: ink },
      }],
    });
    // Loans
    if (F.loans) {
      const L = F.loans, rows = L.rows, lc = box.querySelector('#floans'); lc.style.height = '330px';
      const c2 = echarts.init(lc, null, { renderer: 'svg' }); CH.push(c2);
      const cats = rows.map(r => { const d = new Date(r.d + 'T12:00:00'); return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) + '\n' + r.lender.split(/[ (;]/)[0]; });
      const vmax = Math.max(L.value ? L.value.amt : 0, ...rows.map(r => r.first + r.line));
      c2.setOption({
        grid: { left: 64, right: 16, top: 34, bottom: 52 },
        legend: { top: 0, textStyle: { color: soft, fontSize: 12 }, data: ['Mortgage (first loan)', 'Credit line, up to'] },
        tooltip: { ...tip, trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: ps => { const r = rows[ps[0].dataIndex]; return `<b>${E(r.label)}</b><br>${E(r.lender)} · ${E(r.d)}<br>Mortgage: ${usd(r.first)}${r.line ? `<br>Credit line: up to ${usd(r.line)}<br>Together: up to ${usd(r.first + r.line)}` : ''}`; } },
        xAxis: { type: 'category', data: cats, axisLabel: { color: soft, fontSize: 11 }, axisLine: { lineStyle: { color: line } } },
        yAxis: { type: 'value', max: Math.ceil(vmax * 1.08 / 50000) * 50000, axisLabel: { color: soft, formatter: v => '$' + Math.round(v / 1000) + 'k' }, splitLine: { lineStyle: { color: line, opacity: 0.6 } } },
        series: [
          { name: 'Mortgage (first loan)', type: 'bar', stack: 'debt', barMaxWidth: 64, itemStyle: { color: col.accent, borderRadius: [0, 0, 0, 0] }, data: rows.map(r => r.first),
            markLine: L.value ? { symbol: 'none', lineStyle: { color: col.money, type: 'dashed', width: 1.5 }, label: { color: col.money, formatter: L.value.label + ': ' + usd(L.value.amt), position: 'insideEndTop', fontSize: 11.5 }, data: [{ yAxis: L.value.amt }] } : undefined },
          { name: 'Credit line, up to', type: 'bar', stack: 'debt', barMaxWidth: 64, itemStyle: { color: col.block, decal: { symbol: 'rect', dashArrayX: [1, 0], dashArrayY: [3, 3], rotation: -Math.PI / 4, color: 'rgba(255,255,255,.25)' }, borderRadius: [5, 5, 0, 0] }, data: rows.map(r => r.line || null) },
        ],
        aria: { enabled: true, decal: { show: false } },
      });
    }
  }
  window.addEventListener('resize', () => { CH.forEach(c => { try { c.resize(); } catch (e) { } }); if (TL) { try { TL.redraw(); } catch (e) { } } });
  new MutationObserver(() => { const mv = document.getElementById('money-view'); if (CH.length && mv && mv.classList.contains('on')) { const n = mv.querySelector('.flowbox'); if (n) n.remove(); moneyCharts(); } })
    .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  /* ---- hook into the app's tab switching ---- */
  const _showView = window.showView;
  if (typeof _showView === 'function') {
    window.showView = function (v) {
      const r = _showView.apply(this, arguments);
      try { if (v === 'timeline') tlEnhance(); else if (v === 'money') moneyCharts(); } catch (e) { console.warn(e); }
      return r;
    };
  }

  /* ================= SIGNED-IN BAR: who is signed in, admin link, auto-open a single case ================= */
  fetch('/api/auth/status', { credentials: 'same-origin' }).then(r => r.json()).then(st => {
    if (!st || !st.signedIn) return;
    const foot = document.querySelector('#gate .gatefoot');
    if (foot) {
      const who = document.createElement('div'); who.style.marginTop = '8px';
      who.innerHTML = 'Signed in as ' + E(st.email) + (st.role === 'admin' ? ' · <a href="/admin" style="color:inherit;text-underline-offset:3px">Admin: who can open what</a>' : '');
      foot.appendChild(who);
    }
    // A lawyer invited to exactly one case goes straight into it.
    if (st.role !== 'admin' && Array.isArray(st.codes) && st.codes.length === 1) {
      const inp = document.getElementById('code'), go = document.getElementById('enter'), gate = document.getElementById('gate');
      if (inp && go && gate && getComputedStyle(gate).display !== 'none' && !inp.value) { inp.value = st.codes[0]; go.click(); }
    }
  }).catch(() => { });

  /* ================= OVERVIEW (first screen of every case) ================= */
  const css3 = `
#home-view{padding:22px 24px 40px}
.hv{max-width:1180px}
.hv-top{display:flex;flex-wrap:wrap;gap:10px 18px;align-items:baseline;margin-bottom:6px}
.hv-top h2{margin:0;font-family:var(--serif);font-weight:600;font-size:26px;line-height:1.15}
.hv-cn{font-family:var(--mono);font-size:14.5px;color:var(--soft)}
.hv-note{color:var(--soft);font-size:17px;max-width:820px;margin:6px 0 18px;line-height:1.55}
.hv-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin:0 0 22px}
.hv-stat{border:1px solid var(--line);border-radius:0;background:var(--panel);padding:12px 14px;cursor:pointer;transition:border-color .15s,transform .15s}
.hv-stat:hover{border-color:var(--accent);transform:translateY(-1px)}
.hv-stat b{display:block;font-size:24px;font-family:var(--serif);line-height:1.1}
.hv-stat span{font-size:15px;color:var(--soft)}
.hv-cols{display:grid;grid-template-columns:1.25fr 1fr;gap:18px;margin-bottom:24px}
.hv-card{border:1px solid var(--line);border-radius:0;background:var(--panel);padding:14px 16px}
.hv-card h3{margin:0 0 10px;font-size:15.5px;font-family:var(--mono);text-transform:uppercase;letter-spacing:.08em;color:var(--accent2);font-weight:500}
.hv-ev{display:grid;grid-template-columns:118px 1fr;gap:10px;padding:8px 0;border-top:1px solid var(--line);font-size:16px;line-height:1.45}
.hv-ev:first-of-type{border-top:0}
.hv-ev .d{font-family:var(--mono);font-size:14px;color:var(--soft)}
.hv-mv{padding:8px 0;border-top:1px solid var(--line);font-size:16px;line-height:1.45}
.hv-mv:first-of-type{border-top:0}
.hv-mv .w{font-weight:600}.hv-mv .d{font-family:var(--mono);font-size:14px;color:var(--soft);margin-left:6px}
.hv-mv .p{display:inline-block;font-family:var(--mono);font-size:12.5px;padding:1px 7px;border-radius:0;border:1px solid var(--line);color:var(--soft);margin-left:6px}
.hv-more{margin-top:10px;font-size:15px}
.hv-more a{color:var(--accent);cursor:pointer;text-decoration:none}
.hv-sec{margin:4px 0 10px;font-family:var(--mono);font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:var(--faint)}
.hv-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:10px;margin-bottom:18px}
.hv-go{text-align:left;border:1px solid var(--line);border-radius:0;background:var(--panel);padding:12px 14px;cursor:pointer;color:var(--ink);font:inherit;transition:border-color .15s,background .15s}
.hv-go:hover{border-color:var(--accent);background:var(--panel2)}
.hv-go b{display:block;font-size:17.5px;margin-bottom:3px}
.hv-go span{font-size:15px;color:var(--soft);line-height:1.4}
@media (max-width:860px){.hv-cols{grid-template-columns:1fr}.hv-ev{grid-template-columns:1fr}}
`;
  const st3 = document.createElement('style'); st3.textContent = css3; document.head.appendChild(st3);
  const TABDESC = {
    search: 'Ask a question; answers come only from this case file.',
    timeline: 'Every date in order, each tied to its source. Switch to the zoomable view.',
    net: 'Who is who and how they are connected.',
    web: 'People, events, money and documents as one connected web.',
    money: 'Where the money went, with the flow and loan charts.',
    laws: 'The laws that apply, with checked citations and caveats.',
    files: 'Every document. Search inside them and build an exhibit binder.',
    audio: 'The recording with its transcript and key moments.',
    letters: 'Letters sent and received, in order.',
    portals: 'Court and public-record portals, and what each holds.',
    responses: 'Discovery responses, item by item.',
    requests: 'What needs doing next, and who owes what.',
    invest: 'Public-record checks on each party.',
    fees: 'What each lawyer was paid or claims.',
    notes: 'Shared notes for the people on the case.',
    proof: 'For each claim, what has to be shown and the pages that show it. Red means a gap.',
    docreqs: 'Ask for a document; answer with a file or a phone photo.',
  };
  function goTab(v) { const t = document.querySelector('.tab[data-view="' + v + '"]'); if (t && t.style.display !== 'none') t.click(); }
  window.homeView = function () {
    const v = document.getElementById('home-view'); if (!v || !CASE) return;
    const events = (CASE.timeline || []).flatMap(p => p.events);
    const docs = ((CASE.files || {}).groups || []).reduce((a, g) => a + g.items.length, 0);
    const lawRows = ((CASE.laws || {}).sections || []).reduce((a, s) => a + s.rows.length, 0);
    const people = Object.keys(CASE.nodes || {}).length;
    const dated = events.map(e => parseD(e.d)).filter(Boolean).map(d => d.a).sort((a, b) => a - b);
    const span = dated.length ? dated[0].getFullYear() + '–' + dated[dated.length - 1].getFullYear() : '';
    const vis = v => { const t = document.querySelector('.tab[data-view="' + v + '"]'); return t && t.style.display !== 'none'; };
    const stats = [
      vis('files') && { n: docs, l: 'documents', v: 'files' },
      events.length && { n: events.length, l: 'timeline events' + (span ? ' · ' + span : ''), v: 'timeline' },
      people && { n: people, l: 'people & parties', v: 'net' },
      (CASE.money || []).length && vis('money') && { n: CASE.money.length, l: 'money items', v: 'money' },
      lawRows && vis('laws') && { n: lawRows, l: 'laws & rules mapped', v: 'laws' },
      vis('audio') && CASE.audio && { n: '▶', l: 'recording + transcript', v: 'audio' },
    ].filter(Boolean);
    const stars = events.filter(e => e.f === '*').slice(-6).reverse();
    const reqs = (CASE.requests && CASE.requests.rows || []).slice(0, 4);
    const reqLabel = (CASE.tabLabels || {}).requests || 'Next moves';
    const groups = [...document.querySelectorAll('#tabs .tgroup')].filter(g => g.style.display !== 'none').map(g => ({
      name: (g.querySelector('.tglabel') || {}).textContent || '',
      tabs: [...g.querySelectorAll('.tab')].filter(t => t.style.display !== 'none' && t.dataset.view !== 'home').map(t => ({ v: t.dataset.view, label: t.textContent.trim() })),
    })).filter(g => g.tabs.length);
    v.innerHTML = `<div class="hv">
      <div class="hv-top"><h2>${E(CASE.title)}</h2><span class="hv-cn">${E(CASE.cn || '')}</span></div>
      ${CASE.moneyNote ? `<p class="hv-note">${E(strip(CASE.moneyNote))}</p>` : ''}
      <div class="hv-stats">${stats.map(s => `<div class="hv-stat" data-go="${s.v}"><b>${E(String(s.n))}</b><span>${E(s.l)}</span></div>`).join('')}</div>
      ${(stars.length || reqs.length) ? `<div class="hv-cols">
        ${stars.length ? `<div class="hv-card"><h3>★ Pivotal moments (latest first)</h3>${stars.map(e => `<div class="hv-ev"><span class="d">${E(e.d)}</span><span>${E(strip(e.t)).slice(0, 260)}${strip(e.t).length > 260 ? '…' : ''}</span></div>`).join('')}<div class="hv-more"><a data-go="timeline">Full timeline →</a></div></div>` : ''}
        ${reqs.length && vis('requests') ? `<div class="hv-card"><h3>${E(reqLabel)}</h3>${reqs.map(r => `<div class="hv-mv"><span class="w">${E(strip(r.who || ''))}</span>${r.date ? `<span class="d">${E(r.date)}</span>` : ''}${r.pri ? `<span class="p">${E(r.pri)}</span>` : ''}</div>`).join('')}<div class="hv-more"><a data-go="requests">All of ${E(reqLabel.toLowerCase())} →</a></div></div>` : ''}
      </div>` : ''}
      ${groups.map(g => `<div class="hv-sec">${E(g.name)}</div><div class="hv-grid">${g.tabs.map(t => `<button class="hv-go" data-go="${t.v}"><b>${E(t.label)}</b><span>${E(TABDESC[t.v] || '')}</span></button>`).join('')}</div>`).join('')}
    </div>`;
    v.querySelectorAll('[data-go]').forEach(el => el.onclick = () => goTab(el.dataset.go));
  };
  /* ================= SHARED HELPERS FOR THE NEW FEATURES ================= */
  const css4 = `
.la-card{border:1px solid var(--line);border-radius:0;background:var(--panel);padding:14px 16px;margin-bottom:14px}
.la-card h3{margin:0 0 10px;font-size:15.5px;font-family:var(--mono);text-transform:uppercase;letter-spacing:.08em;color:var(--accent2);font-weight:500}
.la-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.la-pill{display:inline-block;font-family:var(--mono);font-size:12.5px;padding:1px 8px;border-radius:0;border:1px solid var(--line);color:var(--soft)}
.la-pill.red{border-color:var(--block);color:var(--block)}.la-pill.green{border-color:var(--money);color:var(--money)}.la-pill.amber{border-color:var(--auth);color:var(--auth)}
.la-muted{color:var(--soft);font-size:15px}
.la-chip{display:inline-flex;gap:6px;align-items:center;border:1px solid var(--line);border-radius:0;padding:4px 9px;font-size:15px;margin:3px 6px 3px 0;background:var(--panel2);color:var(--ink);text-decoration:none;max-width:100%}
.la-chip:hover{border-color:var(--accent)}
.la-chip .x{cursor:pointer;color:var(--soft);border:0;background:none;font-size:15.5px;padding:0 0 0 4px}
.la-in{padding:7px 10px;border:1px solid var(--line);border-radius:0;background:var(--panel2);color:var(--ink);font:inherit;font-size:15.5px}
.la-pop{position:fixed;z-index:95;background:var(--panel);border:1px solid var(--line);border-radius:0;box-shadow:0 18px 50px rgba(0,0,0,.45);padding:12px;max-height:70vh;overflow:auto;width:min(440px,92vw)}
.la-pop button.el{display:block;width:100%;text-align:left;border:1px solid var(--line);background:var(--panel2);color:var(--ink);border-radius:0;padding:7px 10px;margin:4px 0;cursor:pointer;font-size:15px}
.la-pop button.el:hover{border-color:var(--accent)}
.pf-claim{border:1px solid var(--line);border-radius:0;background:var(--panel);padding:14px 16px;margin-bottom:14px;max-width:1080px}
.pf-claim h3{margin:0 0 4px;font-size:19px}
.pf-el{display:grid;grid-template-columns:14px 1fr;gap:10px;padding:10px 0;border-top:1px solid var(--line)}
.pf-dot{width:11px;height:11px;border-radius:50%;margin-top:5px}
.pf-dot.ok{background:var(--money)}.pf-dot.gap{background:var(--block)}
.dl-row{display:grid;grid-template-columns:96px 1fr auto;gap:10px;align-items:baseline;padding:7px 0;border-top:1px solid var(--line);font-size:16px}
.dl-row:first-child{border-top:0}
.dl-row .d{font-family:var(--mono);font-size:14px;color:var(--soft)}
.dl-row.soon .d{color:var(--block);font-weight:600}
.dl-row.done{opacity:.55;text-decoration:line-through}
.rq{border:1px solid var(--line);border-radius:0;background:var(--panel);padding:12px 14px;margin-bottom:10px;max-width:980px}
.rq.done{opacity:.7}
.ai-src{margin-top:10px;font-size:15px;display:grid;gap:4px}
.ai-src a{color:var(--accent);text-decoration:none}
.ai-ans a.cite{color:var(--accent);text-decoration:none;font-family:var(--mono);font-size:.85em}
#la-up-msg{font-size:15px;color:var(--soft);margin-top:6px}
.la-modal{position:fixed;inset:0;z-index:90;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center}
.la-modal .box{background:var(--panel);border:1px solid var(--line);border-radius:0;width:min(900px,96vw);max-height:90vh;overflow:auto;padding:16px 18px}
.la-modal label.it{display:grid;grid-template-columns:20px 110px 1fr;gap:8px;padding:6px 0;border-top:1px solid var(--line);font-size:15.5px;align-items:baseline}
#la-lang{position:fixed;top:13px;right:99px;z-index:61;width:34px;height:34px;border-radius:0;border:1px solid var(--line);background:var(--panel);color:var(--ink);font:600 11.5px var(--mono);cursor:pointer}
`;
  const st4 = document.createElement('style'); st4.textContent = css4; document.head.appendChild(st4);
  async function store(ns) { const r = await fetch('/api/store?code=' + encodeURIComponent(CODE) + '&ns=' + ns); const j = await r.json(); return j.ok ? j.docs : {}; }
  async function storePut(ns, id, obj) { const r = await fetch('/api/store', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code: CODE, ns, id, text: obj == null ? '' : JSON.stringify(obj) }) }); return r.json(); }
  const parseRecs = docs => Object.entries(docs || {}).map(([id, v]) => { try { return { id, by: v.by, ts: v.ts, ...JSON.parse(v.text) }; } catch (e) { return null; } }).filter(Boolean);
  const newId = p => (p || 'x') + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const docHref = (h, p) => (CASE.cf || '') + h + (p ? '#page=' + p : '');
  let ME = null;
  fetch('/api/auth/status', { credentials: 'same-origin' }).then(r => r.json()).then(j => { ME = j; }).catch(() => { });
  const isAdmin = () => ME && ME.role === 'admin';
  const today0 = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };

  /* ================= ASK AI WITH PAGE CITATIONS ================= */
  window.aiAsk = async function (term, box) {
    box.innerHTML = '<div class="aibox"><div class="aihdr">AI answer</div><div class="aiload">Searching the documents…</div></div>';
    let ex = [];
    try {
      await loadText();
      const hits = IDX.search(term, { combineWith: 'OR', prefix: true, fuzzy: 0.15 }).slice(0, 10);
      ex = hits.map(r => { const f = TEXT.files[r.f], c = TEXT.chunks[r.id]; return { n: f.n, p: r.p, h: f.h, t: c.t.slice(0, 1500), pdf: /\.pdf$/i.test(f.n) }; });
    } catch (e) { ex = []; }
    box.querySelector('.aiload').textContent = 'Thinking…';
    try {
      const r = await fetch('/api/ask', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code: CODE, q: term, excerpts: ex.map(x => ({ n: x.n, p: x.p, t: x.t })) }) });
      const d = await r.json();
      if (!d.ok) { box.innerHTML = `<div class="aibox"><div class="aihdr">AI</div><div class="aians">${E(d.error || 'AI unavailable.')}</div></div>`; return; }
      const used = new Set();
      const ans = E(d.answer).replace(/\[(\d{1,2})\]/g, (m, n) => { const x = ex[+n - 1]; if (!x || !x.h) return m; used.add(+n); return `<a class="cite" href="${E(docHref(x.h, x.pdf ? x.p : 0))}">[${n}]</a>`; });
      const src = [...used].sort((a, b) => a - b).map(n => { const x = ex[n - 1]; return `<div>[${n}] <a href="${E(docHref(x.h, x.pdf ? x.p : 0))}">${E(x.n)} · ${x.pdf ? 'page' : 'part'} ${x.p}</a></div>`; }).join('');
      box.innerHTML = `<div class="aibox"><div class="aihdr">AI answer</div><div class="aians ai-ans" style="white-space:pre-wrap">${ans}</div>${src ? `<div class="ai-src"><b>Sources</b>${src}</div>` : ''}<div class="aifoot">Grounded in this case file · numbers in [ ] open the page they came from · verify before relying on it</div></div>`;
    } catch (e) { box.innerHTML = '<div class="aibox"><div class="aihdr">AI</div><div class="aians">AI unavailable right now.</div></div>'; }
  };

  /* ================= PROOF MAP ================= */
  let PF = null;
  async function proofData() {
    const base = JSON.parse(JSON.stringify(CASE.proof || { note: '', claims: [] }));
    const recs = parseRecs(await store('proof'));
    recs.filter(r => r.type === 'claim').forEach(r => base.claims.push({ id: r.id, name: r.name, why: 'Added by ' + (r.by || 'someone'), elements: (r.elements || []).map((el, i) => ({ id: r.id + '-' + i, el, ev: [] })), custom: true }));
    recs.filter(r => r.type === 'link').forEach(r => { const c = base.claims.find(x => x.id === r.c); const e = c && c.elements.find(x => x.id === r.e); if (e) e.ev.push({ t: r.t, h: r.h, p: r.p, by: r.by, rid: r.id }); });
    return PF = base;
  }
  window.proofView = async function () {
    const v = document.getElementById('proof-view'); if (!v) return;
    v.innerHTML = '<h2 class="mhead">Proof map</h2><p class="mnote">Loading…</p>';
    const P = await proofData();
    const total = P.claims.reduce((a, c) => a + c.elements.length, 0), ok = P.claims.reduce((a, c) => a + c.elements.filter(e => e.ev.length).length, 0);
    v.innerHTML = `<h2 class="mhead">Proof map</h2><p class="mnote">${E(P.note || 'For each claim, what has to be shown and the pages that show it. Open any document and press “Link to proof” to add a page.')} <b>${ok} of ${total}</b> elements have proof linked.</p>` +
      P.claims.map(c => `<div class="pf-claim"><div class="la-row" style="justify-content:space-between"><h3>${E(c.name)}</h3><div class="la-row">${c.elements.every(e => e.ev.length) ? '<span class="la-pill green">all elements have proof</span>' : `<span class="la-pill red">${c.elements.filter(e => !e.ev.length).length} gap(s)</span>`}<button class="btn" data-binder="${E(c.id)}">Put this proof in a binder</button>${c.custom ? `<button class="btn" data-delclaim="${E(c.id)}">Delete</button>` : ''}</div></div>${c.why ? `<div class="la-muted">${E(c.why)}</div>` : ''}` +
        c.elements.map(e => `<div class="pf-el"><span class="pf-dot ${e.ev.length ? 'ok' : 'gap'}"></span><div><div>${E(e.el)}</div><div>${e.ev.map(x => `<span class="la-chip"><a href="${E(docHref(x.h, x.p))}" style="color:inherit;text-decoration:none">📄 ${E(x.t)}${x.p ? ' · p. ' + x.p : ''}</a>${x.rid ? `<button class="x" title="Remove this link (added by ${E(x.by || '')})" data-unlink="${E(x.rid)}">×</button>` : ''}</span>`).join('') || '<span class="la-muted">No page linked yet. Open a document and press “Link to proof”.</span>'}</div></div></div>`).join('') + '</div>').join('') +
      `<div class="la-card" style="max-width:1080px"><h3>Add a claim</h3><div class="la-row"><input id="pfname" class="la-in" style="flex:1;min-width:220px" placeholder="Claim or defense (e.g. Unjust enrichment)"></div><textarea id="pfels" class="la-in" style="width:100%;margin-top:8px;min-height:80px" placeholder="What has to be shown, one per line"></textarea><div class="la-row" style="margin-top:8px"><button class="btn pri" id="pfadd">Add claim</button><span class="la-muted">Elements are a checklist; confirm them with counsel.</span></div></div>`;
    v.querySelectorAll('[data-unlink]').forEach(b => b.onclick = async () => { await storePut('proof', b.dataset.unlink, null); window.proofView(); });
    v.querySelectorAll('[data-delclaim]').forEach(b => b.onclick = async () => { if (!confirm('Delete this claim and its links?')) return; await storePut('proof', b.dataset.delclaim, null); window.proofView(); });
    v.querySelectorAll('[data-binder]').forEach(b => b.onclick = () => {
      const c = P.claims.find(x => x.id === b.dataset.binder); const all = (CASE.files.groups || []).flatMap(g => g.items);
      c.elements.forEach(e => e.ev.forEach(x => { const it = all.find(i => i.h === x.h); if (it && /\.(pdf|jpe?g|png)$/i.test(it.h)) SEL.set(it.h, it); }));
      goTab('files');
    });
    v.querySelector('#pfadd').onclick = async () => {
      const name = v.querySelector('#pfname').value.trim(), els = v.querySelector('#pfels').value.split('\n').map(s => s.trim()).filter(Boolean);
      if (!name || !els.length) { alert('Write the claim and at least one element.'); return; }
      await storePut('proof', newId('c'), { type: 'claim', name, elements: els }); window.proofView();
    };
  };
  async function linkToProof(h, p, title) {
    const P = PF || await proofData();
    document.querySelectorAll('.la-pop').forEach(x => x.remove());
    const pop = document.createElement('div'); pop.className = 'la-pop'; pop.style.top = '70px'; pop.style.right = '20px';
    pop.innerHTML = `<div class="la-row" style="justify-content:space-between"><b>Link page ${p} to…</b><button class="btn" id="pfx">✕</button></div><div class="la-muted" style="margin:4px 0 8px">${E(title)}</div>` +
      (P.claims.length ? P.claims.map(c => `<div style="margin-top:8px;font-weight:600;font-size:13px">${E(c.name)}</div>` + c.elements.map(e => `<button class="el" data-c="${E(c.id)}" data-e="${E(e.id)}">${e.ev.length ? '🟢' : '🔴'} ${E(e.el)}</button>`).join('')).join('') : '<div class="la-muted">No claims yet. Add one in the Proof tab.</div>');
    document.body.appendChild(pop);
    pop.querySelector('#pfx').onclick = () => pop.remove();
    pop.querySelectorAll('button.el').forEach(b => b.onclick = async () => {
      const note = prompt('Short label for this page (what it shows):', title + ' · p. ' + p);
      if (note === null) return;
      await storePut('proof', newId('l'), { type: 'link', c: b.dataset.c, e: b.dataset.e, h, p, t: note || title });
      PF = null; pop.innerHTML = '<b>Linked ✓</b><div class="la-muted">It now shows in the Proof tab.</div>'; setTimeout(() => pop.remove(), 1400);
    });
  }

  /* ================= DEADLINES (Overview card + calendar) ================= */
  async function deadlineItems() {
    const st = await store('deadlines'), recs = parseRecs(st);
    const items = (CASE.deadlines || []).map((x, i) => ({ ...x, id: 'seed-' + i, seed: true }));
    recs.forEach(r => { if (r.id.startsWith('seed-')) { const s = items.find(i => i.id === r.id); if (s) s.done = !!r.done; } else items.push(r); });
    return items;
  }
  async function deadlinesCard(host) {
    const items = await deadlineItems(), t0 = today0();
    const days = d => Math.round((Date.parse(d + 'T12:00:00') - t0) / 864e5);
    const up = items.filter(x => !x.done && x.d && days(x.d) >= 0).sort((a, b) => a.d < b.d ? -1 : 1);
    const nod = items.filter(x => !x.done && !x.d);
    const past = items.filter(x => x.done || (x.d && days(x.d) < 0)).sort((a, b) => a.d < b.d ? 1 : -1);
    const row = x => { const n = x.d ? days(x.d) : null; return `<div class="dl-row ${n != null && n >= 0 && n <= 7 ? 'soon' : ''} ${x.done ? 'done' : ''}"><span class="d">${x.d ? E(new Date(x.d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })) : 'no date'}</span><span>${E(x.what)}${x.confirm ? ' <span class="la-pill amber">confirm with counsel</span>' : ''}${n != null && n >= 0 ? ` <span class="la-pill ${n <= 7 ? 'red' : ''}">${n === 0 ? 'today' : n === 1 ? 'tomorrow' : 'in ' + n + ' days'}</span>` : ''}</span><span>${x.done ? `<button class="btn" data-undo="${E(x.id)}">Undo</button>` : `<button class="btn" data-done="${E(x.id)}" title="Mark done">✓</button>`}${!x.seed ? ` <button class="btn" data-del="${E(x.id)}" title="Delete">×</button>` : ''}</span></div>`; };
    host.innerHTML = `<h3>What's due</h3>${up.map(row).join('') || '<div class="la-muted">Nothing dated ahead.</div>'}${nod.map(row).join('')}
      ${past.length ? `<details style="margin-top:8px"><summary class="la-muted" style="cursor:pointer">${past.length} passed or done</summary>${past.map(row).join('')}</details>` : ''}
      <div class="la-row" style="margin-top:10px"><input type="date" id="dld" class="la-in"><input id="dlw" class="la-in" style="flex:1;min-width:180px" placeholder="What is due"><label class="la-muted"><input type="checkbox" id="dlc"> confirm with counsel</label><button class="btn pri" id="dladd">Add date</button></div>
      <div class="la-row" style="margin-top:10px"><button class="btn" id="dlcal">📅 Put these dates in my calendar</button><span class="la-muted" id="dlcalmsg"></span></div>`;
    host.querySelectorAll('[data-done]').forEach(b => b.onclick = async () => { const x = items.find(i => i.id === b.dataset.done); await storePut('deadlines', x.id, x.seed ? { done: true } : { ...strip0(x), done: true }); deadlinesCard(host); });
    host.querySelectorAll('[data-undo]').forEach(b => b.onclick = async () => { const x = items.find(i => i.id === b.dataset.undo); await storePut('deadlines', x.id, x.seed ? { done: false } : { ...strip0(x), done: false }); deadlinesCard(host); });
    host.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => { if (!confirm('Delete this date?')) return; await storePut('deadlines', b.dataset.del, null); deadlinesCard(host); });
    host.querySelector('#dladd').onclick = async () => { const d = host.querySelector('#dld').value, w = host.querySelector('#dlw').value.trim(); if (!w) { alert('Write what is due.'); return; } await storePut('deadlines', newId('d'), { d, what: w, confirm: host.querySelector('#dlc').checked }); deadlinesCard(host); };
    host.querySelector('#dlcal').onclick = async () => {
      const r = await fetch('/api/me/calendar', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }); const j = await r.json(); if (!j.ok) return;
      host.querySelector('#dlcalmsg').innerHTML = `Subscribe to this private link in your calendar app: <code style="word-break:break-all">${E(j.link)}</code> <button class="btn" id="dlcopy">Copy</button><br>Google Calendar: Other calendars → + → From URL. iPhone: Settings → Calendar → Accounts → Add Account → Other → Add Subscribed Calendar. Outlook: Add calendar → Subscribe from web. Reminders come 3 days and 1 day before.`;
      host.querySelector('#dlcopy').onclick = () => navigator.clipboard && navigator.clipboard.writeText(j.link);
    };
  }
  const strip0 = x => { const { id, by, ts, seed, ...rest } = x; return rest; };

  /* ================= REQUESTS (lawyer ↔ client) WITH UPLOADS ================= */
  async function uploadFiles(files, opts) {
    opts = opts || {}; const msg = opts.msg || (() => { }); const out = [];
    for (const f of files) {
      msg('Uploading ' + f.name + '…');
      const q = new URLSearchParams({ code: CODE, name: f.name }); if (opts.req) q.set('req', opts.req); if (opts.done) q.set('done', '1');
      const r = await fetch('/api/upload?' + q, { method: 'POST', headers: { 'content-type': f.type || 'application/octet-stream' }, body: f });
      const j = await r.json(); if (!j.ok) { msg('Could not upload ' + f.name + ': ' + (j.error || r.status)); continue; }
      out.push(j);
      try { await indexUploaded(f, j.h, msg); } catch (e) { msg('Saved ' + f.name + ', but its text could not be read.'); }
    }
    await refreshCase();
    return out;
  }
  async function indexUploaded(file, h, msg) {
    if (isAudFile(file)) { await transcribeFile(file, h, '', msg, 20); return; } // recordings: speech to text (see AUDIO below)
    const pages = [];
    if (/pdf$/i.test(file.type) || /\.pdf$/i.test(file.name)) {
      const pj = await pdfjs(); const doc = await pj.getDocument({ data: new Uint8Array(await file.arrayBuffer()), ...PDFOPTS }).promise;
      const n = Math.min(doc.numPages, 400); let ocrWorker = null;
      for (let i = 1; i <= n; i++) {
        const pg = await doc.getPage(i); const tc = await pg.getTextContent(); let t = tc.items.map(x => x.str).join(' ').replace(/\s+/g, ' ').trim();
        if (t.length < 25 && i <= 60) { // scanned page: read it with OCR in this browser
          msg(`Reading scanned page ${i} of ${n} (OCR)…`); ocrWorker = ocrWorker || await ocr();
          const vp = pg.getViewport({ scale: 2 }); const c = document.createElement('canvas'); c.width = vp.width; c.height = vp.height;
          await pg.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise; t = (await ocrWorker.recognize(c)).data.text.replace(/\s+/g, ' ').trim();
        }
        pages.push(t); if (i % 10 === 0) msg(`Reading ${file.name}: page ${i} of ${n}…`);
      }
      if (ocrWorker) await ocrWorker.terminate();
    } else if (/^image\//.test(file.type)) {
      msg('Reading the photo (OCR)…'); const w = await ocr(); pages.push((await w.recognize(file)).data.text.replace(/\s+/g, ' ').trim()); await w.terminate();
    } else if (/^text\//.test(file.type) || /\.(txt|md|eml|csv)$/i.test(file.name)) { pages.push((await file.text()).slice(0, 200000)); }
    if (!pages.some(t => t && t.length > 3)) { msg('Saved ' + file.name + '. No readable text found.'); return; }
    await fetch('/api/text-add', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code: CODE, h, n: file.name, pages }) });
    TEXT = null; IDX = null; msg('Saved and searchable: ' + file.name);
  }
  async function ocr() {
    await loadScript('https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js');
    return Tesseract.createWorker(['eng', 'spa'], 1, { workerPath: 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/worker.min.js', corePath: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1' });
  }
  async function refreshCase() {
    try { const r = await fetch('/api/case', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code: CODE }) }); const d = await r.json(); if (d.ok) { CASE = d.case; DMAP = null; TEXT = null; IDX = null; } } catch (e) { }
  }
  window.reqView = async function () {
    const v = document.getElementById('docreqs-view'); if (!v) return;
    v.innerHTML = '<h2 class="mhead">Requests</h2><p class="mnote">Loading…</p>';
    const recs = parseRecs(await store('docreqs')).filter(r => r.ask).sort((a, b) => (a.status === 'done') - (b.status === 'done') || (a.created < b.created ? 1 : -1));
    v.innerHTML = `<h2 class="mhead">Requests</h2><p class="mnote">Ask for a document or an answer; reply with a file from your computer or your phone's camera. Everyone on this case sees the same list, and every file lands in Case files, searchable.</p>
      <div class="la-card" style="max-width:980px"><h3>New request</h3><textarea id="rqask" class="la-in" style="width:100%;min-height:64px" placeholder="What is needed (e.g. the bank statement that shows the payment)"></textarea>
      <div class="la-row" style="margin-top:8px"><label class="la-muted">Who should answer <select id="rqto" class="la-in"><option value="client">Client</option><option value="lawyer">Lawyer</option></select></label><label class="la-muted">Needed by <input type="date" id="rqdue" class="la-in"></label><button class="btn pri" id="rqadd">Send request</button></div></div>
      <div class="la-card" style="max-width:980px"><h3>Upload without a request</h3><div class="la-row"><input type="file" id="rqfree" multiple accept="application/pdf,image/*,.txt,.md,.eml,audio/*,.m4a,.amr,.3gp,.opus"><span class="la-muted">PDFs, photos or text. Photos and scans are read with OCR in your browser.</span></div><div id="la-up-msg"></div></div>
      ${recs.map(r => `<div class="rq ${r.status === 'done' ? 'done' : ''}"><div class="la-row" style="justify-content:space-between"><b>${E(r.ask)}</b><span class="la-pill ${r.status === 'done' ? 'green' : 'amber'}">${r.status === 'done' ? 'answered' : 'open'}</span></div>
        <div class="la-muted" style="margin:4px 0 6px">Asked by ${E(r.from || r.by || '')} · ${E((r.created || '').slice(0, 10))} · for the ${E(r.to || 'client')}${r.due ? ' · needed by ' + E(r.due) : ''}</div>
        <div>${(r.files || []).map(f => `<a class="la-chip" href="${E(docHref(f.h))}">📄 ${E(f.n)}</a>`).join('')}</div>
        <div class="la-row" style="margin-top:6px"><label class="btn" style="cursor:pointer">📎 Answer with a file<input type="file" data-up="${E(r.id)}" multiple accept="application/pdf,image/*" capture="environment" style="display:none"></label>${r.status === 'done' ? `<button class="btn" data-open="${E(r.id)}">Reopen</button>` : `<button class="btn" data-close="${E(r.id)}">Mark answered</button>`}<button class="btn" data-del="${E(r.id)}">Delete</button></div></div>`).join('') || '<p class="mnote">No requests yet.</p>'}`;
    const msg = t => { const m = v.querySelector('#la-up-msg'); if (m) m.textContent = t; };
    const save = (r, ch) => storePut('docreqs', r.id, { ...strip0(r), ...ch });
    v.querySelector('#rqadd').onclick = async () => { const ask = v.querySelector('#rqask').value.trim(); if (!ask) return; await storePut('docreqs', newId('r'), { ask, to: v.querySelector('#rqto').value, due: v.querySelector('#rqdue').value, status: 'open', created: new Date().toISOString(), from: ME && ME.email, files: [] }); window.reqView(); };
    v.querySelector('#rqfree').onchange = async e => { await uploadFiles([...e.target.files], { msg }); };
    v.querySelectorAll('[data-up]').forEach(inp => inp.onchange = async e => { const id = inp.dataset.up; const box = inp.closest('.rq'); const m = document.createElement('div'); m.className = 'la-muted'; box.appendChild(m); await uploadFiles([...e.target.files], { req: id, done: true, msg: t => m.textContent = t }); window.reqView(); });
    v.querySelectorAll('[data-close]').forEach(b => b.onclick = async () => { const r = recs.find(x => x.id === b.dataset.close); await save(r, { status: 'done', doneAt: new Date().toISOString() }); window.reqView(); });
    v.querySelectorAll('[data-open]').forEach(b => b.onclick = async () => { const r = recs.find(x => x.id === b.dataset.open); await save(r, { status: 'open' }); window.reqView(); });
    v.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => { if (!confirm('Delete this request? Files already uploaded stay in Case files.')) return; await storePut('docreqs', b.dataset.del, null); window.reqView(); });
  };

  /* ================= CASE FILES: upload button + "find dates & people" (added cases) ================= */
  const _filesView = window.filesView;
  window.filesView = function () {
    _filesView();
    const v = document.getElementById('files-view'); const h2 = v.querySelector('.mhead'); if (!h2) return;
    const bar = document.createElement('div'); bar.className = 'la-row'; bar.style.margin = '0 0 12px';
    bar.innerHTML = `<label class="btn pri" style="cursor:pointer">⬆ Upload documents<input type="file" id="fup" multiple accept="application/pdf,image/*,.txt,.md,.eml,audio/*,.m4a,.amr,.3gp,.opus" style="display:none"></label><span class="la-muted" id="fupmsg">PDFs, photos, text and recordings; scans are read with OCR, recordings turned into text.</span>`;
    h2.after(bar);
    bar.querySelector('#fup').onchange = async e => { await uploadFiles([...e.target.files], { msg: t => bar.querySelector('#fupmsg').textContent = t }); window.filesView(); };
    if (CASE.dynamic && isAdmin()) {
      v.querySelectorAll('#flist .frow').forEach(row => {
        const a = row.querySelector('a.plink'); const href = a && a.getAttribute('href') || ''; const i = href.indexOf('/up/'); if (i < 0) return;
        const h = decodeURIComponent(href.slice((CASE.cf || '').length).split('?')[0]);
        const b = document.createElement('button'); b.className = 'btn'; b.style.marginTop = '8px'; b.textContent = '✨ Find dates & people'; b.onclick = () => extractDoc(h); row.appendChild(b);
      });
    }
  };
  async function extractDoc(h) {
    const m = document.createElement('div'); m.className = 'la-modal'; m.innerHTML = '<div class="box"><b>Reading the document…</b><div class="la-muted">This takes a few seconds.</div></div>'; document.body.appendChild(m);
    m.onclick = e => { if (e.target === m) m.remove(); };
    const r = await fetch('/api/extract', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code: CODE, h }) }); const j = await r.json();
    if (!j.ok) { m.querySelector('.box').innerHTML = `<b>Could not read it</b><div class="la-muted">${E(j.error || '')}</div><button class="btn" id="mx">Close</button>`; m.querySelector('#mx').onclick = () => m.remove(); return; }
    const it = (k, i, a, b) => `<label class="it"><input type="checkbox" data-k="${k}" data-i="${i}" checked><span class="la-muted">${E(a)}</span><span>${E(b)}</span></label>`;
    m.querySelector('.box').innerHTML = `<div class="la-row" style="justify-content:space-between"><b>Found in ${E(j.doc)}</b><button class="btn" id="mx">✕</button></div><p class="la-muted">Untick anything wrong, then add the rest. Nothing is added until you press the button. Check each item against the page.</p>
      <h3 style="font-size:13px;margin:12px 0 4px">Dates (${j.events.length})</h3>${j.events.map((e, i) => it('events', i, (e.date || '') + (e.page ? ' · p.' + e.page : ''), e.what)).join('') || '<div class="la-muted">None.</div>'}
      <h3 style="font-size:13px;margin:12px 0 4px">People (${j.people.length})</h3>${j.people.map((p, i) => it('people', i, p.name, p.role)).join('') || '<div class="la-muted">None.</div>'}
      <h3 style="font-size:13px;margin:12px 0 4px">Money (${j.money.length})</h3>${j.money.map((x, i) => it('money', i, x.amount + (x.page ? ' · p.' + x.page : ''), x.what)).join('') || '<div class="la-muted">None.</div>'}
      <div class="la-row" style="margin-top:12px"><button class="btn pri" id="madd">Add the ticked items to this case</button><span class="la-muted" id="mmsg"></span></div>`;
    m.querySelector('#mx').onclick = () => m.remove();
    m.querySelector('#madd').onclick = async () => {
      const pick = k => [...m.querySelectorAll(`input[data-k="${k}"]:checked`)].map(x => j[k][+x.dataset.i]);
      const ev = pick('events').map(e => ({ d: e.date, t: e.what, s: j.doc + (e.page ? ' p.' + e.page : ''), u: docHref(h, e.page) }));
      const post = b => fetch('/api/case-edit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code: CODE, ...b }) }).then(r => r.json());
      if (ev.length) await post({ op: 'addEvents', events: ev });
      const pp = pick('people'); if (pp.length) await post({ op: 'addPeople', people: pp });
      const mm = pick('money'); if (mm.length) await post({ op: 'addMoney', money: mm.map(x => ({ amount: x.amount, what: x.what + (x.page ? ' (' + j.doc + ' p.' + x.page + ')' : '') })) });
      m.querySelector('#mmsg').textContent = 'Added ✓'; await refreshCase(); setTimeout(() => { m.remove(); if (window.openCase) { openCase(); } }, 700);
    };
  }

  /* ================= VIEWER: "Link to proof" button ================= */
  const _openDoc = openDoc;
  window.openDoc = openDoc = async function (h, page, title, drive) {
    await _openDoc(h, page, title, drive);
    const bar = document.querySelector('#docv .dbar'); if (!bar || bar.querySelector('#dvlink')) return;
    const b = document.createElement('button'); b.className = 'btn'; b.id = 'dvlink'; b.textContent = '🔗 Link to proof';
    b.onclick = () => { if (!DV) return; linkToProof(DV.h, DV.doc ? DV.page : 1, (fileInfo(DV.h) || {}).t || DV.h.split('/').pop()); };
    bar.insertBefore(b, bar.querySelector('#dvo'));
  };

  /* ================= OVERVIEW additions: what's due, getting started for new cases ================= */
  const _homeView = window.homeView;
  window.homeView = function () {
    _homeView();
    const v = document.getElementById('home-view'); const hv = v && v.querySelector('.hv'); if (!hv) return;
    const stats = hv.querySelector('.hv-stats');
    const due = document.createElement('div'); due.className = 'la-card'; due.style.maxWidth = '1180px'; due.innerHTML = '<h3>What\'s due</h3><div class="la-muted">Loading…</div>';
    (stats || hv.firstChild).after(due); deadlinesCard(due);
    if (CASE.dynamic) {
      const n = (CASE.timeline || []).reduce((a, p) => a + p.events.length, 0);
      if (!n) { const g = document.createElement('div'); g.className = 'la-card'; g.style.maxWidth = '1180px'; g.innerHTML = `<h3>Getting started</h3><ol style="margin:0 0 0 18px;line-height:1.8;font-size:13.5px"><li>Open <b>Case files</b> and press <b>Upload documents</b> (PDFs or phone photos).</li><li>On each uploaded document, press <b>✨ Find dates & people</b>, check what it found, and add it.</li><li>The timeline, people, money and search fill in as you go. Add claims in <b>Proof</b> and dates in <b>What's due</b>.</li><li>Invite your lawyer from <a href="/admin" style="color:var(--accent)">Admin</a>.</li></ol>`; due.after(g); }
    }
  };

  /* ================= ADDED 5 NOV 2026: file fingerprints · email into the case · citation checks ================= */
  const css5 = `
.la-tag{display:inline-block;font-size:13.5px;line-height:1.5;padding:1px 7px;margin:10px 0 0 4px;border:1px solid var(--line);white-space:nowrap;flex:none}
.la-tag.ok{background:rgba(0,112,60,.12);border-color:#00703c}
.la-tag.bad{background:rgba(212,53,28,.14);border-color:var(--block);font-weight:700}
.la-tag.grey{color:var(--soft)}
.mi-addr{font-family:var(--mono);font-size:15px;word-break:break-all;background:var(--panel2);border:1px solid var(--line);padding:6px 9px;flex:1;min-width:0}
.ct-table{width:100%;max-width:1080px;border-collapse:collapse;font-size:15.5px;margin-top:6px}
.ct-table th,.ct-table td{border-top:1px solid var(--line);padding:9px 8px;text-align:left;vertical-align:top}
.ct-table th{font-size:14px;color:var(--soft);font-weight:700}
.ct-table td a{color:var(--accent)}
.ct-table .la-pill{display:inline-block;margin:0 0 4px}
@media(max-width:700px){.ct-table thead{display:none}.ct-table tr{display:block;border-top:1px solid var(--line);padding:6px 0}.ct-table td{display:block;border:0;padding:3px 0}}
`;
  const st5 = document.createElement('style'); st5.textContent = css5; document.head.appendChild(st5);
  const postJ = (u, b) => fetch(u, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) }).then(r => r.json());
  const dayFmt = t => { if (!t) return ''; try { return new Date(t).toLocaleDateString(document.documentElement.lang === 'es' ? 'es-US' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' }); } catch (e) { return String(t).slice(0, 10); } };
  function hexOf(buf) { return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join(''); }
  async function evidenceList() { try { const j = await fetch('/api/evidence?code=' + encodeURIComponent(CODE)).then(r => r.json()); return j.ok ? j : { items: [], files: 0 }; } catch (e) { return { items: [], files: 0 }; } }
  function rowH(row) {
    const a = row.querySelector('a.plink'); const href = (a && a.getAttribute('href')) || '';
    if (!CASE.cf || !href.startsWith(CASE.cf)) return null;
    const raw = href.slice(CASE.cf.length).split('?')[0]; try { return decodeURIComponent(raw); } catch (e) { return raw; }
  }

  /* ---- File fingerprints ---- */
  let FPRES = {};
  function paintRows() {
    document.querySelectorAll('#flist .frow').forEach(row => {
      const h = rowH(row), x = h && FPRES[h]; if (!x) return;
      let t = row.querySelector('.la-tag'); if (!t) { t = document.createElement('span'); row.appendChild(t); }
      if (x.status === 'same') { t.className = 'la-tag ok'; t.textContent = (x.recorded ? 'Fingerprint recorded ' : 'Unchanged since ') + dayFmt(x.first); t.title = 'SHA-256 ' + x.sha; }
      else if (x.status === 'changed') { t.className = 'la-tag bad'; t.textContent = 'CHANGED since ' + dayFmt(x.first); t.title = 'First recorded ' + x.was + '\nNow ' + x.sha; }
      else if (x.status === 'new') { t.className = 'la-tag grey'; t.textContent = 'No fingerprint yet'; }
      else { t.className = 'la-tag grey'; t.textContent = 'Could not read'; }
    });
  }
  async function fpCard(host) {
    host.innerHTML = '<h3>File fingerprints</h3><div class="la-muted">Loading…</div>';
    const ev = await evidenceList(); const firsts = ev.items.map(x => x.ts).sort();
    host.innerHTML = `<h3>File fingerprints</h3>
      <p class="la-muted" style="margin:0 0 8px">Every file gets a fingerprint (a SHA-256 code) when it comes into the case. If one letter of a file changes, its fingerprint changes. Checking shows each file is the same as when it came in.</p>
      <div class="la-row"><button class="btn pri" id="fpall">Check all files</button><span class="la-muted" id="fpmsg">${ev.items.length} of ${ev.files} files have a fingerprint${firsts.length ? ', the first recorded ' + E(dayFmt(firsts[0])) : ''}.</span></div><div id="fprec"></div>`;
    host.querySelector('#fpall').onclick = () => checkAll(host, false);
  }
  async function checkAll(host, record) {
    const msg = host.querySelector('#fpmsg'), btn = host.querySelector('#fpall'), recBox = host.querySelector('#fprec');
    const hs = [...new Set([...document.querySelectorAll('#flist .frow')].map(rowH).filter(Boolean))];
    if (!hs.length) { msg.textContent = 'Clear the filter first, then check.'; return; }
    btn.disabled = true; recBox.innerHTML = '';
    for (let i = 0; i < hs.length; i += 6) {
      msg.textContent = `Checking ${Math.min(i + 6, hs.length)} of ${hs.length}…`;
      const j = await postJ('/api/evidence/check', { code: CODE, hs: hs.slice(i, i + 6), record }).catch(() => ({ ok: false }));
      (j.results || []).forEach(x => { FPRES[x.h] = x; }); paintRows();
    }
    const all = hs.map(h => FPRES[h]).filter(Boolean), cnt = s => all.filter(x => x.status === s).length;
    const same = cnt('same'), changed = cnt('changed'), none = cnt('new'), bad = all.length - same - changed - none;
    msg.textContent = (changed ? `${changed} file(s) CHANGED since their fingerprint was recorded. ` : '') + `${same} unchanged.` + (none ? ` ${none} have no fingerprint yet.` : '') + (bad ? ` ${bad} could not be read.` : '');
    if (none && isAdmin() && !record) { recBox.innerHTML = `<div class="la-row" style="margin-top:8px"><button class="btn" id="fprecb">Record fingerprints for the ${none} without one</button><span class="la-muted">They are recorded as they are today.</span></div>`; recBox.querySelector('#fprecb').onclick = () => checkAll(host, true); }
    btn.disabled = false;
  }

  /* ---- Email into the case ---- */
  async function mailCard(host) {
    host.innerHTML = '<h3>Email into this case</h3><div class="la-muted">Loading…</div>';
    const j = await fetch('/api/mailin?code=' + encodeURIComponent(CODE)).then(r => r.json()).catch(() => ({ ok: false }));
    if (!j.ok) { host.innerHTML = '<h3>Email into this case</h3><div class="la-muted">Not available right now.</div>'; return; }
    const line = (label, addr, which) => `<div style="margin-top:12px"><div style="font-weight:700;margin-bottom:4px">${label}</div><div class="la-row"><span class="mi-addr">${E(addr)}</span><button class="btn" data-copy="${E(addr)}">Copy</button>${j.senders ? `<button class="btn" data-rot="${which}" title="Make a new address; the old one stops working">New address</button>` : ''}</div></div>`;
    host.innerHTML = `<h3>Email into this case</h3>
      <p class="la-muted" style="margin:0">Forward an email to an address below. The email, its attachments and its date land in this case: under “Emailed in” in this list, and on the Timeline. Email from anyone who is not on the case is turned away. Keep these addresses private.</p>
      ${line('Shared with your lawyer', j.shared, 'shared')}${j.owner ? line('Only you (your lawyer does not see these)', j.owner, 'owner') : ''}
      ${j.senders ? `<div style="margin-top:14px"><div style="font-weight:700;margin-bottom:4px">Also take email from</div><div class="la-muted" style="margin-bottom:6px">Your login (${E(j.me || '')}) always works. Add the other addresses you forward from, one per line.</div><textarea id="misend" class="la-in" style="width:100%;max-width:560px;min-height:64px">${E((j.senders || []).join('\n'))}</textarea><div class="la-row" style="margin-top:6px"><button class="btn" id="misave">Save</button><span class="la-muted" id="mimsg"></span></div></div>` : ''}`;
    host.querySelectorAll('[data-copy]').forEach(b => b.onclick = () => { (navigator.clipboard ? navigator.clipboard.writeText(b.dataset.copy) : Promise.reject()).then(() => { const o = b.textContent; b.textContent = 'Copied ✓'; setTimeout(() => { b.textContent = o; }, 1500); }).catch(() => prompt('Copy this address:', b.dataset.copy)); });
    host.querySelectorAll('[data-rot]').forEach(b => b.onclick = async () => { if (!confirm('Make a new address? The old one stops working right away.')) return; await postJ('/api/mailin', { code: CODE, op: 'rotate', which: b.dataset.rot }); mailCard(host); });
    const sv = host.querySelector('#misave');
    if (sv) sv.onclick = async () => { const list = host.querySelector('#misend').value.split(/[\s,;]+/).filter(Boolean); const r = await postJ('/api/mailin', { code: CODE, op: 'senders', senders: list }).catch(() => ({ ok: false })); host.querySelector('#mimsg').textContent = r.ok ? 'Saved ✓ (' + r.senders.length + ')' : (r.error || 'Could not save.'); if (r.ok) host.querySelector('#misend').value = r.senders.join('\n'); };
  }
  // Files that arrived by email are read (PDF text, or OCR for scans and photos) the next time Case files is open.
  let IDXING = false;
  async function indexPending(msg) {
    if (IDXING) return;
    const items = ((CASE.files || {}).groups || []).flatMap(g => g.items).filter(x => x.x && x.h); if (!items.length) return;
    IDXING = true; const say = t => { if (msg && msg.isConnected) msg.textContent = t; };
    for (const it of items) {
      try {
        say('Reading a file that came by email: ' + it.t + '…');
        const blob = await fetch(cf(it.h)).then(r => { if (!r.ok) throw new Error(r.status); return r.blob(); });
        await indexUploaded(new File([blob], it.t, { type: blob.type }), it.h, say);
        await postJ('/api/text-add', { code: CODE, h: it.h, n: it.t, pages: [] });
      } catch (e) { }
    }
    IDXING = false; await refreshCase(); say('Emailed files are searchable.');
  }
  const _filesView3 = window.filesView;
  window.filesView = function () {
    _filesView3();
    const v = document.getElementById('files-view'), m = v.querySelector('#fupmsg'), anchor = (m && m.closest('.la-row')) || v.querySelector('.mhead'); if (!anchor) return;
    const mc = document.createElement('div'); mc.className = 'la-card'; mc.style.maxWidth = '980px';
    const fc = document.createElement('div'); fc.className = 'la-card'; fc.style.maxWidth = '980px';
    anchor.after(mc); mc.after(fc); mailCard(mc); fpCard(fc);
    const ff = document.getElementById('ffilter'); if (ff) ff.addEventListener('input', () => setTimeout(paintRows, 0));
    paintRows(); if (m) indexPending(m);
  };

  /* ---- Check citations ---- */
  let CT_LAST = null, CT_CODE = null;
  window.citesView = async function () {
    const v = document.getElementById('cites-view'); if (!v) return;
    if (CT_CODE !== CODE) { CT_LAST = null; CT_CODE = CODE; }
    v.innerHTML = `<h2 class="mhead">Check citations</h2>
      <p class="mnote">Paste a brief, motion or letter, or pick a document from this case. Each court case it cites is looked up on CourtListener (Free Law Project) to see that it exists and that the case name matches. Only the citations are sent to CourtListener, never the rest of the text.</p>
      <div class="la-card" style="max-width:1080px"><textarea id="ctx" class="la-in" style="width:100%;min-height:150px" placeholder="Paste the text with the citations here"></textarea>
        <div class="la-row" style="margin-top:8px"><button class="btn pri" id="ctgo">Check citations</button></div>
        <div class="la-row" style="margin-top:12px"><span class="la-muted">Or check a document in this case:</span><select id="ctdoc" class="la-in" style="max-width:100%;min-width:0;flex:1"><option value="">Loading documents…</option></select><button class="btn" id="ctdocgo">Check this document</button></div></div>
      <div id="ctout"></div>
      <p class="mnote" style="margin-top:16px">A case that is found can still be overruled, or may not say what the text says it does. Reading the case is your lawyer's job. Statutes and rules are not checked here.</p>`;
    const out = v.querySelector('#ctout');
    const run = async body => { out.innerHTML = '<p class="mnote">Checking…</p>'; CT_LAST = await postJ('/api/cite-check', { code: CODE, ...body }).catch(() => ({ ok: false, error: 'Network error. Try again.' })); drawCites(out, CT_LAST); };
    v.querySelector('#ctgo').onclick = () => { const t = v.querySelector('#ctx').value.trim(); if (t) run({ text: t }); };
    v.querySelector('#ctdocgo').onclick = () => { const h = v.querySelector('#ctdoc').value; if (h) run({ h }); };
    if (CT_LAST) drawCites(out, CT_LAST);
    try { await loadText(); const sel = v.querySelector('#ctdoc'); sel.innerHTML = '<option value="">Pick a document</option>' + TEXT.files.map(f => `<option value="${E(f.h)}">${E(f.n)}</option>`).join(''); }
    catch (e) { v.querySelector('#ctdoc').innerHTML = '<option value="">No readable documents yet</option>'; }
  };
  function drawCites(out, j) {
    if (!j || !j.ok) { out.innerHTML = `<div class="la-card" style="max-width:1080px"><b>Could not check</b><div class="la-muted">${E((j && j.error) || '')}</div></div>`; return; }
    if (!j.cites.length) { out.innerHTML = '<p class="mnote">No court case citations found in that text.</p>'; return; }
    const S = { found: ['Found', 'green'], several: ['Found, more than one match', 'amber'], not_found: ['NOT FOUND', 'red'], bad: ['Does not fit that reporter', 'red'], not_case: ['Not checked: not read as a case citation', 'amber'], not_checked: ['Not checked yet', 'amber'], limit: ['Not checked: wait a minute, then check again', 'amber'], error: ['Not checked', 'amber'] };
    const n = k => j.cites.filter(c => c.status === k).length, differ = j.cites.filter(c => c.nameCheck === 'differs').length;
    const head = j.needsToken
      ? `<div class="la-card" style="max-width:1080px"><b>Citation checks are not switched on yet.</b><div class="la-muted">${isAdmin() ? 'Add a free CourtListener token in <a href="/admin#settings" style="color:var(--accent)">Admin, Settings</a>.' : 'Ask the case owner to switch them on.'} Until then, each citation below opens on CourtListener so you can check it by hand.</div></div>`
      : `<p class="mnote">${j.cites.length} citation${j.cites.length > 1 ? 's' : ''}: ${n('found') + n('several')} found${n('not_found') + n('bad') ? `, <b>${n('not_found') + n('bad')} not found</b>` : ''}${differ ? `, <b>${differ} with a name that does not match</b>` : ''}.</p>`;
    out.innerHTML = head + `<table class="ct-table"><thead><tr><th>Citation</th><th>Case name in the text</th><th>Result</th></tr></thead><tbody>` + j.cites.map(c => {
      const s = S[c.status] || S.error;
      const nm = c.nameCheck === 'differs' ? '<div><span class="la-pill red">Name does not match</span></div>' : c.nameCheck === 'match' ? '<div><span class="la-pill green">Name matches</span></div>' : '';
      const cases = (c.cases || []).map(k => `<div><a href="${E(k.url)}" target="_blank" rel="noopener" data-noview>${E(k.name)}${k.date ? ' (' + E(String(k.date).slice(0, 4)) + ')' : ''} ↗</a></div>`).join('');
      return `<tr><td><a href="${E(c.link)}" target="_blank" rel="noopener" data-noview>${E(c.cite)} ↗</a></td><td>${E(c.name || '—')}</td><td><span class="la-pill ${s[1]}">${E(s[0])}</span>${nm}${cases}${c.msg && c.status !== 'found' ? `<div class="la-muted">${E(c.msg)}</div>` : ''}</td></tr>`;
    }).join('') + '</tbody></table>';
  }

  /* ================= ADDED 5 NOV 2026 (late): search by meaning · recordings to text · read aloud · talk ================= */
  const css6 = `
#la-say,#la-mic{position:fixed;top:14px;z-index:61;width:32px;height:32px;border:2px solid #fff;border-radius:0;background:transparent;color:#fff;font-size:15px;line-height:1;cursor:pointer;display:none;place-items:center;padding:0}
#la-say{right:143px}#la-mic{right:181px}
#la-say:hover,#la-mic:hover{background:#fff;color:#0b0c0c}
#la-say.on,#la-mic.on{background:var(--focus,#ffdd00);color:#0b0c0c;border-color:var(--focus,#ffdd00)}
#la-say:focus-visible,#la-mic:focus-visible{background:var(--focus);color:#0b0c0c;border-color:var(--focus);outline:none}
body.la-open header{padding-right:225px}
@media(max-width:760px){body.la-open header{padding-right:140px}#la-say,#la-mic{top:auto;bottom:16px;left:16px;right:auto;width:48px;height:48px;font-size:21px;background:var(--panel);color:var(--ink);border:2px solid var(--ink);box-shadow:0 2px 10px rgba(0,0,0,.25)}#la-mic{left:72px}}
#la-voicebar{position:fixed;left:50%;transform:translateX(-50%);bottom:18px;z-index:95;background:var(--panel);color:var(--ink);border:2px solid var(--ink);padding:8px 10px;display:flex;gap:8px;align-items:center;font-size:16px;box-shadow:0 4px 18px rgba(0,0,0,.3);max-width:calc(100vw - 24px)}
#la-voicebar .t{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:min(520px,60vw)}
.aud-item{border:1px solid var(--line);background:var(--panel);padding:12px 14px;margin:0 0 12px;max-width:980px}
.aud-item audio{width:100%;margin:8px 0}
.aud-item .trans{max-height:38vh}
`;
  const st6 = document.createElement('style'); st6.textContent = css6; document.head.appendChild(st6);
  const AUD_RE = /\.(mp3|m4a|wav|ogg|oga|opus|webm|aac|amr|3gp|flac|wma|caf)$/i;
  const isAud = h => AUD_RE.test(String(h || '').split('?')[0]);
  function isAudFile(f) { return /^audio\//i.test(f.type || '') || AUD_RE.test(f.name || ''); }
  const hms2 = s => { s = Math.max(0, Math.floor(s || 0)); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60; return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(x).padStart(2, '0'); };
  const partWord = (f, p) => /\.pdf$/i.test(f.n) ? 'page ' + p : isAud(f.h) ? 'minute ' + p : 'part ' + p;

  /* ---- Search by meaning: pages close to a question, also across English and Spanish (server: /api/meaning) ---- */
  async function meaningHits(q, k) {
    let j; try { j = await postJ('/api/meaning', { code: CODE, q, k: k || 12 }); } catch (e) { return []; }
    if (!j || !j.ok) return [];
    try { await loadText(); } catch (e) { return []; }
    if (!TEXT.__hp) { TEXT.__hp = new Map(); TEXT.chunks.forEach((c, i) => { const f = TEXT.files[c.f]; if (f && f.h) TEXT.__hp.set(f.h + '#' + c.p, i); }); }
    const out = [];
    (j.hits || []).forEach(x => { let id = null; if (x.i != null) { if (j.staticChunks && j.staticChunks === TEXT.__sn) id = x.i; } else id = TEXT.__hp.get(x.h + '#' + x.p); if (id != null && TEXT.chunks[id]) out.push({ id, s: x.s }); });
    return out;
  }
  // Ask AI: the pages that match the words AND the pages close in meaning, merged (reciprocal rank fusion).
  window.aiAsk = async function (term, box) {
    box.innerHTML = '<div class="aibox"><div class="aihdr">AI answer</div><div class="aiload">Searching the documents…</div></div>';
    let ex = [];
    try {
      await loadText();
      const kw = IDX.search(term, { combineWith: 'OR', prefix: true, fuzzy: 0.15 }).slice(0, 15).map(r => r.id);
      const mn = (await meaningHits(term, 15)).map(x => x.id);
      const score = new Map(); [kw, mn].forEach(list => list.forEach((id, r) => score.set(id, (score.get(id) || 0) + 1 / (60 + r))));
      ex = [...score].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([id]) => { const c = TEXT.chunks[id], f = TEXT.files[c.f]; return { n: f.n, p: c.p, h: f.h, t: c.t.slice(0, 1500), pdf: /\.pdf$/i.test(f.n), aud: isAud(f.h), f }; });
    } catch (e) { ex = []; }
    box.querySelector('.aiload').textContent = 'Thinking…';
    try {
      const r = await fetch('/api/ask', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code: CODE, q: term, excerpts: ex.map(x => ({ n: x.n, p: x.p, t: x.t })) }) });
      const d = await r.json();
      if (!d.ok) { box.innerHTML = `<div class="aibox"><div class="aihdr">AI</div><div class="aians">${E(d.error || 'AI unavailable.')}</div></div>`; return; }
      const used = new Set(), href = x => docHref(x.h, x.pdf || x.aud ? x.p : 0);
      const ans = E(d.answer).replace(/\[(\d{1,2})\]/g, (m, n) => { const x = ex[+n - 1]; if (!x || !x.h) return m; used.add(+n); return `<a class="cite" href="${E(href(x))}">[${n}]</a>`; });
      const src = [...used].sort((a, b) => a - b).map(n => { const x = ex[n - 1]; return `<div>[${n}] <a href="${E(href(x))}">${E(x.n)} · ${partWord(x.f, x.p)}</a></div>`; }).join('');
      box.innerHTML = `<div class="aibox"><div class="aihdr">AI answer</div><div class="aians ai-ans" style="white-space:pre-wrap">${ans}</div>${src ? `<div class="ai-src"><b>Sources</b>${src}</div>` : ''}<div class="la-row" style="margin-top:8px"><button class="btn" data-sayans>🔊 Read the answer</button></div><div class="aifoot">Grounded in this case file · pages found by their words and by their meaning (English or Spanish) · numbers in [ ] open the page they came from · verify before relying on it</div></div>`;
      box.querySelector('[data-sayans]').onclick = () => say(d.answer);
    } catch (e) { box.innerHTML = '<div class="aibox"><div class="aihdr">AI</div><div class="aians">AI unavailable right now.</div></div>'; }
  };

  /* ---- Recordings to text: decoded in this browser, sent 2 minutes at a time to /api/transcribe (Whisper) ---- */
  async function decode16k(blob) {
    const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    const ab = await new OAC(1, 16000, 16000).decodeAudioData(await blob.arrayBuffer()); // resampled to 16 kHz
    const n = ab.length, k = ab.numberOfChannels, out = new Float32Array(n);
    for (let c = 0; c < k; c++) { const d = ab.getChannelData(c); for (let i = 0; i < n; i++) out[i] += d[i] / k; }
    return out;
  }
  function wavB64(pcm) {
    const n = pcm.length, buf = new ArrayBuffer(44 + n * 2), dv = new DataView(buf);
    const w = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
    w(0, 'RIFF'); dv.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
    dv.setUint32(24, 16000, true); dv.setUint32(28, 32000, true); dv.setUint16(32, 2, true); dv.setUint16(34, 16, true); w(36, 'data'); dv.setUint32(40, n * 2, true);
    for (let i = 0; i < n; i++) { const s = Math.max(-1, Math.min(1, pcm[i])); dv.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true); }
    return new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(',')[1]); fr.onerror = rej; fr.readAsDataURL(new Blob([buf], { type: 'audio/wav' })); });
  }
  // Cut about every 2 minutes, at the quietest moment of the 8 seconds before, so words are not split.
  function cutPoints(pcm, sec) {
    const SR = 16000, cuts = [0];
    while (cuts[cuts.length - 1] + sec * SR < pcm.length - SR * 5) {
      const target = cuts[cuts.length - 1] + sec * SR; let best = target, bestE = Infinity;
      for (let s = target - SR * 8; s <= target; s += 1600) { let e = 0; for (let i = s; i < s + 4800; i++) e += pcm[i] * pcm[i]; if (e < bestE) { bestE = e; best = s + 2400; } }
      cuts.push(best);
    }
    cuts.push(pcm.length); return cuts;
  }
  async function transcribePcm(pcm, lang, onProgress) {
    const cuts = cutPoints(pcm, 120), parts = []; for (let i = 0; i < cuts.length - 1; i++) parts.push([cuts[i], cuts[i + 1]]);
    const res = new Array(parts.length); let done = 0, next = 0, failed = 0;
    const one = async i => {
      const [a, b] = parts[i], b64 = await wavB64(pcm.subarray(a, b));
      for (let t = 0; t < 2; t++) {
        try { const r = await fetch('/api/transcribe?code=' + encodeURIComponent(CODE) + (lang ? '&lang=' + lang : ''), { method: 'POST', headers: { 'content-type': 'text/plain' }, body: b64 }); const j = await r.json(); if (j.ok) { res[i] = { off: a / 16000, j }; return; } } catch (e) { }
      }
      res[i] = { off: a / 16000, end: b / 16000, fail: true }; failed++;
    };
    const worker = async () => { while (next < parts.length) { const i = next++; await one(i); done++; if (onProgress) onProgress(done, parts.length); } };
    await Promise.all([worker(), worker(), worker()]);
    const lines = [], langs = {};
    res.forEach(r => {
      if (r.fail) { lines.push([r.off, '[this part could not be heard: ' + hms2(r.off) + ' to ' + hms2(r.end) + ']']); return; }
      if (r.j.lang) langs[r.j.lang] = (langs[r.j.lang] || 0) + 1;
      const segs = r.j.segments && r.j.segments.length ? r.j.segments : (r.j.text ? [{ start: 0, text: r.j.text }] : []);
      segs.forEach(s => lines.push([Math.round((r.off + (s.start || 0)) * 10) / 10, s.text]));
    });
    return { lines, duration: pcm.length / 16000, lang: Object.entries(langs).sort((a, b) => b[1] - a[1]).map(x => x[0])[0] || lang || '', failed, parts: parts.length };
  }
  let TX = null;
  async function txLoad() { if (TX) return TX; try { const j = await fetch('/api/transcript?code=' + encodeURIComponent(CODE)).then(r => r.json()); TX = j.ok ? j.items : {}; } catch (e) { TX = {}; } return TX; }
  // maxMin: longer recordings are left for the Transcribe button on the Audio tab.
  async function transcribeFile(blob, h, lang, msg, maxMin) {
    const sayM = t => { try { msg && msg(t); } catch (e) { } };
    sayM('Getting the recording ready…');
    let pcm; try { pcm = await decode16k(blob); } catch (e) { sayM('Saved. This recording could not be opened in this browser to make a transcript; try Chrome or Edge on a computer.'); return null; }
    const mins = pcm.length / 16000 / 60;
    if (maxMin && mins > maxMin) { sayM(`Saved. It is ${Math.round(mins)} minutes long: open the Audio tab and press Transcribe.`); return null; }
    if (mins > 180) { sayM('This recording is over 3 hours. Split it into parts first.'); return null; }
    const r = await transcribePcm(pcm, lang, (d, n) => sayM(`Turning speech into text: part ${d} of ${n} (${Math.max(1, Math.round(mins))} min in all)…`));
    pcm = null;
    if (!r.lines.length) { sayM('No speech was heard in this recording.'); return null; }
    const j = await postJ('/api/transcript', { code: CODE, h, lines: r.lines, duration: r.duration, lang: r.lang }).catch(() => ({ ok: false }));
    if (!j.ok) { sayM('Could not save the transcript' + (j.error ? ': ' + j.error : '.')); return null; }
    TEXT = null; IDX = null; TX = null;
    sayM('Transcript saved' + (r.failed ? ` (${r.failed} of ${r.parts} parts could not be heard)` : '') + '. It is searchable now.');
    return r;
  }
  function audioItems() { return ((CASE.files || {}).groups || []).flatMap(g => (g.items || []).map(it => Object.assign({}, it, { g: g.group }))).filter(it => it.h && it.h.startsWith('up/') && isAud(it.h)); }
  window.laHasAudio = () => !!CASE && audioItems().length > 0;
  async function recordingsSection(v) {
    let sec = v.querySelector('#aud-more'); if (!sec) { sec = document.createElement('div'); sec.id = 'aud-more'; v.appendChild(sec); }
    const items = audioItems(), tx = await txLoad();
    sec.innerHTML = `<h2 class="mhead" style="margin-top:${CASE.audio ? 30 : 0}px">Recordings</h2>
      <p class="mnote">Voicemails, calls and hearings you upload or email in. Press Transcribe to turn the speech into text with times (English or Spanish). The text becomes searchable and Ask AI can quote it. It is machine-made: listen to the recording before relying on a line.</p>
      <div class="la-row" style="margin:0 0 14px"><label class="btn pri" style="cursor:pointer">⬆ Upload a recording<input type="file" id="audup" multiple accept="audio/*,.m4a,.amr,.3gp,.opus,.webm" style="display:none"></label><span class="la-muted" id="audupmsg"></span></div>` +
      (items.length ? items.map((it, i) => {
        const t = tx[it.h];
        return `<div class="aud-item"><div class="la-row" style="justify-content:space-between"><b>${E(it.t)}</b><span class="la-muted">${E(it.d || '')}</span></div>
          <audio controls preload="none" src="${E(cf(it.h))}" data-a="${i}"></audio>
          <div class="la-row"><button class="btn${t ? '' : ' pri'}" data-tx="${i}">${t ? 'Transcribe again' : 'Transcribe'}</button><select class="la-in" data-lang="${i}" title="Language spoken"><option value="">Language: work it out</option><option value="en"${t && t.lang === 'en' ? ' selected' : ''}>English</option><option value="es"${t && t.lang === 'es' ? ' selected' : ''}>Spanish</option></select><span class="la-muted" data-msg="${i}">${t ? `${t.lines.length} lines · ${hms2(t.duration)} long · made ${E(dayFmt(t.ts))}` : 'No transcript yet.'}</span></div>
          ${t ? `<div class="la-row" style="margin-top:8px"><input class="inp" data-q="${i}" placeholder="Search this transcript…" style="max-width:420px"><button class="btn" data-sayt="${i}">🔊 Read it</button></div><div class="trans" data-tr="${i}" style="margin-top:8px">${t.lines.map(l => `<div data-t="${l[0]}"><b>${hms2(l[0])}</b>${E(l[1])}</div>`).join('')}</div>` : ''}</div>`;
      }).join('') : '<p class="mnote">No recordings yet.</p>');
    const up = sec.querySelector('#audup');
    up.onchange = async e => { await uploadFiles([...e.target.files], { msg: t => { const m = sec.querySelector('#audupmsg'); if (m) m.textContent = t; } }); TX = null; window.audioView(); };
    sec.querySelectorAll('[data-tx]').forEach(b => b.onclick = async () => {
      const i = +b.dataset.tx, it = items[i], m = sec.querySelector(`[data-msg="${i}"]`), lang = sec.querySelector(`[data-lang="${i}"]`).value;
      if (tx[it.h] && !confirm('Make a new transcript? It replaces the one there now.')) return;
      sec.querySelectorAll('[data-tx]').forEach(x => x.disabled = true);
      m.textContent = 'Fetching the recording…';
      try { const blob = await fetch(cf(it.h)).then(r => { if (!r.ok) throw new Error(r.status); return r.blob(); }); await transcribeFile(blob, it.h, lang, t => { m.textContent = t; }, 0); }
      catch (e) { m.textContent = 'Could not fetch the recording.'; }
      sec.querySelectorAll('[data-tx]').forEach(x => x.disabled = false);
      if (TX === null) recordingsSection(v);
    });
    sec.querySelectorAll('[data-tr]').forEach(box => box.onclick = e => { const r = e.target.closest('[data-t]'); const a = sec.querySelector(`audio[data-a="${box.dataset.tr}"]`); if (r && a) { a.currentTime = +r.dataset.t; a.play(); } });
    sec.querySelectorAll('[data-q]').forEach(inp => inp.oninput = () => { const q = norm(inp.value.trim()); sec.querySelectorAll(`[data-tr="${inp.dataset.q}"] div`).forEach(r => r.style.display = !q || norm(r.textContent).includes(q) ? '' : 'none'); });
    sec.querySelectorAll('[data-sayt]').forEach(b => b.onclick = () => { const t = tx[items[+b.dataset.sayt].h]; if (t) say(t.lines.map(l => l[1]).join(' ')); });
  }
  const _audioView = window.audioView;
  window.audioView = async function () {
    const v = document.getElementById('audio-view'); if (!v) return;
    if (CASE.audio) await _audioView(); else v.innerHTML = '';
    await recordingsSection(v);
  };

  /* ---- Viewer: recordings open at the minute named, with their transcript; any page can be read aloud ---- */
  const _openDoc2 = openDoc;
  window.openDoc = openDoc = async function (h, page, title, drive) {
    await _openDoc2(h, page, title, drive);
    const bar = document.querySelector('#docv .dbar');
    if (bar && !bar.querySelector('#dvsay')) { const b = document.createElement('button'); b.className = 'btn'; b.id = 'dvsay'; b.textContent = '🔊 Read page'; b.title = 'Read this page aloud'; b.onclick = () => readDocPage(); bar.insertBefore(b, bar.querySelector('#dvo')); }
    const sb = bar && bar.querySelector('#dvsay'); if (sb) sb.style.display = isAud(h) ? 'none' : '';
    if (!isAud(h)) return;
    const a = document.querySelector('#docv audio'), stage = document.querySelector('#docv #dvs');
    if (a && page > 1) { const go = () => { try { a.currentTime = (page - 1) * 60; } catch (e) { } }; if (a.readyState >= 1) go(); else a.addEventListener('loadedmetadata', go, { once: true }); }
    const t = (await txLoad())[h];
    if (t && stage && !stage.querySelector('.trans')) {
      const d = document.createElement('div'); d.className = 'trans'; d.style.cssText = 'margin:14px auto;text-align:left;max-width:900px;max-height:60vh';
      d.innerHTML = t.lines.map(l => `<div data-t="${l[0]}"><b>${hms2(l[0])}</b>${E(l[1])}</div>`).join(''); stage.appendChild(d);
      d.onclick = e => { const r = e.target.closest('[data-t]'); if (r && a) { a.currentTime = +r.dataset.t; a.play(); } };
      const first = [...d.children].find(x => +x.dataset.t >= ((page || 1) - 1) * 60); if (first && page > 1) setTimeout(() => { d.scrollTop = first.offsetTop - d.offsetTop - 40; }, 60);
    }
  };
  async function readDocPage() {
    if (!DV) return;
    let t = '';
    try { if (DV.doc) { const pg = await DV.doc.getPage(DV.page); t = (await pg.getTextContent()).items.map(x => x.str).join(' '); } } catch (e) { }
    if (t.replace(/\s/g, '').length < 25) { try { await loadText(); const fi = TEXT.files.findIndex(f => f.h === DV.h); const c = TEXT.chunks.find(c => c.f === fi && c.p === (DV.doc ? DV.page : 1)); if (c) t = c.t; } catch (e) { } }
    if (!t) { const pre = document.querySelector('#docv pre'); if (pre) t = pre.innerText; }
    if (!t.trim()) { alert('No readable text on this page.'); return; }
    say(t);
  }

  /* ---- Case files: pages close in meaning, under the word matches ---- */
  const _filesView4 = window.filesView;
  window.filesView = function () {
    _filesView4();
    const v = document.getElementById('files-view'), fq = v.querySelector('#fq'), fres = v.querySelector('#fres');
    if (!fq || !fres) return;
    const box = document.createElement('div'); box.className = 'fres'; fres.after(box);
    const go = async () => {
      const q = fq.value.trim(); box.innerHTML = ''; if (!q) return;
      box.innerHTML = '<div class="mnote">Looking for pages close in meaning…</div>';
      const hits = await meaningHits(q, 8);
      if (fq.value.trim() !== q) return;
      if (!hits.length) { box.innerHTML = ''; return; }
      box.innerHTML = '<div class="mnote" style="margin-top:10px"><b>Close in meaning</b> · also finds the same idea in other words, or in Spanish or English</div>' + hits.map(x => {
        const c = TEXT.chunks[x.id], f = TEXT.files[c.f], href = docHref(f.h, /\.pdf$/i.test(f.n) || isAud(f.h) ? c.p : 0);
        return `<a href="${E(href)}"><div class="fn">${E(f.n)} <span style="color:var(--soft);font-weight:400">· ${partWord(f, c.p)}${f.g ? ' · ' + E(f.g) : ''}</span></div><div class="sn">${E(c.t.replace(/\s+/g, ' ').slice(0, 260))}…</div></a>`;
      }).join('');
    };
    v.querySelector('#fgo').addEventListener('click', go); fq.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
  };

  /* ---- Read aloud: voices on this computer. An online voice (Google, Microsoft) only after the person says yes once,
     because it sends the text to that company to be spoken. ---- */
  const SAY = { on: false, q: [], rate: (() => { try { return Number(localStorage.getItem('la-tts-rate')) || 1; } catch (e) { return 1; } })() };
  function langOf(t) { const s = ' ' + norm(t).slice(0, 5000) + ' '; const es = (s.match(/ (el|la|los|las|que|de|del|y|en|por|para|con|una|es|se|no|su|al) /g) || []).length, en = (s.match(/ (the|and|of|to|in|is|that|for|with|on|was|it|be|by|as|at) /g) || []).length; return es > en ? 'es' : 'en'; }
  function pickVoice(lang) {
    let all = []; try { all = speechSynthesis.getVoices(); } catch (e) { }
    const vs = all.filter(v => (v.lang || '').toLowerCase().startsWith(lang));
    const local = vs.find(v => v.localService && /natural/i.test(v.name)) || vs.find(v => v.localService);
    if (local) return local;
    const online = vs[0], anyLocal = all.find(v => v.localService && /^en/i.test(v.lang || '')) || all.find(v => v.localService) || null;
    if (!online) return anyLocal;
    let pref = SAY.online; if (pref == null) { try { pref = localStorage.getItem('la-tts-online'); } catch (e) { } }
    if (pref == null) {
      const es = document.documentElement.lang === 'es', name = lang === 'es' ? (es ? 'español' : 'Spanish') : (es ? 'inglés' : 'English');
      pref = confirm(es ? `Esta computadora no tiene una voz en ${name} propia. ¿Leer con la voz en línea de ${/google/i.test(online.name) ? 'Google' : 'Microsoft'}? El texto se envía a esa empresa para leerlo.

Para que quede en tu computadora, agrega una voz gratis: Windows, Configuración > Hora e idioma > Voz > Agregar voces.` : `This computer has no ${name} voice of its own. Read with ${/google/i.test(online.name) ? "Google's" : "Microsoft's"} online voice? The text is sent to that company to be spoken.

To keep it on this computer, add a free voice: Windows Settings > Time & language > Speech > Add voices.`) ? 'yes' : 'no';
      try { localStorage.setItem('la-tts-online', pref); } catch (e) { }
    }
    SAY.online = pref;
    return pref === 'yes' ? online : anyLocal;
  }
  function sayStop() { SAY.on = false; SAY.q = []; try { speechSynthesis.cancel(); } catch (e) { } if (!MIC.rec) voiceBar(null); paint(); }
  function say(text) {
    if (!('speechSynthesis' in window)) { alert('This browser cannot read aloud.'); return; }
    if (!speechSynthesis.getVoices().length && !SAY.waited) { SAY.waited = true; let done = false; const go = () => { if (!done) { done = true; say(text); } }; speechSynthesis.addEventListener('voiceschanged', go, { once: true }); setTimeout(go, 1500); return; } // voices load late in Chrome
    sayStop();
    text = String(text || '').replace(/\[\d{1,2}\]/g, '').replace(/[#*_`>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 30000); if (!text) return;
    const q = []; let cur = '';
    (text.match(/[^.!?;:]+[.!?;:]*\s*/g) || [text]).forEach(p => { if ((cur + p).length > 220 && cur) { q.push(cur); cur = ''; } cur += p; }); if (cur) q.push(cur);
    SAY.q = q.flatMap(s => s.length <= 260 ? [s] : (s.match(/.{1,240}(\s|$)/g) || [s]));
    SAY.on = true; SAY.lang = langOf(text); SAY.voice = pickVoice(SAY.lang); paint();
    const next = () => {
      if (!SAY.on) return; const s = SAY.q.shift(); if (!s) { sayStop(); return; }
      const u = new SpeechSynthesisUtterance(s), vo = SAY.voice; u.lang = vo ? vo.lang : (SAY.lang === 'es' ? 'es-US' : 'en-US'); if (vo) u.voice = vo; u.rate = SAY.rate;
      u.onend = next; u.onerror = () => { if (SAY.on) setTimeout(next, 50); };
      voiceBar('say', s); speechSynthesis.speak(u);
    };
    next();
  }
  window.laSay = say;

  /* ---- Talk: say a note and it is typed where the cursor was (speech turned into text by /api/transcribe) ---- */
  const MIC = { rec: null, chunks: [], t0: 0, target: null, timer: null };
  document.addEventListener('focusin', e => { const el = e.target; if (!el || el.closest('#la-voicebar')) return; if ((el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && /^(text|search)$/i.test(el.type || 'text'))) && !el.readOnly && !el.disabled) MIC.target = el; });
  async function micStart() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.MediaRecorder) { alert('This browser cannot record. Try Chrome, Edge or Safari.'); return; }
    let stream; try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch (e) { alert('Allow the microphone for ' + location.hostname + ', then press 🎤 again.'); return; }
    sayStop();
    MIC.chunks = []; MIC.rec = new MediaRecorder(stream);
    MIC.rec.ondataavailable = e => { if (e.data && e.data.size) MIC.chunks.push(e.data); };
    MIC.rec.onstop = async () => { stream.getTracks().forEach(t => t.stop()); clearInterval(MIC.timer); const blob = new Blob(MIC.chunks, { type: (MIC.rec && MIC.rec.mimeType) || 'audio/webm' }); MIC.rec = null; paint(); await micFinish(blob); };
    MIC.rec.start(1000); MIC.t0 = Date.now(); paint();
    voiceBar('mic', 'Listening… 0:00 · press Stop when you are done');
    MIC.timer = setInterval(() => { const s = (Date.now() - MIC.t0) / 1000; voiceBar('mic', 'Listening… ' + hms2(s) + ' · press Stop when you are done'); if (s > 600) micStop(); }, 500);
  }
  function micStop() { if (MIC.rec && MIC.rec.state !== 'inactive') MIC.rec.stop(); }
  async function micFinish(blob) {
    voiceBar('busy', 'Turning your words into text…');
    let r = null; try { r = await transcribePcm(await decode16k(blob), '', null); } catch (e) { r = null; }
    voiceBar(null);
    const text = r ? r.lines.filter(l => !/^\[this part could not be heard/.test(l[1])).map(l => l[1]).join(' ').replace(/\s+/g, ' ').trim() : '';
    if (!text) { alert('No words were heard. Try again a little closer to the microphone.'); return; }
    const el = MIC.target;
    if (el && el.isConnected && el.offsetParent !== null) {
      const a = el.selectionStart != null ? el.selectionStart : el.value.length, b = el.selectionEnd != null ? el.selectionEnd : el.value.length;
      const pre = el.value.slice(0, a), post = el.value.slice(b), sep = pre && !/\s$/.test(pre) ? ' ' : '';
      el.value = pre + sep + text + post; el.dispatchEvent(new Event('input', { bubbles: true })); el.focus();
      try { const at = (pre + sep + text).length; el.setSelectionRange(at, at); } catch (e) { }
      return;
    }
    const m = document.createElement('div'); m.className = 'la-modal';
    m.innerHTML = `<div class="box"><div class="la-row" style="justify-content:space-between"><b>What you said</b><button class="btn" data-x>✕</button></div><p class="la-muted">Click into a box first (a note, a question) and it is typed there next time.</p><textarea class="la-in" style="width:100%;min-height:140px">${E(text)}</textarea><div class="la-row" style="margin-top:8px"><button class="btn pri" data-copy>Copy</button></div></div>`;
    document.body.appendChild(m);
    m.querySelector('[data-x]').onclick = () => m.remove(); m.onclick = e => { if (e.target === m) m.remove(); };
    m.querySelector('[data-copy]').onclick = () => { const ta = m.querySelector('textarea'); (navigator.clipboard ? navigator.clipboard.writeText(ta.value) : Promise.reject()).then(() => { m.querySelector('[data-copy]').textContent = 'Copied ✓'; }).catch(() => { ta.select(); }); };
  }

  /* ---- The two buttons and the bar that shows what is happening ---- */
  function voiceBar(kind, text) {
    let b = document.getElementById('la-voicebar');
    if (!kind) { if (b) b.remove(); return; }
    if (b && b.dataset.kind === kind && kind !== 'say') { b.querySelector('.t').textContent = text; return; }
    if (!b) { b = document.createElement('div'); b.id = 'la-voicebar'; b.setAttribute('role', 'status'); b.setAttribute('aria-live', 'polite'); document.body.appendChild(b); }
    if (b.dataset.kind === 'say' && kind === 'say') { b.querySelector('.t').textContent = text; b.querySelector('.r').textContent = SAY.rate.toFixed(2).replace(/0$/, '') + '×'; return; }
    b.dataset.kind = kind;
    if (kind === 'say') b.innerHTML = `<span aria-hidden="true">🔊</span><span class="t"></span><button class="btn" data-v="slow" title="Slower">−</button><span class="r la-muted"></span><button class="btn" data-v="fast" title="Faster">+</button><button class="btn pri" data-v="stop">Stop</button>`;
    else if (kind === 'mic') b.innerHTML = `<span aria-hidden="true">🎤</span><span class="t"></span><button class="btn pri" data-v="micstop">Stop</button>`;
    else b.innerHTML = `<span class="t"></span>`;
    b.querySelector('.t').textContent = text; const rr = b.querySelector('.r'); if (rr) rr.textContent = SAY.rate.toFixed(2).replace(/0$/, '') + '×';
    b.querySelectorAll('[data-v]').forEach(x => x.onclick = () => {
      const v = x.dataset.v;
      if (v === 'stop') sayStop(); else if (v === 'micstop') micStop();
      else { SAY.rate = Math.max(0.6, Math.min(1.8, Math.round((SAY.rate + (v === 'fast' ? 0.15 : -0.15)) * 100) / 100)); try { localStorage.setItem('la-tts-rate', String(SAY.rate)); } catch (e) { } const r2 = b.querySelector('.r'); if (r2) r2.textContent = SAY.rate.toFixed(2).replace(/0$/, '') + '×'; }
    });
  }
  const sayBtn = document.createElement('button'); sayBtn.id = 'la-say'; sayBtn.textContent = '🔊'; sayBtn.title = 'Read aloud: the words you select, or this page'; sayBtn.setAttribute('aria-label', 'Read aloud');
  const micBtn = document.createElement('button'); micBtn.id = 'la-mic'; micBtn.textContent = '🎤'; micBtn.title = 'Talk: say a note and it is typed where your cursor is'; micBtn.setAttribute('aria-label', 'Talk instead of typing');
  sayBtn.onclick = () => {
    if (SAY.on) { sayStop(); return; }
    const sel = String(window.getSelection ? window.getSelection() : '').trim(); if (sel) { say(sel); return; }
    if (document.querySelector('#docv.on')) { readDocPage(); return; }
    const view = [...document.querySelectorAll('.scroll-view')].find(el => el.offsetParent !== null);
    say((view || document.body).innerText);
  };
  micBtn.onclick = () => { if (MIC.rec) { micStop(); return; } if (!CODE) { alert('Open a case first.'); return; } micStart(); };
  sayBtn.addEventListener('mousedown', e => e.preventDefault()); micBtn.addEventListener('mousedown', e => e.preventDefault()); // keep the cursor where it is
  document.body.appendChild(micBtn); document.body.appendChild(sayBtn);
  function paint() { sayBtn.classList.toggle('on', SAY.on); sayBtn.title = SAY.on ? 'Stop reading' : 'Read aloud: the words you select, or this page'; micBtn.classList.toggle('on', !!MIC.rec); micBtn.textContent = MIC.rec ? '■' : '🎤'; }
  setInterval(() => { const open = !!(typeof CODE !== 'undefined' && CODE); const d = open ? 'grid' : 'none'; if (sayBtn.style.display !== d) { sayBtn.style.display = d; micBtn.style.display = d; } document.body.classList.toggle('la-open', open); if (!open && SAY.on) sayStop();
    if (open && CASE && !(CASE.hideTabs || []).includes('audio')) { const t = document.querySelector('.tab[data-view="audio"]'); if (t && t.style.display === 'none' && window.laHasAudio()) { t.style.display = ''; const g = t.closest('.tgroup'); if (g) g.style.display = ''; } } // a recording was just added
  }, 700);

  /* ================= SPANISH INSIDE THE APP ================= */
  const ES = {
    'Overview': 'Resumen', '🔍 Ask AI': '🔍 Preguntar', 'Timeline': 'Cronología', 'Map': 'Mapa', 'Web': 'Red', 'Money': 'Dinero', 'Laws & damages': 'Leyes y daños', 'Laws & rules': 'Leyes y normas', 'Proof': 'Pruebas',
    'Case files': 'Documentos', 'Audio': 'Audio', 'Letters': 'Cartas', 'Filings & portals': 'Escritos y portales', 'Responses': 'Respuestas',
    'Next moves': 'Próximos pasos', "Counsel's requests": 'Pedidos del abogado', 'Requests': 'Pedidos', 'Investigations': 'Investigaciones', 'Counsel & fees': 'Abogados y honorarios', 'Notes': 'Notas',
    'start': 'inicio', 'story': 'historia', 'evidence': 'pruebas', 'work': 'trabajo', 'case': 'caso', 'record': 'registro',
    'Enter a case code to open its file.': 'Escribe un código de caso para abrir su expediente.', 'Open': 'Abrir', '◂ cases': '◂ casos', 'Sign out': 'Salir', 'Home': 'Inicio',
    "What's due": 'Qué vence', 'Getting started': 'Cómo empezar', '★ Pivotal moments (latest first)': '★ Momentos clave (más recientes primero)', 'Full timeline →': 'Cronología completa →',
    'documents': 'documentos', 'people & parties': 'personas y partes', 'money items': 'partidas de dinero', 'laws & rules mapped': 'leyes y reglas', 'recording + transcript': 'grabación + transcripción',
    'Proof map': 'Mapa de pruebas', 'Add a claim': 'Agregar un reclamo', 'Add claim': 'Agregar reclamo', 'Put this proof in a binder': 'Poner estas pruebas en una carpeta',
    'New request': 'Nuevo pedido', 'Send request': 'Enviar pedido', 'Upload without a request': 'Subir sin pedido', 'Mark answered': 'Marcar respondido', 'Reopen': 'Reabrir', 'Delete': 'Borrar',
    '📎 Answer with a file': '📎 Responder con un archivo', 'answered': 'respondido', 'open': 'abierto', 'No requests yet.': 'Aún no hay pedidos.',
    'Add date': 'Agregar fecha', '📅 Put these dates in my calendar': '📅 Poner estas fechas en mi calendario', 'confirm with counsel': 'confirmar con el abogado', 'no date': 'sin fecha',
    'Nothing dated ahead.': 'Nada con fecha por delante.', 'Undo': 'Deshacer', 'today': 'hoy', 'tomorrow': 'mañana',
    '⬆ Upload documents': '⬆ Subir documentos', 'Search': 'Buscar', 'Build exhibit binder (PDF)': 'Armar carpeta de pruebas (PDF)', 'Clear': 'Limpiar', 'Bates prefix': 'Prefijo Bates',
    'Open file ↗': 'Abrir archivo ↗', 'Fit': 'Ajustar', '🔗 Link to proof': '🔗 Vincular a prueba', '☰ List': '☰ Lista', '⟷ Zoomable timeline': '⟷ Cronología con zoom',
    'Court': 'Tribunal', 'House': 'Casa', 'Messages': 'Mensajes', 'Other': 'Otro', '★ pivotal': '★ clave', 'The money trail': 'El rastro del dinero',
    'Search & ask AI': 'Buscar y preguntar a la IA', 'Ask AI': 'Preguntar', 'AI answer': 'Respuesta de la IA', 'Sources': 'Fuentes', 'Thinking…': 'Pensando…', 'Searching the documents…': 'Buscando en los documentos…',
    'Admin: who can open what': 'Admin: quién puede abrir qué', 'Security': 'Seguridad', 'Who it is for': 'Para quién',
    'Check citations': 'Revisar citas', 'Check this document': 'Revisar este documento', 'Citation': 'Cita', 'Case name in the text': 'Nombre del caso en el texto', 'Result': 'Resultado',
    'Found': 'Encontrado', 'NOT FOUND': 'NO ENCONTRADO', 'Name matches': 'El nombre coincide', 'Name does not match': 'El nombre no coincide', 'Not checked yet': 'Aún sin revisar',
    'Email into this case': 'Correo a este caso', 'Shared with your lawyer': 'Compartido con tu abogado', 'Only you (your lawyer does not see these)': 'Solo tú (tu abogado no los ve)',
    'Also take email from': 'Aceptar también correos de', 'Copy': 'Copiar', 'New address': 'Nueva dirección', 'Save': 'Guardar', 'Emailed in': 'Llegó por correo',
    'File fingerprints': 'Huellas de los archivos', 'Check all files': 'Revisar todos los archivos', 'No fingerprint yet': 'Aún sin huella', 'Emails filed into the case': 'Correos archivados en el caso',
    'Recordings': 'Grabaciones', 'Transcribe': 'Transcribir', 'Transcribe again': 'Transcribir de nuevo', '⬆ Upload a recording': '⬆ Subir una grabación', 'No transcript yet.': 'Aún sin transcripción.', 'No recordings yet.': 'Aún no hay grabaciones.',
    'Close in meaning': 'Parecido en significado', '🔊 Read page': '🔊 Leer página', '🔊 Read the answer': '🔊 Leer la respuesta', '🔊 Read it': '🔊 Leerla', 'Stop': 'Parar', 'English': 'Inglés', 'Spanish': 'Español', 'Language: work it out': 'Idioma: detectarlo', 'What you said': 'Lo que dijiste',
  };
  const PH = { 'Search this transcript…': 'Buscar en la transcripción…', 'Paste the text with the citations here': 'Pega aquí el texto con las citas','Search the case, or ask a question…': 'Busca en el caso o haz una pregunta…', 'case code': 'código de caso', 'What is due': 'Qué vence', 'What has to be shown, one per line': 'Lo que hay que probar, uno por línea' };
  let LANG = 'en'; try { LANG = localStorage.getItem('la-lang') === 'es' ? 'es' : 'en'; } catch (e) { }
  function trNode(root) {
    if (!root) return;
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    const nodes = []; while (w.nextNode()) nodes.push(w.currentNode);
    nodes.forEach(n => {
      if (n.parentElement && n.parentElement.closest('script,style,textarea,.ra-ui')) return;
      if (LANG === 'es') { const k = n.nodeValue.trim(); if (ES[k] && n.__en == null) { n.__en = n.nodeValue; n.nodeValue = n.nodeValue.replace(k, ES[k]); } }
      else if (n.__en != null) { n.nodeValue = n.__en; n.__en = null; }
    });
    root.querySelectorAll && root.querySelectorAll('input[placeholder],textarea[placeholder]').forEach(i => { const en = i.dataset.phEn || i.placeholder; if (PH[en]) { i.dataset.phEn = en; i.placeholder = LANG === 'es' ? PH[en] : en; } });
  }
  const lb = document.createElement('button'); lb.id = 'la-lang'; lb.title = 'Español / English';
  const paintLang = () => { lb.textContent = LANG === 'es' ? 'EN' : 'ES'; document.documentElement.lang = LANG; document.documentElement.setAttribute('data-lang', LANG); };
  lb.onclick = () => { LANG = LANG === 'es' ? 'en' : 'es'; try { localStorage.setItem('la-lang', LANG); } catch (e) { } paintLang(); trNode(document.body); };
  document.body.appendChild(lb); paintLang();
  new MutationObserver(ms => { if (LANG !== 'es') return; ms.forEach(m => m.addedNodes.forEach(n => { if (n.nodeType === 1) trNode(n); else if (n.nodeType === 3 && n.parentElement) trNode(n.parentElement); })); }).observe(document.body, { childList: true, subtree: true });
  trNode(document.body);

})();
