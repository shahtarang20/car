/* Road Dash install experience (PWA).
 *
 * Self-contained: registers /sw.js, tracks installability, manages every
 * [data-install-btn] element, shows a platform-aware illustrated help sheet,
 * a gentle "install" banner (suggest()) and a toast.
 *
 * Public API: window.RoadDashInstall = {
 *   isInstalled(), canInstall(), promptInstall(), showHelp(), suggest()
 * }
 * Events on document: 'roaddash:installed', 'roaddash:install-availability'
 *   ({detail:{available}}). Listens for 'roaddash:rescan-install'.
 */
(function () {
  'use strict';
  if (window.RoadDashInstall) return;

  var doc = document;
  var win = window;
  var nav = navigator;

  /* ------------------------------------------------------------------ utils */
  var K_DISMISSED_AT = 'roaddash_install_dismissed_at';
  var K_DISMISS_COUNT = 'roaddash_install_dismissals';
  var K_INSTALLED = 'roaddash_installed';
  var WEEK = 7 * 24 * 60 * 60 * 1000;

  function lsGet(k) { try { return win.localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { win.localStorage.setItem(k, String(v)); } catch (e) { /* private mode */ } }
  function lsDel(k) { try { win.localStorage.removeItem(k); } catch (e) { /* ignore */ } }

  function mq(q) {
    try { return win.matchMedia ? win.matchMedia(q) : null; } catch (e) { return null; }
  }
  function reducedMotion() {
    var m = mq('(prefers-reduced-motion: reduce)');
    return !!(m && m.matches);
  }
  function emit(name, detail) {
    try { doc.dispatchEvent(new CustomEvent(name, { detail: detail })); } catch (e) { /* old browser */ }
  }

  /** Tiny element factory. Text always goes through textContent. */
  function h(tag, cls, text, attrs) {
    var el = doc.createElement(tag);
    if (cls) el.className = cls;
    if (text != null) el.textContent = text;
    if (attrs) for (var k in attrs) if (Object.prototype.hasOwnProperty.call(attrs, k)) el.setAttribute(k, attrs[k]);
    return el;
  }
  /** Build an inline SVG from STATIC markup only (never user input). */
  function svg(inner, size, cls) {
    var s = size || 24;
    var wrap = doc.createElement('span');
    wrap.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="' + s + '" height="' + s +
      '" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
      inner + '</svg>';
    var el = wrap.firstChild;
    if (cls) el.setAttribute('class', cls);
    return el;
  }

  var GLYPH = {
    share: '<path d="M12 3v12M8 7l4-4 4 4"/><path d="M7 11H6a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-1"/>',
    addHome: '<rect x="4" y="4" width="16" height="16" rx="4"/><path d="M12 8v8M8 12h8"/>',
    back: '<path d="M15 5l-7 7 7 7"/>',
    fwd: '<path d="M9 5l7 7-7 7"/>',
    book: '<path d="M4 6c2.4-1.2 5.4-1.2 8 .6 2.6-1.8 5.6-1.8 8-.6v13c-2.4-1.2-5.4-1.2-8 .6-2.6-1.8-5.6-1.8-8-.6z"/><path d="M12 6.6v13"/>',
    tabs: '<rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V6.5A2.5 2.5 0 0 0 13.5 4h-7A2.5 2.5 0 0 0 4 6.5v7A2.5 2.5 0 0 0 6.5 16H8"/>',
    dotsH: '<circle cx="5" cy="12" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="19" cy="12" r="1.6" fill="currentColor"/>',
    dotsV: '<circle cx="12" cy="5" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="12" cy="19" r="1.6" fill="currentColor"/>',
    compass: '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    install: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M12 7v5M9.5 10l2.5 2.5 2.5-2.5M8 20h8M12 16v4"/>',
    lock: '<rect x="6" y="11" width="12" height="9" rx="2"/><path d="M9 11V8a3 3 0 0 1 6 0v3"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>'
  };

  /* --------------------------------------------------------------- platform */
  var UA = nav.userAgent || '';
  var PLATFORM = nav.platform || '';
  var IS_IOS = /iPad|iPhone|iPod/.test(UA) || (PLATFORM === 'MacIntel' && (nav.maxTouchPoints || 0) > 1);
  var IS_ANDROID = /Android/i.test(UA);
  var IN_APP = /FBAN|FBAV|FB_IAB|Instagram|\bLine\/|Snapchat|MicroMessenger|Twitter|TikTok|musical_ly|Pinterest|LinkedInApp|GSA\/|; wv\)/i.test(UA);
  var IS_MAC_SAFARI = !IS_IOS && /Macintosh/.test(UA) && /Safari\//.test(UA) &&
    !/Chrome|Chromium|CriOS|Edg\/|OPR\/|Firefox|FxiOS/.test(UA) && macSafariVersion() >= 17;

  function macSafariVersion() {
    var m = /Version\/(\d+)/.exec(UA);
    return m ? parseInt(m[1], 10) : 0;
  }

  /** What we can say about this browser regardless of runtime events. */
  function uaKind() {
    if (IS_IOS) {
      var iosOther = /CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo/.test(UA);
      if (IN_APP || !/Safari\//.test(UA) && !iosOther) return 'inapp-ios';
      if (iosOther) return typeof nav.share === 'function' ? 'ios-browser' : 'inapp-ios';
      return 'ios-safari';
    }
    if (IS_ANDROID) return IN_APP ? 'inapp-android' : 'android';
    if (IS_MAC_SAFARI) return 'mac-safari';
    return null;
  }

  /* ------------------------------------------------------------------ state */
  var deferredPrompt = null;
  var promptConsumed = false;        // native prompt shown once already (dismissed)
  var androidWaited = false;         // gave Chrome ~4 s to fire beforeinstallprompt
  var lastAvailable = null;
  var suggestShown = false;          // once per page session
  var sheet = null;                  // open help sheet state
  var banner = null;                 // open banner state
  var seenButtons = [];

  function standaloneNow() {
    var qs = ['(display-mode: standalone)', '(display-mode: minimal-ui)', '(display-mode: fullscreen)'];
    for (var i = 0; i < qs.length; i++) { var m = mq(qs[i]); if (m && m.matches) return true; }
    try { if (nav.standalone === true) return true; } catch (e) { /* ignore */ }
    return false;
  }
  function isInstalled() {
    if (standaloneNow()) return true;
    try { if (doc.referrer && doc.referrer.indexOf('android-app://') === 0) return true; } catch (e) { /* ignore */ }
    return lsGet(K_INSTALLED) === '1';
  }

  function currentKind() {
    if (deferredPrompt) return 'native';
    var k = uaKind();
    if (k === 'android') return androidWaited ? 'android-manual' : null;
    if (k) return k;
    return promptConsumed ? 'desktop' : null;
  }
  function canInstall() { return !isInstalled() && currentKind() !== null; }

  /* ---------------------------------------------------------------- styles */
  var CSS = [
    '.rd-ins,.rd-ins *{box-sizing:border-box}',
    '.rd-ins{--rd-bg:var(--panel,#101a30);--rd-border:var(--panel-border,#1e2b47);--rd-text:var(--text,#eef2fb);--rd-dim:var(--text-dim,#7d8bab);--rd-accent:var(--accent,#22e08a);--rd-ink:#04130c;--rd-soft:rgba(127,140,171,.14);',
    ' font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;color:var(--rd-text);-webkit-font-smoothing:antialiased;line-height:1.35}',
    '[data-install-btn][hidden]{display:none!important}',

    /* buttons */
    '.rd-btn{appearance:none;-webkit-appearance:none;border:0;border-radius:14px;min-height:44px;padding:0 18px;font:700 15px/1 inherit;font-family:inherit;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:8px;-webkit-tap-highlight-color:transparent;transition:transform .12s ease,filter .15s ease,background .15s ease}',
    '.rd-btn:active{transform:scale(.96)}',
    '.rd-btn:focus-visible,.rd-x:focus-visible{outline:3px solid var(--rd-accent);outline-offset:2px}.rd-sheet:focus{outline:none}',
    '.rd-primary{background:linear-gradient(135deg,#2af0a0,#0fbf70);color:var(--rd-ink);box-shadow:0 6px 18px -6px rgba(34,224,138,.7)}',
    '.rd-primary:hover{filter:brightness(1.06)}',
    '.rd-ghost{background:transparent;color:var(--rd-dim)}',
    '.rd-ghost:hover{background:var(--rd-soft);color:var(--rd-text)}',
    '.rd-secondary{background:var(--rd-soft);color:var(--rd-text);border:1px solid var(--rd-border)}',
    '.rd-secondary:hover{filter:brightness(1.08)}',

    /* overlay + sheet */
    '.rd-overlay{position:fixed;inset:0;z-index:100000;display:flex;align-items:flex-end;justify-content:center;background:rgba(3,6,14,.62);-webkit-backdrop-filter:blur(5px);backdrop-filter:blur(5px);opacity:0;transition:opacity .25s ease}',
    '.rd-overlay.rd-open{opacity:1}',
    '.rd-sheet{position:relative;width:100%;max-width:480px;max-height:92vh;max-height:92dvh;overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;background:var(--rd-bg);border:1px solid var(--rd-border);border-bottom:0;border-radius:26px 26px 0 0;padding:8px 20px calc(22px + var(--safe-bottom,0px));box-shadow:0 -20px 60px -10px rgba(0,0,0,.55);transform:translateY(100%);transition:transform .34s cubic-bezier(.2,.85,.25,1)}',
    '.rd-open .rd-sheet{transform:translateY(var(--rd-drag,0px))}',
    '.rd-sheet.rd-dragging{transition:none}',
    '.rd-grab{display:block;width:100%;height:26px;margin:0 0 2px;padding:0;border:0;background:none;cursor:grab;touch-action:none;position:relative}',
    '.rd-grab::after{content:"";position:absolute;left:50%;top:10px;width:42px;height:5px;margin-left:-21px;border-radius:3px;background:var(--rd-dim);opacity:.45}',
    '.rd-x{position:absolute;top:14px;right:12px;width:44px;height:44px;border-radius:50%;border:0;background:var(--rd-soft);color:var(--rd-text);display:flex;align-items:center;justify-content:center;cursor:pointer;-webkit-tap-highlight-color:transparent;z-index:2}',
    '.rd-x:hover{filter:brightness(1.15)}',
    '.rd-head{display:flex;align-items:center;gap:14px;padding:6px 52px 0 0}',
    '.rd-icon{width:60px;height:60px;border-radius:15px;flex:none;box-shadow:0 8px 22px -8px rgba(0,0,0,.6);background:#0b1120;object-fit:cover}',
    '.rd-title{margin:0;font-size:21px;font-weight:800;letter-spacing:-.01em;color:var(--rd-text)}',
    '.rd-sub{margin:3px 0 0;font-size:13px;color:var(--rd-dim)}',
    '.rd-chips{display:flex;flex-wrap:wrap;gap:6px;margin:14px 0 2px;padding:0;list-style:none}',
    '.rd-chip{padding:5px 8px;border-radius:999px;font-size:11.5px;font-weight:600;background:rgba(34,224,138,.13);border:1px solid rgba(34,224,138,.28);color:var(--rd-text);white-space:nowrap}',
    '.rd-steps{list-style:none;margin:14px 0 0;padding:0;display:flex;flex-direction:column;gap:12px;counter-reset:rdstep}',
    '.rd-step{display:grid;grid-template-columns:30px 1fr;column-gap:12px;row-gap:8px;align-items:start}',
    '.rd-num{width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:14px;background:var(--rd-accent);color:var(--rd-ink)}',
    '.rd-st{margin:0;font-size:15.5px;font-weight:700;color:var(--rd-text);padding-top:4px}',
    '.rd-sp{margin:2px 0 0;font-size:13.5px;color:var(--rd-dim)}',
    '.rd-art{grid-column:1 / -1;margin-left:42px;border-radius:16px;background:var(--rd-soft);border:1px solid var(--rd-border);padding:8px;overflow:hidden}',
    '.rd-note{margin:16px 0 0;padding:12px 14px;border-radius:14px;background:var(--rd-soft);border:1px solid var(--rd-border);font-size:13.5px;color:var(--rd-dim)}',
    '.rd-actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:18px}',
    '.rd-actions .rd-btn{flex:1 1 150px}',
    '.rd-live{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}',

    /* mock UI pieces used in the illustrations */
    '.rd-bar{display:flex;align-items:center;justify-content:space-between;gap:2px;color:var(--rd-dim)}',
    '.rd-g{width:38px;height:38px;border-radius:12px;display:flex;align-items:center;justify-content:center;flex:none;position:relative}',
    '.rd-hl{color:var(--rd-ink);background:var(--rd-accent);animation:rd-pulse 1.8s ease-out infinite}',
    '.rd-list{display:flex;flex-direction:column;border-radius:12px;overflow:hidden;background:var(--rd-bg);border:1px solid var(--rd-border)}',
    '.rd-row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 12px;font-size:13.5px;color:var(--rd-text);border-top:1px solid var(--rd-border)}',
    '.rd-row:first-child{border-top:0}',
    '.rd-row svg{color:var(--rd-dim);flex:none}',
    '.rd-row.rd-hl{margin:3px;border-radius:9px;color:var(--rd-ink);font-weight:700;border-top-color:transparent}',
    '.rd-row.rd-hl svg{color:var(--rd-ink)}.rd-row.rd-hl{animation:none}',
    '.rd-pill{display:flex;align-items:center;gap:8px;padding:6px 6px 6px 12px;border-radius:12px;background:var(--rd-bg);border:1px solid var(--rd-border);font-size:13px;color:var(--rd-dim)}',
    '.rd-pill span.rd-grow{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.rd-pill .rd-g{width:34px;height:34px;border-radius:10px}',
    '.rd-menubar{display:flex;gap:4px;padding:6px;border-radius:10px;background:var(--rd-bg);border:1px solid var(--rd-border);font-size:13px;color:var(--rd-text)}',
    '.rd-menubar span{padding:6px 11px;border-radius:7px}',
    '.rd-dlg{display:flex;flex-direction:column;gap:10px;border-radius:12px;background:var(--rd-bg);border:1px solid var(--rd-border);padding:10px}',
    '.rd-dlg-top{display:flex;align-items:center;justify-content:space-between;font-size:13px;color:var(--rd-dim)}',
    '.rd-dlg-top b{color:var(--rd-text);font-weight:700}',
    '.rd-dlg-top .rd-hl{padding:6px 14px;border-radius:9px;font-weight:700;animation-name:rd-pulse}',
    '.rd-dlg-body{display:flex;align-items:center;gap:10px;font-size:13px;color:var(--rd-text)}',
    '.rd-dlg-body img{width:42px;height:42px;border-radius:10px;background:#0b1120}',
    '.rd-dlg-body small{display:block;color:var(--rd-dim);font-size:12px}',
    '@keyframes rd-pulse{0%{box-shadow:0 0 0 0 rgba(34,224,138,.55)}70%{box-shadow:0 0 0 10px rgba(34,224,138,0)}100%{box-shadow:0 0 0 0 rgba(34,224,138,0)}}',

    /* banner */
    '.rd-banner{position:fixed;left:50%;top:calc(var(--safe-top,0px) + 10px);z-index:90000;width:min(460px,calc(100vw - 24px));display:flex;flex-wrap:wrap;align-items:center;gap:8px 8px;padding:9px 9px 9px 10px;border-radius:20px;background:var(--rd-bg);border:1px solid var(--rd-border);box-shadow:0 18px 44px -12px rgba(0,0,0,.6);transform:translate(-50%,-160%);opacity:0;visibility:hidden;transition:transform .4s cubic-bezier(.2,.85,.25,1),opacity .3s ease,visibility 0s linear .4s}',
    '.rd-banner.rd-in{transform:translate(-50%,0);opacity:1;visibility:visible;transition-delay:0s}',
    '.rd-banner .rd-bicon{width:42px;height:42px;border-radius:11px;flex:none;background:#0b1120}',
    '.rd-btxt{flex:1 1 118px;min-width:0}',
    '.rd-btxt strong{display:block;font-size:14px;font-weight:800;color:var(--rd-text)}',
    '.rd-btxt span{display:block;font-size:12.5px;color:var(--rd-dim)}',
    '.rd-bact{display:flex;gap:6px;flex:0 0 auto;margin-left:auto}',
    '.rd-bact .rd-btn{padding:0 12px;font-size:14px}',

    /* toast */
    '.rd-toast{position:fixed;left:50%;top:calc(var(--safe-top,0px) + 14px);z-index:110000;transform:translate(-50%,-30px);opacity:0;display:flex;align-items:center;gap:8px;max-width:calc(100vw - 24px);padding:12px 18px;border-radius:999px;background:var(--rd-bg);border:1px solid var(--rd-accent);color:var(--rd-text);font-weight:700;font-size:14.5px;box-shadow:0 14px 36px -10px rgba(0,0,0,.6);transition:transform .35s cubic-bezier(.2,.85,.25,1),opacity .25s ease;pointer-events:none}',
    '.rd-toast.rd-in{transform:translate(-50%,0);opacity:1}',

    '@media (min-width:600px){.rd-overlay{align-items:center}.rd-sheet{border-radius:26px;border-bottom:1px solid var(--rd-border);padding-bottom:24px;transform:translateY(24px) scale(.97);opacity:0;transition:transform .3s cubic-bezier(.2,.85,.25,1),opacity .25s ease}.rd-open .rd-sheet{transform:none;opacity:1}.rd-grab{display:none}.rd-sheet{padding-top:22px}.rd-x{top:16px}}',
    '@media (max-width:359px){.rd-sheet{padding-left:14px;padding-right:14px}.rd-art{margin-left:0}.rd-icon{width:50px;height:50px}.rd-title{font-size:19px}}',
    '@media (prefers-reduced-motion:reduce){.rd-overlay,.rd-sheet,.rd-banner,.rd-toast,.rd-btn{transition:none!important}.rd-hl{animation:none!important}}'
  ].join('\n');

  function injectStyle() {
    if (doc.getElementById('rd-install-css')) return;
    var st = doc.createElement('style');
    st.id = 'rd-install-css';
    st.textContent = CSS;
    (doc.head || doc.documentElement).appendChild(st);
  }

  /* ------------------------------------------------------------- toast */
  var toastTimer = 0;
  function toast(message) {
    injectStyle();
    var old = doc.querySelector('.rd-toast');
    if (old && old.parentNode) old.parentNode.removeChild(old);
    clearTimeout(toastTimer);
    var t = h('div', 'rd-ins rd-toast', null, { role: 'status', 'aria-live': 'polite' });
    t.appendChild(svg(GLYPH.check, 18));
    t.appendChild(h('span', null, message));
    doc.body.appendChild(t);
    void t.offsetWidth; t.classList.add('rd-in');   // forced reflow so the transition runs
    toastTimer = setTimeout(function () {
      t.classList.remove('rd-in');
      setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, reducedMotion() ? 0 : 400);
    }, 3400);
  }

  /* --------------------------------------------------- illustrations (art) */
  function art(child) {
    var a = h('div', 'rd-art', null, { 'aria-hidden': 'true' });
    a.appendChild(child);
    return a;
  }
  function glyph(name, hl, size) {
    var g = h('span', 'rd-g' + (hl ? ' rd-hl' : ''));
    g.appendChild(svg(GLYPH[name], size || 22));
    return g;
  }
  function barArt(names, hlIndex) {
    var bar = h('div', 'rd-bar');
    names.forEach(function (n, i) { bar.appendChild(glyph(n, i === hlIndex)); });
    return art(bar);
  }
  function listArt(rows, hlIndex) {
    var list = h('div', 'rd-list');
    rows.forEach(function (r, i) {
      var row = h('div', 'rd-row' + (i === hlIndex ? ' rd-hl' : ''));
      row.appendChild(h('span', null, r[0]));
      if (r[1]) row.appendChild(svg(GLYPH[r[1]], 20));
      list.appendChild(row);
    });
    return art(list);
  }
  function pillArt(rightGlyph, hl) {
    var p = h('div', 'rd-pill');
    p.appendChild(svg(GLYPH.lock, 15));
    p.appendChild(h('span', 'rd-grow', String(location.host || 'roaddash')));
    p.appendChild(glyph(rightGlyph, hl, 20));
    return art(p);
  }
  function menubarArt(items, hlIndex) {
    var m = h('div', 'rd-menubar');
    items.forEach(function (t, i) { m.appendChild(h('span', i === hlIndex ? 'rd-hl' : null, t)); });
    return art(m);
  }
  function iconImg() {
    var img = h('img', null, null, { src: '/icons/icon-192.png', alt: '', width: '42', height: '42' });
    img.addEventListener('error', function () { img.style.visibility = 'hidden'; });
    return img;
  }
  function confirmArt(left, title, right) {
    var d = h('div', 'rd-dlg');
    var top = h('div', 'rd-dlg-top');
    top.appendChild(h('span', null, left));
    top.appendChild(h('b', null, title));
    top.appendChild(h('span', 'rd-hl', right));
    d.appendChild(top);
    var body = h('div', 'rd-dlg-body');
    body.appendChild(iconImg());
    var tx = h('div');
    tx.appendChild(document.createTextNode('Road Dash'));
    tx.appendChild(h('small', null, String(location.host || '')));
    body.appendChild(tx);
    d.appendChild(body);
    return art(d);
  }
  function installCardArt() {
    var d = h('div', 'rd-dlg');
    var body = h('div', 'rd-dlg-body');
    body.appendChild(iconImg());
    var tx = h('div');
    tx.style.flex = '1';
    tx.appendChild(document.createTextNode('Install Road Dash'));
    tx.appendChild(h('small', null, 'Opens in Safari'));
    body.appendChild(tx);
    body.appendChild(h('span', 'rd-hl', 'Install', { style: 'padding:7px 14px;border-radius:10px;font-weight:700;font-size:13px' }));
    d.appendChild(body);
    return art(d);
  }

  /* ----------------------------------------------------- help content */
  function stepsFor(kind) {
    var browserName = IS_IOS ? 'Safari' : 'Chrome';
    switch (kind) {
      case 'ios-safari':
        return {
          title: 'Install Road Dash',
          sub: 'Add it to your Home Screen in 3 quick taps.',
          steps: [
            ['Tap the Share button', 'It’s in Safari’s toolbar — at the bottom on iPhone, at the top on iPad.', barArt(['back', 'fwd', 'share', 'book', 'tabs'], 2)],
            ['Choose “Add to Home Screen”', 'Scroll down in the share menu if you don’t see it right away.', listArt([['Add to Bookmarks', 'book'], ['Add to Home Screen', 'addHome'], ['Find on Page', null]], 1)],
            ['Tap “Add”', 'Road Dash lands on your Home Screen — open it like any other app.', confirmArt('Cancel', 'Add to Home Screen', 'Add')]
          ]
        };
      case 'ios-browser':
        return {
          title: 'Install Road Dash',
          sub: 'Add it to your Home Screen in 3 quick taps.',
          steps: [
            ['Tap the Share button', 'In Chrome it’s at the top right next to the address bar (or under the ••• menu).', barArt(['back', 'fwd', 'share', 'book', 'tabs'], 2)],
            ['Choose “Add to Home Screen”', 'Scroll down in the share menu if you don’t see it right away.', listArt([['Add to Bookmarks', 'book'], ['Add to Home Screen', 'addHome'], ['Find on Page', null]], 1)],
            ['Tap “Add”', 'Road Dash lands on your Home Screen — open it like any other app.', confirmArt('Cancel', 'Add to Home Screen', 'Add')]
          ]
        };
      case 'inapp-ios':
        return {
          title: 'Open in Safari to install',
          sub: 'This in-app browser can’t install apps. Switch to Safari first.',
          copy: true,
          steps: [
            ['Tap the ••• menu', 'Look for ••• or the Share icon in a corner of this screen.', barArt(['back', 'fwd', 'dotsH', 'tabs'], 2)],
            ['Choose “Open in Safari”', 'It may also say “Open in Browser”.', listArt([['Copy link', 'link'], ['Open in Safari', 'compass'], ['Share…', 'share']], 1)],
            ['Then tap Install again', 'Safari will show you how to add Road Dash to your Home Screen.', installCardArt()]
          ]
        };
      case 'inapp-android':
        return {
          title: 'Open in your browser to install',
          sub: 'This in-app browser can’t install apps. Switch to Chrome first.',
          copy: true,
          steps: [
            ['Tap the ⋮ menu', 'Look for ⋮ or ••• at the top of this screen.', barArt(['back', 'fwd', 'tabs', 'dotsV'], 3)],
            ['Choose “Open in Chrome”', 'It may also say “Open in browser”.', listArt([['Copy link', 'link'], ['Open in Chrome', 'compass'], ['Share…', 'share']], 1)],
            ['Then tap Install again', 'Chrome will offer to install Road Dash.', installCardArt()]
          ]
        };
      case 'android-manual':
        return {
          title: 'Install Road Dash',
          sub: 'Add it to your Home screen from your browser menu.',
          steps: [
            ['Tap the ⋮ menu', 'It’s at the top right of your browser.', barArt(['back', 'fwd', 'tabs', 'dotsV'], 3)],
            ['Tap “Install app”', 'Or “Add to Home screen”, depending on your browser.', listArt([['Share…', 'share'], ['Install app', 'install'], ['Add to Home screen', 'addHome']], 1)],
            ['Confirm', 'Road Dash shows up with your other apps.', confirmArt('Cancel', 'Install app?', 'Install')]
          ]
        };
      case 'mac-safari':
        return {
          title: 'Install Road Dash',
          sub: 'Add it to your Dock in 3 clicks.',
          steps: [
            ['Open the File menu', 'In the menu bar at the top of your screen.', menubarArt(['Safari', 'File', 'Edit', 'View', 'History'], 1)],
            ['Choose “Add to Dock…”', 'It’s near the middle of the File menu.', listArt([['New Window', null], ['Add to Dock…', 'install'], ['Share', 'share']], 1)],
            ['Click “Add”', 'Road Dash opens in its own window, like a native app.', confirmArt('Cancel', 'Add to Dock', 'Add')]
          ]
        };
      default: /* 'desktop' and anything else */
        return {
          title: 'Install Road Dash',
          sub: 'Add it to your computer from your browser.',
          steps: [
            ['Look for the install icon', 'It’s on the right side of the address bar.', pillArt('install', true)],
            ['Or open the browser menu', 'Choose “Install Road Dash…” (or “Install app”) from the ⋮ menu.', listArt([['Save and share', null], ['Install Road Dash…', 'install'], ['Cast…', null]], 1)],
            ['Confirm', 'Road Dash opens in its own window.', confirmArt('Cancel', 'Install app?', 'Install')]
          ]
        };
    }
  }

  /* ------------------------------------------------------------- help sheet */
  function copyLink(btn, live) {
    var url = String(location.href);
    function done(ok) {
      var label = btn.querySelector('span');
      var orig = btn.getAttribute('data-label') || (label && label.textContent) || 'Copy link';
      btn.setAttribute('data-label', orig);
      if (label) label.textContent = ok ? 'Copied ✓' : 'Press and hold to copy';
      live.textContent = ok ? 'Link copied' : 'Could not copy automatically';
      setTimeout(function () { if (label) label.textContent = orig; }, 2200);
    }
    function fallback() {
      var ok = false;
      try {
        var ta = h('textarea', null, null, { readonly: '', 'aria-hidden': 'true' });
        ta.value = url;
        ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;font-size:16px';
        doc.body.appendChild(ta);
        ta.focus(); ta.select();
        try { ta.setSelectionRange(0, url.length); } catch (e) { /* ignore */ }
        ok = doc.execCommand && doc.execCommand('copy');
        doc.body.removeChild(ta);
      } catch (e) { ok = false; }
      btn.focus();
      done(!!ok);
    }
    try {
      if (nav.clipboard && nav.clipboard.writeText) {
        nav.clipboard.writeText(url).then(function () { done(true); }, fallback);
        return;
      }
    } catch (e) { /* fall through */ }
    fallback();
  }

  function getFocusable(root) {
    var list = root.querySelectorAll('button:not([disabled]),a[href],input,select,textarea,[tabindex]:not([tabindex="-1"])');
    return Array.prototype.filter.call(list, function (el) { return el.offsetParent !== null || el === doc.activeElement; });
  }

  function showHelp() {
    if (sheet) return;
    injectStyle();
    hideBanner(true);
    var kind = currentKind() || (uaKind() || 'desktop');
    if (kind === 'native') kind = IS_ANDROID ? 'android-manual' : 'desktop';
    var data = stepsFor(kind);

    var trigger = doc.activeElement;
    var overlay = h('div', 'rd-ins rd-overlay');
    var panel = h('div', 'rd-sheet', null, {
      role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'rd-sheet-title', 'aria-describedby': 'rd-sheet-sub', tabindex: '-1'
    });

    var grab = h('button', 'rd-grab', null, { type: 'button', 'aria-label': 'Drag down to close', tabindex: '-1' });
    var closeBtn = h('button', 'rd-x', null, { type: 'button', 'aria-label': 'Close' });
    closeBtn.appendChild(svg(GLYPH.close, 20));

    var head = h('div', 'rd-head');
    var icon = h('img', 'rd-icon', null, { src: '/icons/icon-192.png', alt: '', width: '60', height: '60' });
    icon.addEventListener('error', function () { icon.style.display = 'none'; });
    var ht = h('div');
    ht.appendChild(h('h2', 'rd-title', data.title, { id: 'rd-sheet-title' }));
    ht.appendChild(h('p', 'rd-sub', data.sub, { id: 'rd-sheet-sub' }));
    head.appendChild(icon);
    head.appendChild(ht);

    var chips = h('ul', 'rd-chips');
    ['⚡ Instant launch', '📴 Plays offline', '🖥️ Full screen'].forEach(function (c) { chips.appendChild(h('li', 'rd-chip', c)); });

    var ol = h('ol', 'rd-steps');
    data.steps.forEach(function (s, i) {
      var li = h('li', 'rd-step');
      li.appendChild(h('span', 'rd-num', String(i + 1), { 'aria-hidden': 'true' }));
      var tx = h('div');
      tx.appendChild(h('h3', 'rd-st', s[0]));
      tx.appendChild(h('p', 'rd-sp', s[1]));
      li.appendChild(tx);
      li.appendChild(s[2]);
      ol.appendChild(li);
    });

    var live = h('div', 'rd-live', null, { role: 'status', 'aria-live': 'polite' });
    var actions = h('div', 'rd-actions');
    if (data.copy) {
      var cp = h('button', 'rd-btn rd-primary', null, { type: 'button' });
      cp.appendChild(svg(GLYPH.link, 18));
      cp.appendChild(h('span', null, 'Copy link'));
      cp.addEventListener('click', function () { copyLink(cp, live); });
      actions.appendChild(cp);
    }
    var gotIt = h('button', 'rd-btn ' + (data.copy ? 'rd-secondary' : 'rd-primary'), 'Got it', { type: 'button' });
    gotIt.addEventListener('click', closeHelp);
    actions.appendChild(gotIt);

    panel.appendChild(grab);
    panel.appendChild(closeBtn);
    panel.appendChild(head);
    panel.appendChild(chips);
    panel.appendChild(ol);
    panel.appendChild(actions);
    panel.appendChild(live);
    overlay.appendChild(panel);
    doc.body.appendChild(overlay);
    doc.body.classList.add('modal-open');

    // Backdrop click closes (but not clicks that start inside the sheet).
    overlay.addEventListener('mousedown', function (e) { if (e.target === overlay) closeHelp(); });
    overlay.addEventListener('touchstart', function (e) { if (e.target === overlay) closeHelp(); }, { passive: true });
    closeBtn.addEventListener('click', closeHelp);

    function onKey(e) {
      if (!sheet) return;
      if (e.key === 'Escape' || e.key === 'Esc') { e.preventDefault(); e.stopPropagation(); closeHelp(); return; }
      if (e.key === 'Tab') {
        var f = getFocusable(panel);
        if (!f.length) { e.preventDefault(); panel.focus(); return; }
        var first = f[0], last = f[f.length - 1], a = doc.activeElement;
        if (!panel.contains(a) || a === panel) { e.preventDefault(); (e.shiftKey ? last : first).focus(); }
        else if (e.shiftKey && a === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && a === last) { e.preventDefault(); first.focus(); }
        return;
      }
      // Keep game key handlers from seeing Enter/Space meant for our buttons.
      if ((e.key === 'Enter' || e.key === ' ') && panel.contains(e.target)) e.stopPropagation();
    }
    function onFocusIn(e) { if (sheet && !panel.contains(e.target)) panel.focus(); }
    doc.addEventListener('keydown', onKey, true);
    doc.addEventListener('focusin', onFocusIn, true);

    // Swipe-down to dismiss (mobile bottom sheet).
    var dragY = null;
    function setDrag(v) { panel.style.setProperty('--rd-drag', v + 'px'); }
    grab.addEventListener('pointerdown', function (e) {
      dragY = e.clientY;
      panel.classList.add('rd-dragging');
      try { grab.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    });
    grab.addEventListener('pointermove', function (e) {
      if (dragY == null) return;
      setDrag(Math.max(0, e.clientY - dragY));
    });
    function endDrag(e) {
      if (dragY == null) return;
      var dy = e.clientY - dragY;
      dragY = null;
      panel.classList.remove('rd-dragging');
      if (dy > 90) closeHelp(); else setDrag(0);
    }
    grab.addEventListener('pointerup', endDrag);
    grab.addEventListener('pointercancel', endDrag);

    sheet = { overlay: overlay, panel: panel, trigger: trigger, onKey: onKey, onFocusIn: onFocusIn };

    void overlay.offsetWidth;
    overlay.classList.add('rd-open');
    try { panel.focus({ preventScroll: true }); } catch (e) { panel.focus(); }
  }

  function closeHelp() {
    if (!sheet) return;
    var s = sheet;
    sheet = null;
    doc.removeEventListener('keydown', s.onKey, true);
    doc.removeEventListener('focusin', s.onFocusIn, true);
    doc.body.classList.remove('modal-open');
    s.overlay.classList.remove('rd-open');
    var finish = function () {
      if (s.overlay.parentNode) s.overlay.parentNode.removeChild(s.overlay);
      var t = s.trigger;
      try { if (t && t !== doc.body && doc.contains(t) && t.focus) t.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
    };
    if (reducedMotion()) finish(); else setTimeout(finish, 320);
  }

  /* ----------------------------------------------------------- suggest banner */
  function hideBanner(immediate) {
    if (!banner) return;
    var b = banner;
    banner = null;
    clearTimeout(b.timer);
    b.el.classList.remove('rd-in');
    var rm = function () { if (b.el.parentNode) b.el.parentNode.removeChild(b.el); };
    if (immediate || reducedMotion()) rm(); else setTimeout(rm, 450);
  }

  function dismissals() { return parseInt(lsGet(K_DISMISS_COUNT) || '0', 10) || 0; }
  function recordDismissal() {
    lsSet(K_DISMISSED_AT, Date.now());
    lsSet(K_DISMISS_COUNT, dismissals() + 1);
  }
  function suggestAllowed() {
    if (suggestShown || sheet || banner) return false;
    if (!canInstall()) return false;
    if (dismissals() >= 3) return false;
    var at = parseInt(lsGet(K_DISMISSED_AT) || '0', 10) || 0;
    if (at && Date.now() - at < WEEK) return false;
    return true;
  }

  function suggest() {
    try {
      if (!doc.body || !suggestAllowed()) return;
      suggestShown = true;
      injectStyle();

      var el = h('div', 'rd-ins rd-banner', null, { role: 'region', 'aria-label': 'Install Road Dash' });
      var img = h('img', 'rd-bicon', null, { src: '/icons/icon-192.png', alt: '', width: '42', height: '42' });
      img.addEventListener('error', function () { img.style.display = 'none'; });
      var txt = h('div', 'rd-btxt');
      txt.appendChild(h('strong', null, 'Install Road Dash'));
      txt.appendChild(h('span', null, 'Instant play & offline'));
      var act = h('div', 'rd-bact');
      var no = h('button', 'rd-btn rd-ghost', 'Not now', { type: 'button' });
      var yes = h('button', 'rd-btn rd-primary', 'Install', { type: 'button' });
      act.appendChild(no);
      act.appendChild(yes);
      el.appendChild(img); el.appendChild(txt); el.appendChild(act);
      doc.body.appendChild(el);

      var b = { el: el, timer: 0 };
      banner = b;
      function arm(ms) { clearTimeout(b.timer); b.timer = setTimeout(function () { if (banner === b) hideBanner(); }, ms); }
      el.addEventListener('mouseenter', function () { clearTimeout(b.timer); });
      el.addEventListener('mouseleave', function () { arm(6000); });
      el.addEventListener('focusin', function () { clearTimeout(b.timer); });
      el.addEventListener('focusout', function () { arm(6000); });
      no.addEventListener('click', function () { recordDismissal(); hideBanner(); });
      yes.addEventListener('click', function () { hideBanner(true); promptInstall(); });

      void el.offsetWidth; el.classList.add('rd-in');
      arm(12000);
    } catch (e) { /* never break the game */ }
  }

  /* ---------------------------------------------------------- install flow */
  function markInstalled() {
    lsSet(K_INSTALLED, '1');
    deferredPrompt = null;
    closeHelp();
    hideBanner(true);
    update();
  }

  function promptInstall() {
    if (isInstalled()) return Promise.resolve('unavailable');
    if (deferredPrompt) {
      var ev = deferredPrompt;
      deferredPrompt = null;            // a prompt event can only be used once
      promptConsumed = true;
      hideBanner(true);
      var choice;
      try {
        ev.prompt();
        choice = Promise.resolve(ev.userChoice);
      } catch (e) {
        update();
        return Promise.resolve(canInstall() ? (showHelp(), 'help') : 'unavailable');
      }
      return choice.then(function (r) {
        if (r && r.outcome === 'accepted') {
          markInstalled();
          toast('App installed 🎉');
          emit('roaddash:installed', { outcome: 'accepted' });
          return 'accepted';
        }
        recordDismissal();
        update();
        return 'dismissed';
      }, function () { update(); return 'dismissed'; });
    }
    if (canInstall()) { showHelp(); return Promise.resolve('help'); }
    return Promise.resolve('unavailable');
  }

  /* ------------------------------------------------- [data-install-btn] sync */
  function onInstallBtnClick(e) {
    e.preventDefault();
    promptInstall();
  }

  function scanButtons() {
    var list = doc.querySelectorAll('[data-install-btn]');
    var show = canInstall();
    for (var i = 0; i < list.length; i++) {
      var b = list[i];
      if (seenButtons.indexOf(b) === -1) {
        seenButtons.push(b);
        b.addEventListener('click', onInstallBtnClick);
        if (b.tagName !== 'BUTTON' && b.tagName !== 'A' && !b.hasAttribute('tabindex')) b.setAttribute('tabindex', '0');
        if (b.tagName !== 'BUTTON' && !b.hasAttribute('role')) b.setAttribute('role', 'button');
        if (b.tagName !== 'BUTTON') b.addEventListener('keydown', function (ev) {
          if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); promptInstall(); }
        });
      }
      b.hidden = !show;
      if (show) b.removeAttribute('aria-hidden'); else b.setAttribute('aria-hidden', 'true');
    }
    // Forget buttons that left the DOM.
    seenButtons = seenButtons.filter(function (b) { return doc.contains(b); });
  }

  function update() {
    scanButtons();
    var available = canInstall();
    if (available !== lastAvailable) {
      lastAvailable = available;
      emit('roaddash:install-availability', { available: available });
    }
    if (!available) hideBanner(true);
  }

  /* ------------------------------------------------------------- bootstrap */
  function registerSW() {
    try {
      if (!('serviceWorker' in nav)) return;
      var host = location.hostname;
      var ok = location.protocol === 'https:' || host === 'localhost' || host === '127.0.0.1';
      if (!ok) return;
      nav.serviceWorker.register('/sw.js', { scope: '/' }).catch(function () { /* offline support is optional */ });
      // A new worker skipWaiting()s and claims clients on its own; we never
      // reload mid-game, the fresh code simply applies on the next load.
    } catch (e) { /* ignore */ }
  }

  function init() {
    // Any sign we are inside the installed app: remember it for browser tabs.
    if (standaloneNow()) lsSet(K_INSTALLED, '1');

    ['(display-mode: standalone)', '(display-mode: minimal-ui)', '(display-mode: fullscreen)'].forEach(function (q) {
      var m = mq(q);
      if (!m) return;
      var fn = function () { if (standaloneNow()) lsSet(K_INSTALLED, '1'); update(); };
      if (m.addEventListener) m.addEventListener('change', fn); else if (m.addListener) m.addListener(fn);
    });

    doc.addEventListener('roaddash:rescan-install', update);

    if ('MutationObserver' in win) {
      new MutationObserver(function (muts) {
        for (var i = 0; i < muts.length; i++) {
          var added = muts[i].addedNodes;
          for (var j = 0; j < added.length; j++) {
            var n = added[j];
            if (n.nodeType === 1 && (n.hasAttribute('data-install-btn') || (n.querySelector && n.querySelector('[data-install-btn]')))) {
              update();
              return;
            }
          }
        }
      }).observe(doc.documentElement, { childList: true, subtree: true });
    }

    // Android browsers that never fire the event still get manual help.
    if (IS_ANDROID && !IN_APP) {
      setTimeout(function () { androidWaited = true; update(); }, 4000);
    }

    update();
    if (doc.readyState === 'complete') registerSW(); else win.addEventListener('load', registerSW);
  }

  win.RoadDashInstall = {
    isInstalled: isInstalled,
    canInstall: canInstall,
    promptInstall: promptInstall,
    showHelp: function () { try { if (!isInstalled()) showHelp(); } catch (e) { /* ignore */ } },
    suggest: suggest
  };

  // These must be attached immediately: beforeinstallprompt can fire before DOMContentLoaded.
  win.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferredPrompt = e;
    lsDel(K_INSTALLED);              // the browser offers install, so it is not installed (any more)
    update();
  });
  win.addEventListener('appinstalled', function () {
    markInstalled();
    toast('App installed 🎉');
    emit('roaddash:installed', { outcome: 'appinstalled' });
  });

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init); else init();
})();
