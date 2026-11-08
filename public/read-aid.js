// SPDX-License-Identifier: AGPL-3.0-only
/* Legal Agente — reading aid (dyslexia-friendly fonts, spacing, size).
   One button ("Aa"). Choices are saved in this browser and shared by the home page and the app.
   Fonts load only when picked: OpenDyslexic (@fontsource, SIL OFL) and Lexend (Google Fonts, OFL). */
(function () {
  var KEY = 'la-read';
  var FONTS = {
    standard: null,
    lexend: { css: 'https://fonts.googleapis.com/css2?family=Lexend:wght@300..700&display=swap', family: '"Lexend", system-ui, sans-serif' },
    dyslexic: { css: ['https://cdn.jsdelivr.net/npm/@fontsource/opendyslexic@5.2.5/400.css', 'https://cdn.jsdelivr.net/npm/@fontsource/opendyslexic@5.2.5/700.css'], family: '"OpenDyslexic", "Comic Sans MS", sans-serif' }
  };
  var me = document.currentScript;
  var pos = (me && me.dataset.pos) || 'corner';
  var state = { font: 'standard', space: 'normal', size: 0 };
  try { var s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s) state = Object.assign(state, s); } catch (e) {}

  var root = document.documentElement;
  var css = document.createElement('style');
  css.textContent =
    'html[data-ra-font] body, html[data-ra-font] body *:not(svg):not(svg *):not(.ra-keep):not(.ra-keep *){font-family:var(--ra-family)!important}' +
    'html[data-ra-space=wide] body *:not(.word):not(.word *):not(.ra-ui):not(.ra-ui *){letter-spacing:.03em!important;word-spacing:.12em!important}' +
    'html[data-ra-space=wide] :is(p,li,dd,td,label,blockquote,.lede,.lbody,.tbody,.lwdid,.lwcaveat,.hit,.mnote){line-height:1.85!important}' +
    'html[data-ra-size="1"] body{zoom:1.12}html[data-ra-size="2"] body{zoom:1.25}' +
    '.ra-ui{position:fixed;z-index:9999;font:500 13px/1.3 system-ui,-apple-system,"Segoe UI",sans-serif!important;letter-spacing:0!important;word-spacing:0!important;zoom:1}' +
    '.ra-ui *{font-family:inherit!important;letter-spacing:0!important;word-spacing:0!important}' +
    '.ra-btn{all:unset;box-sizing:border-box;cursor:pointer;display:flex;align-items:center;justify-content:center;background:#111214;color:#ece8df;border:1px solid #3a3d44;font:700 15px/1 Georgia,serif!important;box-shadow:0 6px 20px -8px rgba(0,0,0,.5)}' +
    '.ra-btn:focus-visible,.ra-opt:focus-visible{outline:2px solid #e0574d;outline-offset:2px}' +
    '.ra-corner{right:18px;bottom:18px}.ra-corner .ra-btn{width:48px;height:48px;border-radius:50%}' +
    '.ra-top{top:13px;right:57px}.ra-top .ra-btn{width:34px;height:34px;border-radius:9px}' +
    '.ra-panel{position:absolute;width:264px;background:#111214;color:#ece8df;border:1px solid #3a3d44;border-radius:12px;padding:14px;box-shadow:0 20px 50px -20px rgba(0,0,0,.6);display:none}' +
    '.ra-corner .ra-panel{right:0;bottom:58px}.ra-top .ra-panel{right:0;top:42px}' +
    '.ra-ui.open .ra-panel{display:block}' +
    '.ra-h{font-size:11px!important;text-transform:uppercase;letter-spacing:.08em!important;color:#9b968c;margin:10px 0 6px}.ra-h:first-child{margin-top:0}' +
    '.ra-row{display:flex;gap:6px;flex-wrap:wrap}' +
    '.ra-opt{all:unset;box-sizing:border-box;cursor:pointer;padding:7px 10px;border-radius:8px;border:1px solid #3a3d44;color:#ece8df;font-size:13px}' +
    '.ra-opt[aria-pressed=true]{background:#ece8df;color:#111214;border-color:#ece8df}' +
    '.ra-opt.f-lexend{font-family:"Lexend",system-ui,sans-serif!important}.ra-opt.f-dyslexic{font-family:"OpenDyslexic","Comic Sans MS",sans-serif!important}' +
    '.ra-note{font-size:11.5px;color:#9b968c;margin-top:10px;line-height:1.4}' +
    '.ra-more{all:unset;box-sizing:border-box;cursor:pointer;position:absolute;display:flex;align-items:center;justify-content:center;background:#ece8df;color:#111214;border:1px solid #111214;border-radius:50%;font:700 12px/1 system-ui,sans-serif!important}' +
    '.ra-more:focus-visible{outline:2px solid #e0574d;outline-offset:2px}' +
    '.ra-corner .ra-more{width:22px;height:22px;left:-8px;top:-8px}.ra-top .ra-more{width:16px;height:16px;left:-7px;bottom:-6px;font-size:9px!important}' +
    '.ra-toast{position:absolute;white-space:nowrap;background:#111214;color:#ece8df;border:1px solid #3a3d44;border-radius:8px;padding:7px 11px;font-size:14px!important;opacity:0;transform:translateY(4px);transition:opacity .2s,transform .2s;pointer-events:none}' +
    '.ra-corner .ra-toast{right:58px;bottom:9px}.ra-top .ra-toast{right:42px;top:3px}.ra-toast.show{opacity:1;transform:none}';
  document.head.appendChild(css);

  var loaded = {};
  function load(name) {
    var f = FONTS[name]; if (!f || loaded[name]) return; loaded[name] = 1;
    [].concat(f.css).forEach(function (href) { var l = document.createElement('link'); l.rel = 'stylesheet'; l.href = href; document.head.appendChild(l); });
  }
  function es() { return (root.getAttribute('data-lang') || root.lang || 'en').indexOf('es') === 0; }
  function apply() {
    var f = FONTS[state.font];
    if (f) { load(state.font); root.setAttribute('data-ra-font', state.font); root.style.setProperty('--ra-family', f.family); }
    else { root.removeAttribute('data-ra-font'); root.style.removeProperty('--ra-family'); }
    if (state.space === 'wide') root.setAttribute('data-ra-space', 'wide'); else root.removeAttribute('data-ra-space');
    if (state.size) root.setAttribute('data-ra-size', String(state.size)); else root.removeAttribute('data-ra-size');
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { window.dispatchEvent(new Event('resize')); });
    paint();
  }

  var ui = document.createElement('div');
  ui.className = 'ra-ui ra-keep ' + (pos === 'top' ? 'ra-top' : 'ra-corner');
  ui.innerHTML =
    '<button type="button" class="ra-btn"></button>' +
    '<button type="button" class="ra-more" aria-expanded="false" aria-haspopup="true">⋯</button>' +
    '<div class="ra-toast" role="status" aria-live="polite"></div>' +
    '<div class="ra-panel" role="dialog">' +
      '<div class="ra-h" data-t="font"></div><div class="ra-row">' +
        '<button type="button" class="ra-opt" data-k="font" data-v="standard"></button>' +
        '<button type="button" class="ra-opt f-lexend" data-k="font" data-v="lexend">Lexend</button>' +
        '<button type="button" class="ra-opt f-dyslexic" data-k="font" data-v="dyslexic">OpenDyslexic</button></div>' +
      '<div class="ra-h" data-t="space"></div><div class="ra-row">' +
        '<button type="button" class="ra-opt" data-k="space" data-v="normal"></button>' +
        '<button type="button" class="ra-opt" data-k="space" data-v="wide"></button></div>' +
      '<div class="ra-h" data-t="size"></div><div class="ra-row">' +
        '<button type="button" class="ra-opt" data-k="size" data-v="0">A</button>' +
        '<button type="button" class="ra-opt" data-k="size" data-v="1" style="font-size:15px">A</button>' +
        '<button type="button" class="ra-opt" data-k="size" data-v="2" style="font-size:18px">A</button></div>' +
      '<div class="ra-note"></div>' +
    '</div>';
  var btn = ui.querySelector('.ra-btn'), more = ui.querySelector('.ra-more'), toast = ui.querySelector('.ra-toast');
  var CYCLE = ['standard', 'dyslexic', 'lexend'];
  var NAMES = { standard: { en: 'Standard font', es: 'Letra normal' }, dyslexic: { en: 'OpenDyslexic', es: 'OpenDyslexic' }, lexend: { en: 'Lexend', es: 'Lexend' } };
  var T = {
    en: { btn: 'Change font (click again for the next one)', more: 'More reading options: spacing and size', font: 'Font', space: 'Spacing', size: 'Text size', standard: 'Standard', normal: 'Normal', wide: 'Wide', note: 'Tip: click Aa to switch fonts. Saved on this device, on the home page and in your case files.' },
    es: { btn: 'Cambiar la letra (clic otra vez para la siguiente)', more: 'Más opciones de lectura: espacio y tamaño', font: 'Letra', space: 'Espacio', size: 'Tamaño', standard: 'Normal', normal: 'Normal', wide: 'Amplio', note: 'Consejo: haz clic en Aa para cambiar la letra. Se guarda en este equipo, en la portada y en tus expedientes.' }
  };
  var tt;
  function say(msg) { toast.textContent = msg; toast.classList.add('show'); clearTimeout(tt); tt = setTimeout(function () { toast.classList.remove('show'); }, 1600); }
  function paint() {
    var t = es() ? T.es : T.en, f = FONTS[state.font];
    btn.textContent = 'Aa'; btn.title = t.btn; btn.setAttribute('aria-label', t.btn + ' — ' + NAMES[state.font][es() ? 'es' : 'en']);
    btn.style.setProperty('font-family', f ? f.family : 'Georgia, serif', 'important');
    more.title = t.more; more.setAttribute('aria-label', t.more);
    ui.querySelectorAll('[data-t]').forEach(function (h) { h.textContent = t[h.dataset.t]; });
    ui.querySelector('[data-v=standard]').textContent = t.standard;
    ui.querySelector('[data-k=space][data-v=normal]').textContent = t.normal;
    ui.querySelector('[data-k=space][data-v=wide]').textContent = t.wide;
    ui.querySelector('.ra-note').textContent = t.note;
    ui.querySelectorAll('.ra-opt').forEach(function (o) { o.setAttribute('aria-pressed', String(String(state[o.dataset.k]) === o.dataset.v)); });
  }
  btn.addEventListener('click', function (e) {
    e.stopPropagation();
    state.font = CYCLE[(CYCLE.indexOf(state.font) + 1) % CYCLE.length];
    apply(); say(NAMES[state.font][es() ? 'es' : 'en']);
  });
  more.addEventListener('click', function (e) {
    e.stopPropagation(); var open = !ui.classList.contains('open');
    ui.classList.toggle('open', open); more.setAttribute('aria-expanded', String(open));
    if (open) { load('lexend'); load('dyslexic'); paint(); }
  });
  ui.querySelectorAll('.ra-opt').forEach(function (o) {
    o.addEventListener('click', function (e) { e.stopPropagation(); var k = o.dataset.k; state[k] = k === 'size' ? Number(o.dataset.v) : o.dataset.v; apply(); });
  });
  document.addEventListener('click', function (e) { if (!ui.contains(e.target)) { ui.classList.remove('open'); more.setAttribute('aria-expanded', 'false'); } });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { ui.classList.remove('open'); more.setAttribute('aria-expanded', 'false'); } });
  new MutationObserver(paint).observe(root, { attributes: true, attributeFilter: ['data-lang', 'lang'] });

  function mount() { document.body.appendChild(ui); apply(); }
  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);
})();
