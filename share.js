/*!
 * Road Dash - viral share system.
 * Canvas score card + share sheet (WhatsApp, Instagram, Facebook, X, Telegram, copy, save, native).
 * Self-contained: injects its own <style id="rd-share-css"> and DOM. No dependencies.
 *
 * window.RoadDashShare = { open(data), buildCardBlob(data), getChallenge(), isOpen(), close() }
 */
(function () {
  'use strict';
  if (window.RoadDashShare) return;

  /* ------------------------------------------------------------------ */
  /* constants + small utils                                             */
  /* ------------------------------------------------------------------ */
  var NAME_KEY = 'roaddash_player_name';
  var MAX_NUM = 9999999;
  var NAME_MAX = 20;
  var CARD_W = 1080, CARD_H = 1350;
  var FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
  var ACCENT = '#22e08a';
  var CLASSIC = { name: 'Classic', c1: '#2af0a0', c2: '#0f9d58' };
  var DIFF = {
    easy:   { label: 'EASY',   color: '#22e08a' },
    normal: { label: 'NORMAL', color: '#ffb020' },
    hard:   { label: 'HARD',   color: '#ff5470' }
  };
  var HEX_RE = /^#[0-9a-f]{6}$/i;
  var NAME_STRIP_RE = /[\u0000-\u001f\u007f-\u009f\u2028\u2029\u200e\u200f\u202a-\u202e\u2066-\u2069<>&"']/g;

  function lsGet(k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { window.localStorage.setItem(k, v); } catch (e) { /* private mode */ } }

  function clampInt(v, max) {
    v = Number(v);
    if (!isFinite(v) || v < 0) return 0;
    v = Math.floor(v);
    return v > max ? max : v;
  }
  function cleanStr(v, max) {
    if (typeof v !== 'string') return '';
    v = v.replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029\u202a-\u202e\u2066-\u2069]/g, '').trim();
    return Array.from(v).slice(0, max).join('');
  }
  function sanitizeName(raw) {
    var s = String(raw == null ? '' : raw).replace(NAME_STRIP_RE, '').replace(/\s+/g, ' ').trim();
    return Array.from(s).slice(0, NAME_MAX).join('').trim();
  }
  function fmt(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  function fmtTime(s) {
    var hr = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
    var two = function (n) { return (n < 10 ? '0' : '') + n; };
    return hr > 0 ? hr + ':' + two(m) + ':' + two(r) : m + ':' + two(r);
  }

  function normalize(data) {
    data = data && typeof data === 'object' ? data : {};
    var mode = data.mode === 'invite' ? 'invite' : 'score';
    var score = clampInt(data.score, MAX_NUM);
    var best = clampInt(data.best, MAX_NUM);
    if (mode === 'score' && best < score) best = score;
    var sk = data.skin && typeof data.skin === 'object' ? data.skin : {};
    var skin = (typeof sk.c1 === 'string' && typeof sk.c2 === 'string' && HEX_RE.test(sk.c1) && HEX_RE.test(sk.c2))
      ? { name: cleanStr(sk.name, 24) || 'Custom', c1: sk.c1, c2: sk.c2 }
      : { name: CLASSIC.name, c1: CLASSIC.c1, c2: CLASSIC.c2 };
    var name = typeof data.name === 'string' ? sanitizeName(data.name) : sanitizeName(lsGet(NAME_KEY));
    return {
      mode: mode,
      score: score,
      best: best,
      coins: clampInt(data.coins, MAX_NUM),
      difficulty: DIFF[data.difficulty] ? data.difficulty : 'normal',
      skin: skin,
      isNewBest: mode === 'score' && !!data.isNewBest && score > 0,
      survivalSecs: clampInt(data.survivalSecs, 359999),
      nearMisses: clampInt(data.nearMisses, MAX_NUM),
      bestCombo: clampInt(data.bestCombo, MAX_NUM),
      name: name
    };
  }

  /* ------------------------------------------------------------------ */
  /* links + text                                                         */
  /* ------------------------------------------------------------------ */
  function baseUrl() {
    try {
      var c = document.querySelector('link[rel="canonical"]');
      var h = c && c.getAttribute('href');
      if (h) { var u = new URL(h, window.location.href); return u.origin + u.pathname; }
    } catch (e) { /* fall through */ }
    return window.location.origin + '/';
  }
  function siteHost() {
    try { return new URL(baseUrl()).host; } catch (e) { return window.location.host || ''; }
  }
  function buildLink(d, target) {
    var q = [];
    if (d.mode === 'invite') {
      if (d.best > 0) { q.push('s=' + d.best); if (d.name) q.push('n=' + encodeURIComponent(d.name)); }
      q.push('utm_source=invite');
    } else {
      if (d.score > 0) q.push('s=' + d.score);
      if (d.name) q.push('n=' + encodeURIComponent(d.name));
      q.push('utm_source=share');
    }
    q.push('utm_medium=' + encodeURIComponent(target));
    return baseUrl() + '?' + q.join('&');
  }
  function shareText(d) {
    if (d.mode === 'invite') {
      return d.best > 0
        ? 'My best on Road Dash is ' + d.best + ' 🚗💨 Think you can beat me?'
        : 'Try Road Dash — free car dodging game in your browser 🚗💨';
    }
    return 'I scored ' + d.score + ' on Road Dash 🚗💨 Think you can beat me?' +
      (d.isNewBest ? ' New personal best! 🏆' : '');
  }

  function getChallenge() {
    try {
      var p = new URLSearchParams(window.location.search);
      var s = p.get('s');
      if (s == null) return null;
      s = s.trim();
      if (!/^\d{1,7}$/.test(s)) return null;
      var n = parseInt(s, 10);
      if (n < 1 || n > MAX_NUM) return null;
      return { score: n, name: sanitizeName(p.get('n')) };
    } catch (e) { return null; }
  }

  /* ------------------------------------------------------------------ */
  /* canvas helpers                                                       */
  /* ------------------------------------------------------------------ */
  function rr(ctx, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }
  function rgba(hex, a) {
    var n = parseInt(hex.slice(1), 16);
    return 'rgba(' + (n >> 16) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }
  function mix(h1, h2, t) {
    var a = parseInt(h1.slice(1), 16), b = parseInt(h2.slice(1), 16), o = 0;
    for (var i = 16; i >= 0; i -= 8) {
      var c = Math.round(((a >> i) & 255) * (1 - t) + ((b >> i) & 255) * t);
      o = (o << 8) | c;
    }
    return '#' + ('000000' + o.toString(16)).slice(-6);
  }
  function mulberry(seed) {
    var a = (seed * 2654435761 + 1013904223) >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function setFont(ctx, weight, size) { ctx.font = weight + ' ' + Math.round(size) + 'px ' + FONT; }
  function spacedW(ctx, str, sp) {
    var cs = Array.from(str), w = 0;
    for (var i = 0; i < cs.length; i++) w += ctx.measureText(cs[i]).width;
    return w + sp * Math.max(0, cs.length - 1);
  }
  function drawSpaced(ctx, str, x, y, sp, align) {
    var cs = Array.from(str), total = spacedW(ctx, str, sp);
    var cx = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
    ctx.textAlign = 'left';
    for (var i = 0; i < cs.length; i++) {
      ctx.fillText(cs[i], cx, y);
      cx += ctx.measureText(cs[i]).width + sp;
    }
    return total;
  }
  function ellipsize(ctx, str, maxW) {
    if (ctx.measureText(str).width <= maxW) return str;
    var cs = Array.from(str), lo = 0, hi = cs.length;
    while (lo < hi) {
      var mid = Math.ceil((lo + hi) / 2);
      if (ctx.measureText(cs.slice(0, mid).join('') + '…').width <= maxW) lo = mid; else hi = mid - 1;
    }
    return cs.slice(0, lo).join('').replace(/\s+$/, '') + '…';
  }
  function fitSize(ctx, weight, str, maxSize, maxW, minSize) {
    var s = maxSize;
    while (s > minSize) {
      setFont(ctx, weight, s);
      if (ctx.measureText(str).width <= maxW) return s;
      s -= 2;
    }
    return minSize;
  }
  function star(ctx, cx, cy, R, r) {
    ctx.beginPath();
    for (var i = 0; i < 10; i++) {
      var ang = -Math.PI / 2 + i * Math.PI / 5, rad = i % 2 ? r : R;
      ctx.lineTo(cx + Math.cos(ang) * rad, cy + Math.sin(ang) * rad);
    }
    ctx.closePath();
  }

  /* ---- cars + coins -------------------------------------------------- */
  function drawCar(ctx, cx, cy, w, h, c1, c2, o) {
    o = o || {};
    ctx.save();
    ctx.translate(cx, cy);
    if (o.tilt) ctx.rotate(o.tilt);
    var r = w * 0.3;

    if (o.shield) {
      var sg = ctx.createRadialGradient(0, 0, w * 0.4, 0, 0, h * 0.78);
      sg.addColorStop(0, rgba(c1, 0.0));
      sg.addColorStop(0.7, rgba(c1, 0.16));
      sg.addColorStop(1, rgba(c1, 0));
      ctx.fillStyle = sg;
      rr(ctx, -w * 0.95, -h * 0.66, w * 1.9, h * 1.32, w * 0.95);
      ctx.fill();
      ctx.save();
      ctx.shadowColor = rgba(c1, 0.9);
      ctx.shadowBlur = 30;
      ctx.lineWidth = 6;
      ctx.strokeStyle = rgba(c1, 0.75);
      rr(ctx, -w * 0.8, -h * 0.6, w * 1.6, h * 1.2, w * 0.8);
      ctx.stroke();
      ctx.restore();
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      rr(ctx, -w * 0.8, -h * 0.6, w * 1.6, h * 1.2, w * 0.8);
      ctx.stroke();
    }

    // drop shadow
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = w * 0.45;
    ctx.shadowOffsetY = h * 0.06;
    ctx.fillStyle = c2;
    rr(ctx, -w / 2, -h / 2, w, h, r);
    ctx.fill();
    ctx.restore();

    // body
    var g = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
    g.addColorStop(0, c1);
    g.addColorStop(1, c2);
    ctx.fillStyle = g;
    rr(ctx, -w / 2, -h / 2, w, h, r);
    ctx.fill();
    // side sheen
    var sh = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
    sh.addColorStop(0, 'rgba(255,255,255,0.28)');
    sh.addColorStop(0.4, 'rgba(255,255,255,0)');
    sh.addColorStop(1, 'rgba(0,0,0,0.26)');
    ctx.fillStyle = sh;
    rr(ctx, -w / 2, -h / 2, w, h, r);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    rr(ctx, -w / 2, -h / 2, w, h, r);
    ctx.stroke();

    // hood + trunk creases
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    rr(ctx, -w * 0.33, -h * 0.44, w * 0.66, h * 0.2, w * 0.12);
    ctx.stroke();
    rr(ctx, -w * 0.33, h * 0.25, w * 0.66, h * 0.17, w * 0.12);
    ctx.stroke();

    // roof
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    rr(ctx, -w * 0.33, -h * 0.07, w * 0.66, h * 0.2, w * 0.1);
    ctx.fill();

    // glass
    var gl = ctx.createLinearGradient(0, -h * 0.25, 0, h * 0.26);
    gl.addColorStop(0, 'rgba(8,16,36,0.92)');
    gl.addColorStop(1, 'rgba(34,52,92,0.82)');
    ctx.fillStyle = gl;
    ctx.beginPath(); // windshield
    ctx.moveTo(-w * 0.27, -h * 0.25);
    ctx.lineTo(w * 0.27, -h * 0.25);
    ctx.lineTo(w * 0.35, -h * 0.085);
    ctx.lineTo(-w * 0.35, -h * 0.085);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath(); // rear window
    ctx.moveTo(-w * 0.35, h * 0.145);
    ctx.lineTo(w * 0.35, h * 0.145);
    ctx.lineTo(w * 0.28, h * 0.25);
    ctx.lineTo(-w * 0.28, h * 0.25);
    ctx.closePath();
    ctx.fill();
    // side windows
    rr(ctx, -w * 0.385, -h * 0.065, w * 0.05, h * 0.19, w * 0.02);
    ctx.fill();
    rr(ctx, w * 0.335, -h * 0.065, w * 0.05, h * 0.19, w * 0.02);
    ctx.fill();
    // glass glint
    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.lineWidth = Math.max(2, w * 0.025);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-w * 0.2, -h * 0.225);
    ctx.lineTo(-w * 0.07, -h * 0.225);
    ctx.stroke();

    // head + tail lights
    ctx.save();
    ctx.shadowColor = 'rgba(255,244,190,0.95)';
    ctx.shadowBlur = w * 0.28;
    ctx.fillStyle = '#fff8dc';
    rr(ctx, -w * 0.38, -h * 0.485, w * 0.21, h * 0.045, h * 0.02);
    ctx.fill();
    rr(ctx, w * 0.17, -h * 0.485, w * 0.21, h * 0.045, h * 0.02);
    ctx.fill();
    ctx.shadowColor = 'rgba(255,40,70,0.95)';
    ctx.fillStyle = '#ff3b55';
    rr(ctx, -w * 0.38, h * 0.44, w * 0.21, h * 0.04, h * 0.02);
    ctx.fill();
    rr(ctx, w * 0.17, h * 0.44, w * 0.21, h * 0.04, h * 0.02);
    ctx.fill();
    ctx.restore();

    ctx.restore();
  }

  function drawCoin(ctx, x, y, r) {
    ctx.save();
    ctx.shadowColor = 'rgba(255,176,32,0.65)';
    ctx.shadowBlur = r * 0.9;
    var g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.1, x, y, r);
    g.addColorStop(0, '#fff0a8');
    g.addColorStop(0.55, '#ffcb3d');
    g.addColorStop(1, '#ff9f0a');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.lineWidth = Math.max(1.5, r * 0.12);
    ctx.strokeStyle = '#c47a00';
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = Math.max(1, r * 0.09);
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath(); ctx.arc(x, y, r * 0.64, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.beginPath(); ctx.ellipse(x - r * 0.3, y - r * 0.34, r * 0.16, r * 0.1, -0.6, 0, Math.PI * 2); ctx.fill();
  }

  /* ---- road panel ---------------------------------------------------- */
  function drawRoad(ctx, d, X, Y, W, H) {
    var rnd = mulberry(d.score * 31 + d.best * 7 + 5);
    var c1 = d.skin.c1, c2 = d.skin.c2;
    var curb = 44, roadL = X + curb, roadR = X + W - curb, laneW = (roadR - roadL) / 3;
    var lx = [roadL + laneW / 2, roadL + laneW * 1.5, roadL + laneW * 2.5];

    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = 50;
    ctx.shadowOffsetY = 18;
    ctx.fillStyle = '#0e1528';
    rr(ctx, X, Y, W, H, 38);
    ctx.fill();
    ctx.restore();

    ctx.save();
    rr(ctx, X, Y, W, H, 38);
    ctx.clip();

    var ag = ctx.createLinearGradient(0, Y, 0, Y + H);
    ag.addColorStop(0, '#18233f');
    ag.addColorStop(1, '#0b1326');
    ctx.fillStyle = ag;
    ctx.fillRect(X, Y, W, H);

    var glow = ctx.createRadialGradient(540, Y + H * 0.72, 10, 540, Y + H * 0.72, 460);
    glow.addColorStop(0, rgba(c1, 0.34));
    glow.addColorStop(1, rgba(c1, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(X, Y, W, H);

    // curbs
    ctx.fillStyle = '#0a1020';
    ctx.fillRect(X, Y, curb, H);
    ctx.fillRect(roadR, Y, curb, H);
    var off = Math.floor(rnd() * 48);
    for (var yy = Y - 48 + off; yy < Y + H; yy += 48) {
      ctx.fillStyle = 'rgba(241,244,251,0.42)';
      ctx.fillRect(X, yy, curb, 24);
      ctx.fillRect(roadR, yy, curb, 24);
      ctx.fillStyle = 'rgba(255,84,112,0.45)';
      ctx.fillRect(X, yy + 24, curb, 24);
      ctx.fillRect(roadR, yy + 24, curb, 24);
    }
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillRect(roadL - 3, Y, 3, H);
    ctx.fillRect(roadR, Y, 3, H);

    // lane dividers
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 6;
    ctx.setLineDash([48, 40]);
    ctx.lineDashOffset = -Math.floor(rnd() * 88);
    for (var k = 1; k < 3; k++) {
      var dx = roadL + laneW * k;
      ctx.beginPath(); ctx.moveTo(dx, Y); ctx.lineTo(dx, Y + H); ctx.stroke();
    }
    ctx.setLineDash([]);

    // speed streaks
    ctx.lineCap = 'round';
    for (var i = 0; i < 34; i++) {
      var sx = roadL + 12 + rnd() * (roadR - roadL - 24), sy = Y + rnd() * H, sl = 70 + rnd() * 150;
      var sg = ctx.createLinearGradient(0, sy, 0, sy + sl);
      var al = 0.05 + rnd() * 0.13;
      sg.addColorStop(0, 'rgba(255,255,255,0)');
      sg.addColorStop(1, 'rgba(255,255,255,' + al.toFixed(3) + ')');
      ctx.strokeStyle = sg;
      ctx.lineWidth = 2 + rnd() * 2.5;
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx, sy + sl); ctx.stroke();
    }

    // street lights on the curbs
    for (var ly = Y + 30; ly < Y + H; ly += 112) {
      [X + curb / 2, roadR + curb / 2].forEach(function (lcx) {
        var hg = ctx.createRadialGradient(lcx, ly, 1, lcx, ly, 46);
        hg.addColorStop(0, 'rgba(255,214,120,0.55)');
        hg.addColorStop(1, 'rgba(255,214,120,0)');
        ctx.fillStyle = hg;
        ctx.beginPath(); ctx.arc(lcx, ly, 46, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff1c2';
        ctx.beginPath(); ctx.arc(lcx, ly, 8, 0, Math.PI * 2); ctx.fill();
      });
    }

    // coins
    drawCoin(ctx, lx[2], Y + 56, 23);
    drawCoin(ctx, lx[2], Y + 112, 23);
    drawCoin(ctx, lx[0], Y + 338, 23);
    drawCoin(ctx, lx[0], Y + 398, 23);

    // traffic
    drawCar(ctx, lx[0], Y + 150, 112, 200, '#ff6b81', '#c0392b', { tilt: -0.025 });
    drawCar(ctx, lx[2], Y + 262, 112, 200, '#5dd5ff', '#1a73e8', { tilt: 0.02 });
    drawCar(ctx, lx[1], Y + 118, 96, 172, '#ffb064', '#e0661a', { tilt: 0.0 });
    drawCar(ctx, lx[0] + 8, Y + 452, 96, 172, '#c58bff', '#7c3aed', { tilt: 0.03 });

    // player
    drawCar(ctx, lx[1], Y + 340, 120, 214, c1, c2, { tilt: -0.1, shield: true });

    // depth vignette
    var vg = ctx.createLinearGradient(0, Y, 0, Y + H);
    vg.addColorStop(0, 'rgba(6,10,20,0.55)');
    vg.addColorStop(0.3, 'rgba(6,10,20,0)');
    vg.addColorStop(0.85, 'rgba(6,10,20,0)');
    vg.addColorStop(1, 'rgba(6,10,20,0.4)');
    ctx.fillStyle = vg;
    ctx.fillRect(X, Y, W, H);
    ctx.restore();

    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    rr(ctx, X + 1, Y + 1, W - 2, H - 2, 37);
    ctx.stroke();
  }

  /* ---- stat pills ---------------------------------------------------- */
  function icoClock(ctx, x, y, r) {
    ctx.strokeStyle = '#9db4ff'; ctx.lineWidth = Math.max(2, r * 0.16); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x, y - r * 0.55); ctx.lineTo(x, y); ctx.lineTo(x + r * 0.45, y + r * 0.3); ctx.stroke();
  }

  function buildPills(ctx, d, scale) {
    var s = scale, gap = 12 * s, pad = 26 * s, items = [];
    function text(str, weight, size, color, sp) { return { t: 'text', str: str, weight: weight, size: size * s, color: color, sp: (sp || 0) * s }; }
    function icon(kind, w, color) { return { t: 'icon', kind: kind, w: w * s, color: color }; }
    function pillOf(parts, tint) { items.push({ parts: parts, tint: tint }); }

    if (d.mode === 'score') {
      pillOf([icon('coin', 32), text(fmt(d.coins), 800, 34, '#ffffff')]);
      pillOf([icon('dot', 20, DIFF[d.difficulty].color), text(DIFF[d.difficulty].label, 800, 30, DIFF[d.difficulty].color, 2)], DIFF[d.difficulty].color);
      pillOf([text('BEST', 700, 24, '#8d9bbd', 2), text(fmt(d.best), 800, 34, '#ffffff')]);
      if (d.survivalSecs > 0) pillOf([icon('clock', 30), text(fmtTime(d.survivalSecs), 800, 34, '#ffffff')]);
    } else {
      pillOf([icon('coin', 32), text(fmt(d.coins), 800, 34, '#ffffff')]);
      pillOf([icon('dot', 20, DIFF[d.difficulty].color), text(DIFF[d.difficulty].label, 800, 30, DIFF[d.difficulty].color, 2)], DIFF[d.difficulty].color);
      pillOf([icon('swatch', 28), text(d.skin.name.toUpperCase(), 800, 26, '#ffffff', 2)]);
    }

    var maxNameW = 300 * s;
    items.forEach(function (it) {
      var w = 0;
      it.parts.forEach(function (p, i) {
        if (p.t === 'text') {
          setFont(ctx, p.weight, p.size);
          var str = p.str;
          if (spacedW(ctx, str, p.sp) > maxNameW) {
            // ellipsize skin name inside pill
            var cs = Array.from(str);
            while (cs.length > 1 && spacedW(ctx, cs.join('') + '…', p.sp) > maxNameW) cs.pop();
            str = cs.join('') + '…';
          }
          p.str = str;
          p.w = spacedW(ctx, str, p.sp);
        }
        w += p.w + (i ? gap : 0);
      });
      it.w = w + pad * 2;
    });
    var total = 0;
    items.forEach(function (it, i) { total += it.w + (i ? 14 : 0); });
    return { items: items, total: total, gap: gap, pad: pad, s: s };
  }

  function drawPills(ctx, d, cy, maxW) {
    var scale = 1, row = buildPills(ctx, d, scale);
    while (row.total > maxW && scale > 0.5) { scale -= 0.06; row = buildPills(ctx, d, scale); }
    var h = 64 * scale, x = CARD_W / 2 - row.total / 2;
    row.items.forEach(function (it) {
      var tint = it.tint;
      ctx.fillStyle = tint ? rgba(tint, 0.14) : 'rgba(255,255,255,0.07)';
      rr(ctx, x, cy - h / 2, it.w, h, h / 2); ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = tint ? rgba(tint, 0.6) : 'rgba(255,255,255,0.15)';
      rr(ctx, x + 1, cy - h / 2 + 1, it.w - 2, h - 2, h / 2 - 1); ctx.stroke();
      var px = x + row.pad;
      it.parts.forEach(function (p, i) {
        if (i) px += row.gap;
        if (p.t === 'icon') {
          var r = p.w / 2, ix = px + r;
          if (p.kind === 'coin') drawCoin(ctx, ix, cy, r * 0.92);
          else if (p.kind === 'dot') { ctx.save(); ctx.shadowColor = p.color; ctx.shadowBlur = 12; ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(ix, cy, r * 0.5, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
          else if (p.kind === 'clock') icoClock(ctx, ix, cy, r * 0.82);
          else if (p.kind === 'swatch') {
            var g = ctx.createLinearGradient(ix - r, cy - r, ix + r, cy + r);
            g.addColorStop(0, d.skin.c1); g.addColorStop(1, d.skin.c2);
            ctx.fillStyle = g; ctx.beginPath(); ctx.arc(ix, cy, r * 0.85, 0, Math.PI * 2); ctx.fill();
            ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.stroke();
          }
          px += p.w;
        } else {
          setFont(ctx, p.weight, p.size);
          ctx.fillStyle = p.color;
          ctx.textBaseline = 'middle';
          drawSpaced(ctx, p.str, px, cy + 1 * scale, p.sp, 'left');
          ctx.textBaseline = 'alphabetic';
          px += p.w;
        }
      });
      x += it.w + 14;
    });
  }

  /* ---- the card ------------------------------------------------------ */
  function renderCard(d) {
    var cv = document.createElement('canvas');
    cv.width = CARD_W; cv.height = CARD_H;
    var ctx = cv.getContext('2d');
    var c1 = d.skin.c1, c2 = d.skin.c2;
    ctx.textBaseline = 'alphabetic';

    // background
    var bg = ctx.createLinearGradient(0, 0, 0, CARD_H);
    bg.addColorStop(0, '#0e1730');
    bg.addColorStop(0.5, '#08101f');
    bg.addColorStop(1, '#050913');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, CARD_W, CARD_H);
    var rg = ctx.createRadialGradient(540, 560, 20, 540, 560, 820);
    rg.addColorStop(0, rgba(c1, 0.32));
    rg.addColorStop(0.55, rgba(c2, 0.1));
    rg.addColorStop(1, rgba(c2, 0));
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, CARD_W, CARD_H);
    var rg2 = ctx.createRadialGradient(540, 1360, 10, 540, 1360, 620);
    rg2.addColorStop(0, rgba(ACCENT, 0.16));
    rg2.addColorStop(1, rgba(ACCENT, 0));
    ctx.fillStyle = rg2;
    ctx.fillRect(0, 0, CARD_W, CARD_H);
    // fine diagonal texture
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.025)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (var t = -CARD_H; t < CARD_W; t += 16) { ctx.moveTo(t, CARD_H); ctx.lineTo(t + CARD_H, 0); }
    ctx.stroke();
    ctx.restore();

    // top bar
    drawCar(ctx, 84, 92, 32, 56, c1, c2, { tilt: 0 });
    setFont(ctx, 800, 46);
    var wg = ctx.createLinearGradient(124, 0, 440, 0);
    wg.addColorStop(0, '#ffffff'); wg.addColorStop(1, '#9db4ff');
    ctx.fillStyle = wg;
    drawSpaced(ctx, 'ROAD DASH', 126, 108, 5, 'left');
    setFont(ctx, 700, 21);
    var pw = spacedW(ctx, 'FREE BROWSER GAME', 2) + 44;
    ctx.fillStyle = rgba(ACCENT, 0.12);
    rr(ctx, 1020 - pw, 70, pw, 46, 23); ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = rgba(ACCENT, 0.5);
    rr(ctx, 1021 - pw, 71, pw - 2, 44, 22); ctx.stroke();
    ctx.fillStyle = ACCENT;
    ctx.textBaseline = 'middle';
    drawSpaced(ctx, 'FREE BROWSER GAME', 1020 - pw / 2, 94, 2, 'center');
    ctx.textBaseline = 'alphabetic';

    // hero road
    drawRoad(ctx, d, 60, 150, 960, 480);

    // text stack
    var invite = d.mode === 'invite';
    var heroNum = invite ? d.best : d.score;
    var blocks = [];
    var H_LABEL = 40, GAP_NUM = 8;

    if (invite && d.best === 0) {
      var lines = ['DODGE TRAFFIC.', 'COLLECT COINS.', 'BEAT YOUR BEST.'];
      blocks.push({ h: 270, draw: function (y) {
        lines.forEach(function (ln, i) {
          var sz = fitSize(ctx, 800, ln, 82, 920, 40);
          setFont(ctx, 800, sz);
          var gr = ctx.createLinearGradient(0, y + i * 90, 0, y + i * 90 + 70);
          gr.addColorStop(0, '#ffffff');
          gr.addColorStop(1, i === 2 ? ACCENT : '#b9c8ff');
          ctx.fillStyle = gr;
          ctx.textAlign = 'center';
          ctx.fillText(ln, 540, y + 66 + i * 90);
        });
      } });
    } else {
      var numStr = fmt(heroNum);
      var size = fitSize(ctx, 800, numStr, 230, 900, 90);
      var capH = Math.round(size * 0.73);
      blocks.push({ h: H_LABEL + GAP_NUM + capH + Math.round(size * 0.1), draw: function (y) {
        setFont(ctx, 700, 32);
        ctx.fillStyle = '#8d9bbd';
        drawSpaced(ctx, invite ? 'MY BEST SCORE' : 'SCORE', 540, y + 30, 6, 'center');
        var by = y + H_LABEL + GAP_NUM + capH;
        setFont(ctx, 800, size);
        ctx.textAlign = 'center';
        ctx.save();
        ctx.shadowColor = rgba(ACCENT, 0.5);
        ctx.shadowBlur = 56;
        ctx.fillStyle = '#ffffff';
        ctx.fillText(numStr, 540, by);
        ctx.restore();
        var gr = ctx.createLinearGradient(0, by - capH, 0, by);
        gr.addColorStop(0, '#ffffff');
        gr.addColorStop(1, ACCENT);
        ctx.fillStyle = gr;
        ctx.fillText(numStr, 540, by);
      } });
    }

    if (d.isNewBest) {
      blocks.push({ h: 54, draw: function (y) {
        var label = 'NEW PERSONAL BEST';
        setFont(ctx, 800, 28);
        var tw = spacedW(ctx, label, 3), pw2 = tw + 2 * 40 + 2 * 34, x = 540 - pw2 / 2;
        var g = ctx.createLinearGradient(x, 0, x + pw2, 0);
        g.addColorStop(0, '#ffe58f'); g.addColorStop(1, '#ffb020');
        ctx.save();
        ctx.shadowColor = 'rgba(255,176,32,0.5)'; ctx.shadowBlur = 28;
        ctx.fillStyle = g;
        rr(ctx, x, y, pw2, 54, 27); ctx.fill();
        ctx.restore();
        ctx.fillStyle = '#3a2500';
        star(ctx, x + 34, y + 27, 14, 6); ctx.fill();
        star(ctx, x + pw2 - 34, y + 27, 14, 6); ctx.fill();
        ctx.textBaseline = 'middle';
        drawSpaced(ctx, label, 540, y + 29, 3, 'center');
        ctx.textBaseline = 'alphabetic';
      } });
    }

    if (d.name) {
      blocks.push({ h: 46, draw: function (y) {
        setFont(ctx, 600, 34);
        var prefix = 'by ', pwid = ctx.measureText(prefix).width;
        setFont(ctx, 800, 38);
        var nm = ellipsize(ctx, d.name, 880 - pwid);
        var nw = ctx.measureText(nm).width, x0 = 540 - (pwid + nw) / 2;
        ctx.textAlign = 'left';
        setFont(ctx, 600, 34);
        ctx.fillStyle = '#8d9bbd';
        ctx.fillText(prefix, x0, y + 36);
        setFont(ctx, 800, 38);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(nm, x0 + pwid, y + 36);
      } });
    }

    blocks.push({ h: 64, draw: function (y) { drawPills(ctx, d, y + 32, 940); } });

    var top = 654, bottom = 1130, sum = 0;
    blocks.forEach(function (b) { sum += b.h; });
    var gap = Math.max(22, Math.min(44, (bottom - top - sum) / (blocks.length + 0.5)));
    var used = sum + gap * (blocks.length - 1);
    var y = top + Math.max(0, (bottom - top - used) / 2);
    blocks.forEach(function (b) { b.draw(y); y += b.h + gap; });

    // CTA band
    var bx = 60, by2 = 1158, bw = 960, bh = 150;
    var cg = ctx.createLinearGradient(bx, 0, bx + bw, 0);
    cg.addColorStop(0, rgba(ACCENT, 0.2));
    cg.addColorStop(1, 'rgba(110,140,255,0.16)');
    ctx.fillStyle = cg;
    rr(ctx, bx, by2, bw, bh, 34); ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = rgba(ACCENT, 0.4);
    rr(ctx, bx + 1, by2 + 1, bw - 2, bh - 2, 33); ctx.stroke();

    var headline = invite ? (d.best > 0 ? 'Think you can beat me?' : 'Ready to race?') : (d.score > 0 ? 'Can you beat ' + fmt(d.score) + '?' : 'Ready to race?');
    var hs = fitSize(ctx, 800, headline, 58, bw - 70, 30);
    setFont(ctx, 800, hs);
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(headline, 540, by2 + 74);

    setFont(ctx, 600, 27);
    var sub = 'Play free • no download';
    var host = siteHost();
    setFont(ctx, 800, 26);
    var hostMax = 400;
    host = ellipsize(ctx, host, hostMax);
    var hw = ctx.measureText(host).width + 44;
    setFont(ctx, 600, 27);
    var sw = ctx.measureText(sub).width;
    var totalW = sw + 28 + hw, sx0 = 540 - totalW / 2;
    ctx.fillStyle = '#c3cee8';
    ctx.textAlign = 'left';
    ctx.fillText(sub, sx0, by2 + 124);
    var hx = sx0 + sw + 28;
    ctx.fillStyle = ACCENT;
    rr(ctx, hx, by2 + 94, hw, 40, 20); ctx.fill();
    setFont(ctx, 800, 26);
    ctx.fillStyle = '#04210f';
    ctx.textAlign = 'center';
    ctx.fillText(host, hx + hw / 2, by2 + 122);
    ctx.textAlign = 'left';

    return cv;
  }

  function buildCardBlob(data) {
    return new Promise(function (resolve, reject) {
      var cv;
      try { cv = renderCard(normalize(data)); } catch (e) { reject(e); return; }
      var viaDataUrl = function () {
        try {
          var u = cv.toDataURL('image/jpeg', 0.92), bin = atob(u.split(',')[1]), arr = new Uint8Array(bin.length);
          for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
          resolve(new Blob([arr], { type: 'image/jpeg' }));
        } catch (e) { reject(e); }
      };
      if (cv.toBlob) cv.toBlob(function (b) { if (b) resolve(b); else viaDataUrl(); }, 'image/jpeg', 0.92);
      else viaDataUrl();
    });
  }

  /* ------------------------------------------------------------------ */
  /* sheet: icons                                                         */
  /* ------------------------------------------------------------------ */
  var ICON = {
    whatsapp: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 2.8a9.2 9.2 0 0 1 0 18.4 9.2 9.2 0 0 1-4.5-1.17L3 21.2l1.25-4.35A9.2 9.2 0 0 1 12 2.8z" fill="none" stroke="#fff" stroke-width="1.9" stroke-linejoin="round"/><g transform="translate(12 12) scale(.4) translate(-12 -12)"><path fill="#fff" d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></g></svg>',
    instagram: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="3.6" y="3.6" width="16.8" height="16.8" rx="5" fill="none" stroke="#fff" stroke-width="1.9"/><circle cx="12" cy="12" r="3.9" fill="none" stroke="#fff" stroke-width="1.9"/><circle cx="16.9" cy="7.1" r="1.15" fill="#fff"/></svg>',
    facebook: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="#fff" d="M13.6 21.5v-7.9h2.7l.45-3.2H13.6V8.4c0-.95.3-1.55 1.6-1.55h1.7V4.05c-.3-.04-1.3-.12-2.45-.12-2.45 0-4.1 1.5-4.1 4.2v2.3H7.6v3.2h2.75v7.9h3.25z"/></svg>',
    x: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5.2 4.8 18.8 19.2" fill="none" stroke="#fff" stroke-width="2.7" stroke-linecap="round"/><path d="M18.6 4.8 5.4 19.2" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/></svg>',
    telegram: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M20.9 4.1 2.9 11c-.75.29-.73 1.36.03 1.62l4.5 1.5 1.75 5.4c.2.62.98.8 1.45.34l2.5-2.4 4.6 3.4c.5.37 1.22.1 1.36-.5l3-14.7c.15-.75-.58-1.37-1.2-1.1z" fill="#fff"/><path d="m8 13.2 8.9-5.9" fill="none" stroke="#229ED9" stroke-width="1.5" stroke-linecap="round"/></svg>',
    copy: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><g fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></g></svg>',
    save: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><g fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11"/><path d="m7.5 11 4.5 4.5 4.5-4.5"/><path d="M5 19.5h14"/></g></svg>',
    share: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><g fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V3.5"/><path d="m7.8 7.5 4.2-4.2 4.2 4.2"/><path d="M5 12v6.5A2.5 2.5 0 0 0 7.5 21h9a2.5 2.5 0 0 0 2.5-2.5V12"/></g></svg>',
    close: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>'
  };
  var TARGETS = [
    { id: 'whatsapp',  label: 'WhatsApp',  cls: 'wa' },
    { id: 'instagram', label: 'Instagram', cls: 'ig' },
    { id: 'facebook',  label: 'Facebook',  cls: 'fb' },
    { id: 'x',         label: 'X',         cls: 'x' },
    { id: 'telegram',  label: 'Telegram',  cls: 'tg' },
    { id: 'copy',      label: 'Copy link', cls: 'cp' },
    { id: 'save',      label: 'Save card', cls: 'sv' }
  ];

  /* ------------------------------------------------------------------ */
  /* sheet: css                                                           */
  /* ------------------------------------------------------------------ */
  var CSS = [
    '.rd-share{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:flex-end;justify-content:center;font-family:' + FONT + ';color:var(--text,#eef2fb);-webkit-tap-highlight-color:transparent;--rd-acc:var(--accent,#22e08a);--rd-dim:var(--text-dim,#7d8bab);--rd-line:var(--panel-border,#1e2b47);--rd-xring:rgba(255,255,255,.42);--rd-field:rgba(125,139,171,.13)}',
    'body[data-theme="day"] .rd-share{--rd-xring:transparent;--rd-field:rgba(20,33,61,.06)}',
    '.rd-share *{box-sizing:border-box}',
    '.rd-share[hidden],.rd-share [hidden]{display:none!important}',
    '.rd-share__bd{position:absolute;inset:0;background:rgba(3,7,16,.66);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);opacity:0;transition:opacity .28s ease}',
    '.rd-share.is-open .rd-share__bd{opacity:1}',
    '.rd-share__sheet{position:relative;display:flex;flex-direction:column;width:100%;max-width:520px;max-height:92vh;max-height:92dvh;background:var(--panel,#101a30);border:1px solid var(--rd-line);border-bottom:0;border-radius:26px 26px 0 0;box-shadow:0 -18px 60px rgba(0,0,0,.45);transform:translate3d(0,105%,0);transition:transform .46s cubic-bezier(.2,1.05,.3,1);outline:none;padding-bottom:env(safe-area-inset-bottom,0px);will-change:transform}',
    '.rd-share__sheet::after{content:"";position:absolute;left:-1px;right:-1px;top:100%;height:80px;background:var(--panel,#101a30)}',
    '.rd-share.is-open .rd-share__sheet{transform:none}',
    '.rd-share.is-closing .rd-share__sheet{transition:transform .26s cubic-bezier(.4,0,1,1);transform:translate3d(0,105%,0)}',
    '.rd-share__head{position:relative;flex:none;display:flex;align-items:center;gap:12px;padding:22px 12px 8px 20px;touch-action:none;cursor:default}',
    '.rd-share__grab{position:absolute;top:8px;left:50%;width:42px;height:5px;margin-left:-21px;border-radius:3px;background:var(--rd-dim);opacity:.45}',
    '.rd-share__ttl{flex:1;min-width:0}',
    '.rd-share__ttl h2{margin:0;font-size:1.22rem;font-weight:800;letter-spacing:-.01em;line-height:1.2}',
    '.rd-share__ttl p{margin:3px 0 0;font-size:.82rem;color:var(--rd-dim);line-height:1.35;overflow-wrap:anywhere}',
    '.rd-share__x{flex:none;width:44px;height:44px;border-radius:50%;border:0;background:var(--rd-field);color:var(--text,#eef2fb);display:grid;place-items:center;cursor:pointer;transition:transform .15s,background .15s}',
    '.rd-share__x svg{width:20px;height:20px}',
    '.rd-share__scroll{flex:1 1 auto;min-height:0;overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;padding:6px 18px 22px}',
    '.rd-share__body{display:block}',
    '.rd-share__prev{position:relative;--ph:clamp(200px,34vh,360px);width:min(100%,calc(var(--ph) * .8));aspect-ratio:4/5;margin:4px auto 18px;border-radius:18px;overflow:hidden;background:#0a1226;box-shadow:0 14px 34px rgba(0,0,0,.4),0 0 0 1px rgba(255,255,255,.08)}',
    '@supports (height:1dvh){.rd-share__prev{--ph:clamp(200px,34dvh,360px)}}',
    '.rd-share__prev img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0;transition:opacity .35s ease;-webkit-user-select:none;user-select:none}',
    '.rd-share__prev.is-ready img{opacity:1}',
    '.rd-share__skel{position:absolute;inset:0;background:linear-gradient(100deg,#0f1930 30%,#1b2a4a 50%,#0f1930 70%);background-size:300% 100%;animation:rd-share-shimmer 1.3s linear infinite;transition:opacity .3s}',
    '.rd-share__prev.is-ready .rd-share__skel{opacity:0;pointer-events:none}',
    '.rd-share__err{position:absolute;inset:0;display:none;align-items:center;justify-content:center;padding:20px;text-align:center;font-size:.85rem;color:#9db4ff}',
    '.rd-share__prev.is-error .rd-share__err{display:flex}',
    '.rd-share__prev.is-error .rd-share__skel{animation:none}',
    '@keyframes rd-share-shimmer{from{background-position:100% 0}to{background-position:-100% 0}}',
    '.rd-share__field{display:block;margin:0 0 14px}',
    '.rd-share__field span{display:block;margin:0 0 6px 2px;font-size:.78rem;font-weight:700;color:var(--rd-dim);letter-spacing:.02em}',
    '.rd-share__field input{display:block;width:100%;height:48px;padding:0 14px;border-radius:14px;border:1.5px solid var(--rd-line);background:var(--rd-field);color:var(--text,#eef2fb);font:600 16px ' + FONT + ';outline:none;transition:border-color .15s,box-shadow .15s}',
    '.rd-share__field input::placeholder{color:var(--rd-dim);font-weight:500;opacity:.8}',
    '.rd-share__field input:focus-visible,.rd-share__field input:focus{border-color:var(--rd-acc);box-shadow:0 0 0 3px rgba(34,224,138,.22)}',
    '.rd-share__primary{display:flex;align-items:center;justify-content:center;gap:10px;width:100%;height:58px;margin:0 0 18px;border:0;border-radius:18px;background:linear-gradient(135deg,#2cf09a,#19b8c4);color:#03240f;font:800 1.05rem ' + FONT + ';letter-spacing:.01em;cursor:pointer;box-shadow:0 10px 26px rgba(34,224,138,.28),inset 0 1px 0 rgba(255,255,255,.4);transition:transform .15s,box-shadow .2s,filter .2s}',
    '.rd-share__primary svg{width:22px;height:22px}',
    '.rd-share__grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px 4px}',
    '.rd-share__t{display:flex;flex-direction:column;align-items:center;gap:8px;min-height:88px;padding:4px 0;border:0;border-radius:16px;background:none;color:var(--text,#eef2fb);font:600 .74rem/1.2 ' + FONT + ';cursor:pointer;text-align:center;transition:transform .15s}',
    '.rd-share__ic{display:grid;place-items:center;width:58px;height:58px;border-radius:50%;box-shadow:0 6px 16px rgba(0,0,0,.28),inset 0 1px 0 rgba(255,255,255,.22);transition:transform .2s,box-shadow .2s}',
    '.rd-share__ic svg{width:29px;height:29px;display:block}',
    '.rd-share__t--wa .rd-share__ic{background:#25D366}',
    '.rd-share__t--ig .rd-share__ic{background:linear-gradient(45deg,#feda75 0%,#fa7e1e 28%,#d62976 62%,#4f5bd5 100%)}',
    '.rd-share__t--fb .rd-share__ic{background:#1877F2}',
    '.rd-share__t--x .rd-share__ic{background:#000;box-shadow:0 6px 16px rgba(0,0,0,.28),0 0 0 1.5px var(--rd-xring)}',
    '.rd-share__t--tg .rd-share__ic{background:#229ED9}',
    '.rd-share__t--cp .rd-share__ic{background:linear-gradient(135deg,#5a6b92,#3a4768)}',
    '.rd-share__t--sv .rd-share__ic{background:linear-gradient(135deg,#1fbf7d,#0f8f5c)}',
    '.rd-share__linkrow{margin-top:14px}',
    '.rd-share__toast{position:absolute;left:14px;right:14px;bottom:calc(14px + env(safe-area-inset-bottom,0px));margin:0 auto;max-width:440px;display:flex;align-items:center;gap:10px;padding:12px 14px 12px 16px;border-radius:16px;background:#0a1020;color:#eef2fb;border:1px solid rgba(255,255,255,.14);box-shadow:0 14px 34px rgba(0,0,0,.5);font-size:.88rem;font-weight:600;line-height:1.35;opacity:0;transform:translateY(14px) scale(.98);pointer-events:none;transition:opacity .22s,transform .3s cubic-bezier(.2,1.2,.3,1);z-index:3}',
    '.rd-share__toast.is-on{opacity:1;transform:none;pointer-events:auto}',
    '.rd-share__toast-msg{flex:1;min-width:0;overflow-wrap:anywhere}',
    '.rd-share__toast button{flex:none;min-height:40px;padding:0 14px;border-radius:12px;border:0;background:var(--rd-acc);color:#03240f;font:800 .82rem ' + FONT + ';cursor:pointer}',
    '.rd-share button:focus-visible,.rd-share input:focus-visible{outline:3px solid var(--rd-acc);outline-offset:2px}',
    '.rd-share__t:focus-visible{outline-offset:0}',
    '.rd-share__sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}',
    '.rd-share button:active{transform:scale(.94)}',
    '.rd-share__primary:active{transform:scale(.97)}',
    '@media (hover:hover){',
    '.rd-share__t:hover .rd-share__ic{transform:translateY(-3px);box-shadow:0 12px 22px rgba(0,0,0,.34),inset 0 1px 0 rgba(255,255,255,.28)}',
    '.rd-share__primary:hover{filter:brightness(1.06);transform:translateY(-1px);box-shadow:0 14px 30px rgba(34,224,138,.36),inset 0 1px 0 rgba(255,255,255,.4)}',
    '.rd-share__x:hover{background:rgba(125,139,171,.28)}',
    '.rd-share__t:hover{transform:none}}',
    '@media (max-width:339px){.rd-share__grid{grid-template-columns:repeat(3,minmax(0,1fr))}.rd-share__scroll{padding-left:14px;padding-right:14px}.rd-share__head{padding-left:16px}}',
    '@media (min-width:700px){',
    '.rd-share{align-items:center}',
    '.rd-share__sheet{max-width:800px;max-height:min(92vh,760px);max-height:min(92dvh,760px);border-bottom:1px solid var(--rd-line);border-radius:28px;box-shadow:0 30px 90px rgba(0,0,0,.55);transform:translate3d(0,26px,0) scale(.95);opacity:0;transition:transform .42s cubic-bezier(.2,1.1,.3,1),opacity .25s;padding-bottom:0}',
    '.rd-share__sheet::after{display:none}',
    '.rd-share.is-open .rd-share__sheet{transform:none;opacity:1}',
    '.rd-share.is-closing .rd-share__sheet{transform:translate3d(0,16px,0) scale(.97);opacity:0;transition:transform .2s,opacity .2s}',
    '.rd-share__grab{display:none}',
    '.rd-share__head{padding-top:20px;touch-action:auto}',
    '.rd-share__scroll{padding:8px 26px 26px}',
    '.rd-share__body{display:grid;grid-template-columns:minmax(0,.9fr) minmax(0,1.1fr);gap:28px;align-items:start}',
    '.rd-share__prev{--ph:clamp(300px,62vh,560px);margin:0 auto}',
    '.rd-share__ctrl{padding-top:4px}',
    '.rd-share__toast{bottom:20px}}',
    '@supports (height:1dvh){@media (min-width:700px){.rd-share__prev{--ph:clamp(300px,62dvh,560px)}}}',
    '@media (min-width:700px) and (max-height:560px){.rd-share__body{grid-template-columns:minmax(0,.7fr) minmax(0,1.3fr)}.rd-share__prev{--ph:300px}}',
    '@media (prefers-reduced-motion:reduce){.rd-share *,.rd-share *::before,.rd-share *::after{animation:none!important;transition:none!important}.rd-share.is-open .rd-share__sheet{transform:none}}',
    'html.rd-share-lock{overflow:hidden!important}'
  ].join('\n');

  function injectStyle() {
    if (document.getElementById('rd-share-css')) return;
    var st = document.createElement('style');
    st.id = 'rd-share-css';
    st.textContent = CSS;
    (document.head || document.documentElement).appendChild(st);
  }
  injectStyle();

  /* ------------------------------------------------------------------ */
  /* sheet: state + DOM                                                   */
  /* ------------------------------------------------------------------ */
  var S = {
    open: false, d: null, name: '', root: null, el: {}, opener: null,
    blob: null, file: null, url: null, key: '', token: 0, renderT: 0, closeT: 0, toastT: 0, drag: null
  };
  var nativeShare = false;

  function isMobileUA() {
    try {
      var ua = navigator.userAgent || '';
      if (/Android|iPhone|iPad|iPod|Mobile|Silk|Opera Mini/i.test(ua)) return true;
      return /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
    } catch (e) { return false; }
  }
  function isIOSorAndroid() {
    try { return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '') || (/Macintosh/.test(navigator.userAgent || '') && navigator.maxTouchPoints > 1); } catch (e) { return false; }
  }

  function h(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function svgSpan(html) { var s = h('span', 'rd-share__ic'); s.innerHTML = html; return s; }

  function build() {
    if (S.root) return;
    var root = h('div', 'rd-share');
    root.id = 'rd-share-root';
    root.hidden = true;

    var bd = h('div', 'rd-share__bd');
    bd.setAttribute('data-act', 'backdrop');

    var sheet = h('div', 'rd-share__sheet');
    sheet.setAttribute('role', 'dialog');
    sheet.setAttribute('aria-modal', 'true');
    sheet.setAttribute('aria-labelledby', 'rd-share-title');
    sheet.setAttribute('aria-describedby', 'rd-share-sub');
    sheet.tabIndex = -1;

    var head = h('div', 'rd-share__head');
    head.appendChild(h('div', 'rd-share__grab'));
    var ttl = h('div', 'rd-share__ttl');
    var title = h('h2', null, 'Share your run'); title.id = 'rd-share-title';
    var sub = h('p', null, ''); sub.id = 'rd-share-sub';
    ttl.appendChild(title); ttl.appendChild(sub);
    var x = h('button', 'rd-share__x'); x.type = 'button'; x.setAttribute('aria-label', 'Close'); x.setAttribute('data-act', 'close');
    x.innerHTML = ICON.close;
    head.appendChild(ttl); head.appendChild(x);

    var scroll = h('div', 'rd-share__scroll');
    var body = h('div', 'rd-share__body');

    var prev = h('div', 'rd-share__prev');
    prev.setAttribute('aria-busy', 'true');
    var img = document.createElement('img');
    img.alt = ''; img.draggable = false;
    img.decoding = 'async';
    var skel = h('div', 'rd-share__skel'); skel.setAttribute('aria-hidden', 'true');
    var err = h('div', 'rd-share__err', 'Preview unavailable, but you can still share your link.');
    prev.appendChild(skel); prev.appendChild(img); prev.appendChild(err);

    var ctrl = h('div', 'rd-share__ctrl');
    var field = h('label', 'rd-share__field');
    field.appendChild(h('span', null, 'Name on card (optional)'));
    var input = document.createElement('input');
    input.type = 'text'; input.id = 'rd-share-name'; input.maxLength = NAME_MAX; input.autocomplete = 'off';
    input.setAttribute('autocapitalize', 'words'); input.setAttribute('autocorrect', 'off'); input.spellcheck = false;
    input.setAttribute('enterkeyhint', 'done'); input.placeholder = 'Your name';
    field.appendChild(input);

    var primary = h('button', 'rd-share__primary'); primary.type = 'button'; primary.setAttribute('data-act', 'native');
    primary.innerHTML = ICON.share;
    primary.appendChild(h('span', null, 'Share…'));

    var grid = h('div', 'rd-share__grid');
    grid.setAttribute('role', 'group'); grid.setAttribute('aria-label', 'Share to');
    TARGETS.forEach(function (t) {
      var b = h('button', 'rd-share__t rd-share__t--' + t.cls); b.type = 'button'; b.setAttribute('data-act', t.id);
      b.appendChild(svgSpan(ICON[t.id]));
      b.appendChild(h('span', null, t.label));
      grid.appendChild(b);
    });

    var linkrow = h('div', 'rd-share__field rd-share__linkrow'); linkrow.hidden = true;
    linkrow.appendChild(h('span', null, 'Copy this link manually'));
    var linkIn = document.createElement('input'); linkIn.type = 'text'; linkIn.readOnly = true; linkIn.setAttribute('aria-label', 'Share link');
    linkrow.appendChild(linkIn);

    ctrl.appendChild(field); ctrl.appendChild(primary); ctrl.appendChild(grid); ctrl.appendChild(linkrow);
    body.appendChild(prev); body.appendChild(ctrl);
    scroll.appendChild(body);

    var toast = h('div', 'rd-share__toast');
    toast.setAttribute('role', 'status'); toast.setAttribute('aria-live', 'polite'); toast.setAttribute('aria-atomic', 'true');

    sheet.appendChild(head); sheet.appendChild(scroll); sheet.appendChild(toast);
    root.appendChild(bd); root.appendChild(sheet);
    document.body.appendChild(root);

    S.root = root;
    S.el = { sheet: sheet, head: head, title: title, sub: sub, prev: prev, img: img, input: input, primary: primary, grid: grid, toast: toast, linkrow: linkrow, linkIn: linkIn };

    root.addEventListener('click', onClick);
    root.addEventListener('keydown', function (e) { if (e.key !== 'Escape' && e.key !== 'Tab') e.stopPropagation(); });
    root.addEventListener('keyup', function (e) { e.stopPropagation(); });
    input.addEventListener('input', onNameInput);
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); input.blur(); } });
    img.addEventListener('load', function () { prev.classList.add('is-ready'); prev.removeAttribute('aria-busy'); });
    head.addEventListener('pointerdown', dragStart);
    head.addEventListener('pointermove', dragMove);
    head.addEventListener('pointerup', dragEnd);
    head.addEventListener('pointercancel', dragEnd);
  }

  /* ---- drag to dismiss (mobile bottom sheet) ------------------------- */
  function dragStart(e) {
    if (e.pointerType === 'mouse' || window.innerWidth >= 700 || e.target.closest('button')) return;
    S.drag = { y: e.clientY, t: Date.now(), dy: 0, id: e.pointerId };
    try { S.el.head.setPointerCapture(e.pointerId); } catch (er) { /* ignore */ }
    S.el.sheet.style.transition = 'none';
  }
  function dragMove(e) {
    if (!S.drag || e.pointerId !== S.drag.id) return;
    S.drag.dy = Math.max(0, e.clientY - S.drag.y);
    S.el.sheet.style.transform = 'translate3d(0,' + S.drag.dy + 'px,0)';
  }
  function dragEnd(e) {
    var dr = S.drag;
    if (!dr || e.pointerId !== dr.id) return;
    S.drag = null;
    S.el.sheet.style.transition = '';
    var v = dr.dy / Math.max(1, Date.now() - dr.t);
    if (dr.dy > 120 || (dr.dy > 36 && v > 0.55)) { close(); S.el.sheet.style.transform = ''; }
    else S.el.sheet.style.transform = '';
  }

  /* ---- toast --------------------------------------------------------- */
  function toast(msg, action, ms) {
    var t = S.el.toast;
    if (!t) return;
    clearTimeout(S.toastT);
    while (t.firstChild) t.removeChild(t.firstChild);
    t.appendChild(h('span', 'rd-share__toast-msg', msg));
    if (action) {
      var b = h('button', null, action.label); b.type = 'button';
      b.addEventListener('click', function (e) { e.stopPropagation(); hideToast(); try { action.run(); } catch (er) { /* ignore */ } });
      t.appendChild(b);
    }
    // restart transition so repeated toasts re-announce
    t.classList.remove('is-on');
    void t.offsetWidth;
    t.classList.add('is-on');
    S.toastT = setTimeout(hideToast, ms || (action ? 8000 : 3500));
  }
  function hideToast() {
    clearTimeout(S.toastT);
    if (S.el.toast) S.el.toast.classList.remove('is-on');
  }

  /* ---- render pipeline ------------------------------------------------ */
  function cardData() {
    var d = {}, k;
    for (k in S.d) d[k] = S.d[k];
    d.name = S.name;
    return d;
  }
  function revokeUrl() {
    if (S.url) { try { URL.revokeObjectURL(S.url); } catch (e) { /* ignore */ } }
    S.url = null;
  }
  function dataKey() {
    var d = cardData();
    return [d.mode, d.score, d.best, d.coins, d.difficulty, d.skin.c1, d.skin.c2, d.skin.name, d.isNewBest, d.survivalSecs, d.name].join('|');
  }
  function scheduleRender(delay) {
    clearTimeout(S.renderT);
    var key = dataKey();
    if (key === S.key && S.blob) return;          // already rendered for these inputs
    var tok = ++S.token;
    S.file = null;                                // stale until the new render lands
    S.el.prev.classList.remove('is-ready', 'is-error');
    S.el.prev.setAttribute('aria-busy', 'true');
    S.renderT = setTimeout(function () {
      var run = function () {
        if (!S.open || tok !== S.token) return;
        buildCardBlob(cardData()).then(function (blob) {
          if (!S.open || tok !== S.token) return;
          revokeUrl();
          S.blob = blob; S.key = key;
          try { S.file = new File([blob], 'road-dash-score-' + S.d.score + '.jpg', { type: 'image/jpeg' }); } catch (e) { S.file = null; }
          try { S.url = URL.createObjectURL(blob); } catch (e) { S.url = null; }
          if (S.url) S.el.img.src = S.url;
          else {
            var fr = new FileReader();
            fr.onload = function () { if (tok === S.token) S.el.img.src = fr.result; };
            fr.readAsDataURL(blob);
          }
        }, function () {
          if (!S.open || tok !== S.token) return;
          S.el.prev.classList.add('is-error');
          S.el.prev.removeAttribute('aria-busy');
        });
      };
      if (window.requestAnimationFrame) window.requestAnimationFrame(run); else run();
    }, delay);
  }
  function whenBlob() {
    if (S.blob && S.key === dataKey()) return Promise.resolve(S.blob);
    return buildCardBlob(cardData()).then(function (b) { return b; });
  }

  function onNameInput() {
    var raw = S.el.input.value;
    S.name = sanitizeName(raw);
    lsSet(NAME_KEY, Array.from(String(raw)).slice(0, NAME_MAX).join(''));
    S.el.linkrow.hidden = true;
    scheduleRender(250);
  }

  /* ---- open / close --------------------------------------------------- */
  function updateTexts() {
    var d = S.d, invite = d.mode === 'invite';
    S.el.title.textContent = invite ? 'Invite friends' : 'Share your run';
    var sub;
    if (invite) sub = d.best > 0 ? 'Challenge them to beat your best of ' + fmt(d.best) : 'Tell your friends about Road Dash';
    else sub = d.isNewBest ? 'New personal best! Show it off.' : 'Challenge friends to beat ' + fmt(d.score) + '.';
    S.el.sub.textContent = sub;
    S.el.img.alt = invite
      ? 'Your Road Dash invite card: best score ' + d.best + ' points'
      : 'Your Road Dash score card: ' + d.score + ' points';
  }

  function open(data) {
    try {
      if (!document.body) return;
      injectStyle();
      build();
      clearTimeout(S.closeT);
      S.d = normalize(data);
      S.d.name = '';
      S.name = sanitizeName(lsGet(NAME_KEY));
      S.el.input.value = S.name;
      nativeShare = typeof navigator.share === 'function';
      S.el.primary.hidden = !nativeShare;
      S.el.linkrow.hidden = true;
      hideToast();
      updateTexts();

      var wasOpen = S.open;
      if (!wasOpen) {
        var ae = document.activeElement;
        S.opener = ae && ae !== document.body && ae.focus ? ae : null;
        S.key = '';
        S.blob = null; S.file = null;
        revokeUrl();
        S.el.img.removeAttribute('src');
        S.root.classList.remove('is-closing', 'is-open');
        S.root.hidden = false;
        document.body.classList.add('modal-open');
        document.documentElement.classList.add('rd-share-lock');
        document.addEventListener('keydown', onDocKey, true);
        S.open = true;
        void S.root.offsetWidth;
        S.root.classList.add('is-open');
        S.el.sheet.scrollTop = 0;
        S.root.querySelector('.rd-share__scroll').scrollTop = 0;
        try { S.el.sheet.focus({ preventScroll: true }); } catch (e) { S.el.sheet.focus(); }
      } else {
        S.key = '';
      }
      scheduleRender(30);
    } catch (e) {
      try { console.warn('RoadDashShare.open failed', e); } catch (er) { /* ignore */ }
    }
  }

  function close() {
    if (!S.open) return;
    S.open = false;
    S.token++;
    clearTimeout(S.renderT);
    hideToast();
    document.removeEventListener('keydown', onDocKey, true);
    document.body.classList.remove('modal-open');
    document.documentElement.classList.remove('rd-share-lock');
    var reduce = false;
    try { reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { /* ignore */ }
    S.root.classList.remove('is-open');
    var finish = function () {
      S.root.hidden = true;
      S.root.classList.remove('is-closing');
      S.el.sheet.style.transform = '';
      S.el.img.removeAttribute('src');
      S.el.prev.classList.remove('is-ready');
      revokeUrl();
      S.blob = null; S.file = null; S.key = '';
    };
    if (reduce) finish();
    else { S.root.classList.add('is-closing'); S.closeT = setTimeout(finish, 280); }
    var op = S.opener; S.opener = null;
    if (op && document.contains(op)) { try { op.focus({ preventScroll: true }); } catch (e) { try { op.focus(); } catch (er) { /* ignore */ } } }
  }

  function focusables() {
    var list = S.el.sheet.querySelectorAll('button, input, a[href], textarea, [tabindex]:not([tabindex="-1"])');
    return Array.prototype.filter.call(list, function (el) {
      return !el.disabled && !el.hidden && el.getClientRects().length > 0 && el.getAttribute('tabindex') !== '-1';
    });
  }
  function onDocKey(e) {
    if (!S.open) return;
    if (e.key === 'Escape' || e.key === 'Esc') { e.preventDefault(); e.stopPropagation(); close(); return; }
    if (e.key !== 'Tab') return;
    var f = focusables();
    if (!f.length) { e.preventDefault(); return; }
    var first = f[0], last = f[f.length - 1], a = document.activeElement;
    if (!S.el.sheet.contains(a) || a === S.el.sheet) {
      e.preventDefault(); (e.shiftKey ? last : first).focus(); return;
    }
    if (e.shiftKey && a === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && a === last) { e.preventDefault(); first.focus(); }
  }

  /* ---- actions -------------------------------------------------------- */
  function onClick(e) {
    var el = e.target.closest('[data-act]');
    if (!el || !S.root.contains(el)) return;
    var act = el.getAttribute('data-act');
    if (act === 'backdrop' || act === 'close') { close(); return; }
    if (!S.open) return;
    switch (act) {
      case 'native': doNative('native'); break;
      case 'instagram': doInstagram(); break;
      case 'whatsapp': doWeb('whatsapp'); break;
      case 'facebook': doWeb('facebook'); break;
      case 'x': doWeb('x'); break;
      case 'telegram': doWeb('telegram'); break;
      case 'copy': doCopy(); break;
      case 'save': doSave(false); break;
    }
  }

  function shared(target) {
    try {
      document.dispatchEvent(new CustomEvent('roaddash:shared', { detail: { target: target, mode: S.d.mode, score: S.d.score } }));
    } catch (e) { /* ignore */ }
  }
  function payload(target) {
    var d = cardData(), link = buildLink(d, target), text = shareText(d);
    return { d: d, link: link, text: text, full: text + ' ' + link };
  }

  // Must stay synchronous up to navigator.share() (iOS Safari transient activation).
  function doNative(kind) {
    var p = payload(kind), f = S.file, canFiles = false;
    try { canFiles = !!(f && navigator.canShare && navigator.canShare({ files: [f] })); } catch (e) { canFiles = false; }
    if (typeof navigator.share !== 'function') { toast('Sharing isn’t available here. Try Copy link.'); return false; }
    var payl = canFiles
      ? { files: [f], text: p.full, title: 'Road Dash' }
      : { title: 'Road Dash', text: p.text, url: p.link };
    var pr;
    try { pr = navigator.share(payl); } catch (err) { return nativeFail(err, kind); }
    Promise.resolve(pr).then(function () { shared(kind); }, function (err) { nativeFail(err, kind); });
    return true;
  }
  function nativeFail(err, kind) {
    if (err && err.name === 'AbortError') return false;
    toast('Couldn’t open the share sheet. Try Copy link.');
    return false;
  }

  function openExternal(url, target, popup, label) {
    var w;
    try {
      w = popup && !isMobileUA()
        ? window.open(url, 'rd-share-popup', 'width=600,height=500,menubar=no,toolbar=no,location=yes,status=no')
        : window.open(url, '_blank');
    } catch (e) { w = null; }
    if (w === null) {
      if (isMobileUA()) { shared(target); window.location.href = url; return; }
      toast('Popup blocked. Allow popups or use Copy link.');
      return;
    }
    try { if (w) w.opener = null; } catch (e) { /* cross-origin / ignore */ }
    shared(target);
    toast('Opening ' + label + '…', null, 2200);
  }

  function doWeb(target) {
    var p = payload(target), enc = encodeURIComponent, url, popup = false, label;
    if (target === 'whatsapp') { url = 'https://wa.me/?text=' + enc(p.full); label = 'WhatsApp'; }
    else if (target === 'facebook') { url = 'https://www.facebook.com/sharer/sharer.php?u=' + enc(p.link) + '&quote=' + enc(p.text) + '&hashtag=%23RoadDash'; popup = true; label = 'Facebook'; }
    else if (target === 'x') { url = 'https://twitter.com/intent/tweet?text=' + enc(p.text) + '&url=' + enc(p.link) + '&hashtags=RoadDash'; popup = true; label = 'X'; }
    else { url = 'https://t.me/share/url?url=' + enc(p.link) + '&text=' + enc(p.text); label = 'Telegram'; }
    openExternal(url, target, popup, label);
  }

  function download(blob) {
    var u = null, a = document.createElement('a');
    try { u = (S.blob === blob && S.url) ? S.url : URL.createObjectURL(blob); } catch (e) { return false; }
    a.href = u;
    a.download = 'road-dash-score-' + S.d.score + '.jpg';
    a.rel = 'noopener';
    a.style.display = 'none';
    document.body.appendChild(a);
    try { a.click(); } catch (e) { a.remove(); return false; }
    setTimeout(function () { a.remove(); if (u !== S.url) { try { URL.revokeObjectURL(u); } catch (e) { /* ignore */ } } }, 4000);
    return true;
  }

  function doSave(fromInstagram) {
    return whenBlob().then(function (blob) {
      if (!S.open) return false;
      if (!download(blob)) { toast('Couldn’t save the card. Long-press the preview to save it.'); return false; }
      if (fromInstagram) {
        var action = isIOSorAndroid()
          ? { label: 'Open Instagram', run: function () { window.location.href = 'instagram://app'; } }
          : { label: 'Got it', run: function () {} };
        toast('Card saved! Open Instagram and add it to your story or post.', action);
      } else toast('Card saved ✓');
      shared(fromInstagram ? 'instagram' : 'save');
      return true;
    }, function () { toast('Couldn’t create the card. Try Copy link.'); return false; });
  }

  function doInstagram() {
    var f = S.file, canFiles = false;
    try { canFiles = !!(f && typeof navigator.share === 'function' && navigator.canShare && navigator.canShare({ files: [f] })); } catch (e) { canFiles = false; }
    if (canFiles) {
      var p = payload('instagram'), pr;
      try { pr = navigator.share({ files: [f], text: p.full, title: 'Road Dash' }); }
      catch (err) { doSave(true); return; }
      Promise.resolve(pr).then(function () { shared('instagram'); }, function (err) {
        if (err && err.name === 'AbortError') return;
        doSave(true);
      });
      return;
    }
    doSave(true);
  }

  function legacyCopy(str) {
    var ta = document.createElement('textarea'), prevFocus = document.activeElement, ok = false;
    ta.value = str; ta.readOnly = true;
    ta.setAttribute('aria-hidden', 'true'); ta.tabIndex = -1;
    ta.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;font-size:16px;pointer-events:none';
    S.el.sheet.appendChild(ta);
    try {
      ta.focus({ preventScroll: true }); ta.select(); ta.setSelectionRange(0, str.length);
      ok = !!document.execCommand('copy');
    } catch (e) { ok = false; }
    ta.remove();
    try { if (prevFocus && prevFocus.focus) prevFocus.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
    return ok;
  }
  function doCopy() {
    var p = payload('copy');
    var ok = function () { shared('copy'); toast('Link copied ✓'); };
    var fallback = function () {
      if (legacyCopy(p.full)) { ok(); return; }
      S.el.linkIn.value = p.full;
      S.el.linkrow.hidden = false;
      try { S.el.linkIn.focus({ preventScroll: false }); S.el.linkIn.select(); } catch (e) { /* ignore */ }
      toast('Couldn’t copy automatically. Copy the text below.');
    };
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      try { navigator.clipboard.writeText(p.full).then(ok, fallback); } catch (e) { fallback(); }
    } else fallback();
  }

  window.RoadDashShare = {
    open: open,
    buildCardBlob: buildCardBlob,
    getChallenge: getChallenge,
    isOpen: function () { return S.open; },
    close: close
  };
})();
