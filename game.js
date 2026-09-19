(function () {
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');

  const scoreDisplay = document.getElementById('scoreDisplay');
  const bestDisplay = document.getElementById('bestDisplay');
  const comboDisplay = document.getElementById('comboDisplay');
  const startOverlay = document.getElementById('startOverlay');
  const pauseOverlay = document.getElementById('pauseOverlay');
  const gameOverOverlay = document.getElementById('gameOverOverlay');
  const leaderboardOverlay = document.getElementById('leaderboardOverlay');
  const leaderboardList = document.getElementById('leaderboardList');
  const finalScoreVal = document.getElementById('finalScoreVal');
  const finalCoinsVal = document.getElementById('finalCoinsVal');
  const finalBestVal = document.getElementById('finalBestVal');
  const newBestBadge = document.getElementById('newBestBadge');
  const startBtn = document.getElementById('startBtn');
  const retryBtn = document.getElementById('retryBtn');
  const resumeBtn = document.getElementById('resumeBtn');
  const quitBtn = document.getElementById('quitBtn');
  const menuBtn = document.getElementById('menuBtn');
  const pauseBtn = document.getElementById('pauseBtn');
  const soundBtn = document.getElementById('soundBtn');
  const themeBtn = document.getElementById('themeBtn');
  const leftBtn = document.getElementById('leftBtn');
  const rightBtn = document.getElementById('rightBtn');
  const difficultyRow = document.getElementById('difficultyRow');
  const showLeaderboardBtn = document.getElementById('showLeaderboardBtn');
  const closeLeaderboardBtn = document.getElementById('closeLeaderboardBtn');
  const reviveBtn = document.getElementById('reviveBtn');

  const BEST_KEY = 'roaddash_best_score';
  const SOUND_KEY = 'roaddash_sound_on';
  const THEME_KEY = 'roaddash_theme';
  const SCORES_KEY = 'roaddash_leaderboard';
  const DIFF_KEY = 'roaddash_difficulty';

  const LANES = 3;
  const ROAD_MARGIN_RATIO = 0.06;

  const DIFFICULTIES = {
    easy:   { speedMul: 0.8,  spawnMul: 1.25, label: 'Easy'   },
    normal: { speedMul: 1.0,  spawnMul: 1.0,  label: 'Normal' },
    hard:   { speedMul: 1.3,  spawnMul: 0.78, label: 'Hard'   },
  };

  let cssW = 360, cssH = 600, dpr = 1;
  let roadMargin, roadWidth, laneWidth;

  let player, obstacles, particles, coins, powerUps, streetlights;
  let score, coinsCollected, best, speed, running, paused;
  let lastSpawn, lastCoinSpawn, lastPowerSpawn, lastTime, roadOffset, soundOn, theme;
  let difficulty = 'normal';
  let combo = 1, comboTimer = 0;
  let shieldTime = 0;
  let shakeTime = 0, shakeMag = 0;
  let isTouchDevice = false;
  let reviveUsed = false;

  // ---------- ad breaks (Google Ad Placement API for HTML5 games) ----------
  // Docs: https://developers.google.com/ad-placement
  // requestAd() always calls its continuation, even if no ad fills or the
  // API isn't available (e.g. local dev, ad blockers) — the game is never
  // blocked waiting on an ad.
  function requestAd(opts) {
    let settled = false;
    const done = (fn) => (...args) => { if (settled) return; settled = true; if (fn) fn(...args); };
    const safeOpts = { ...opts };
    if (safeOpts.beforeAd) safeOpts.beforeAd = done(safeOpts.beforeAd);
    if (safeOpts.afterAd) safeOpts.afterAd = done(safeOpts.afterAd);
    if (safeOpts.adDismissed) safeOpts.adDismissed = done(safeOpts.adDismissed);
    if (safeOpts.adViewed) safeOpts.adViewed = done(safeOpts.adViewed);
    if (safeOpts.adBreakDone) safeOpts.adBreakDone = done(safeOpts.adBreakDone);
    try {
      window.adBreak(safeOpts);
    } catch (e) {
      settled = true;
      if (opts.afterAd) opts.afterAd();
      else if (opts.adDismissed) opts.adDismissed();
    }
    // Fallback: if the ad API never calls back (no fill, blocked, offline),
    // continue the game after a short wait so players are never stuck.
    setTimeout(() => {
      const fallback = done(opts.afterAd || opts.adDismissed);
      if (fallback) fallback();
    }, 4000);
  }

  // ---------- audio ----------
  let audioCtx = null;
  function ensureAudio() {
    if (!audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) audioCtx = new AC();
    }
  }
  function beep(freq, duration, type, gainVal) {
    if (!soundOn || !audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type || 'sine';
    osc.frequency.value = freq;
    gain.gain.value = gainVal || 0.08;
    osc.connect(gain).connect(audioCtx.destination);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
    osc.stop(audioCtx.currentTime + duration);
  }
  function sfxCrash() { beep(90, 0.4, 'sawtooth', 0.15); }
  function sfxSwitch() { beep(520, 0.08, 'square', 0.05); }
  function sfxCoin() { beep(1100, 0.09, 'sine', 0.06); beep(1500, 0.09, 'sine', 0.04); }
  function sfxPower() { beep(300, 0.15, 'triangle', 0.08); beep(600, 0.2, 'triangle', 0.06); }
  function sfxTick() { beep(880, 0.05, 'sine', 0.03); }

  // ---------- responsive sizing ----------
  function resize() {
    const rect = canvas.getBoundingClientRect();
    cssW = rect.width;
    cssH = rect.height;
    dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    roadMargin = cssW * ROAD_MARGIN_RATIO;
    roadWidth = cssW - roadMargin * 2;
    laneWidth = roadWidth / LANES;

    if (player) {
      player.w = laneWidth * 0.52;
      player.h = player.w * 1.7;
      player.y = cssH - player.h - cssH * 0.08;
      player.x = laneCenterX(player.lane);
      player.targetX = player.x;
    }
  }

  function laneCenterX(lane) {
    return roadMargin + laneWidth * lane + laneWidth / 2;
  }

  function detectTouch() {
    isTouchDevice = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
    if (isTouchDevice) document.body.classList.add('touch-device');
  }

  // ---------- state ----------
  function resetState() {
    const w = laneWidth * 0.52;
    const h = w * 1.7;
    player = { lane: 1, x: laneCenterX(1), targetX: laneCenterX(1), y: cssH - h - cssH * 0.08, w, h, tilt: 0 };
    obstacles = [];
    particles = [];
    coins = [];
    powerUps = [];
    streetlights = [];
    for (let i = 0; i < 6; i++) {
      streetlights.push({ y: i * (cssH / 3), side: i % 2 === 0 ? 0 : 1 });
    }
    score = 0;
    coinsCollected = 0;
    const diff = DIFFICULTIES[difficulty];
    speed = cssH * 0.36 * diff.speedMul;
    lastSpawn = 0;
    lastCoinSpawn = 0;
    lastPowerSpawn = 0;
    roadOffset = 0;
    combo = 1;
    comboTimer = 0;
    shieldTime = 0;
    shakeTime = 0;
    running = true;
    paused = false;
    reviveUsed = false;
    comboDisplay.classList.remove('show');
  }

  function reviveAfterCrash() {
    running = true;
    shieldTime = 2.5;
    obstacles = obstacles.filter(o => Math.abs(o.y - player.y) > player.h * 2.2);
    gameOverOverlay.classList.add('hidden');
    lastTime = performance.now();
    requestAnimationFrame(loop);
  }

  function loadBest() {
    best = Number(localStorage.getItem(BEST_KEY) || 0);
    bestDisplay.textContent = 'BEST ' + best;
  }
  function saveBestIfNeeded() {
    const isNew = score > best;
    if (isNew) {
      best = Math.floor(score);
      localStorage.setItem(BEST_KEY, String(best));
    }
    bestDisplay.textContent = 'BEST ' + best;
    return isNew;
  }
  function loadSound() {
    soundOn = localStorage.getItem(SOUND_KEY) !== 'off';
    soundBtn.textContent = soundOn ? '🔊' : '🔇';
  }
  function loadTheme() {
    theme = localStorage.getItem(THEME_KEY) || 'night';
    applyTheme();
  }
  function applyTheme() {
    document.body.setAttribute('data-theme', theme === 'day' ? 'day' : '');
    themeBtn.textContent = theme === 'day' ? '☀️' : '🌙';
  }
  function loadDifficulty() {
    difficulty = localStorage.getItem(DIFF_KEY) || 'normal';
    [...difficultyRow.children].forEach(btn => {
      btn.classList.toggle('active', btn.dataset.diff === difficulty);
    });
  }

  function loadScores() {
    try { return JSON.parse(localStorage.getItem(SCORES_KEY) || '[]'); }
    catch { return []; }
  }
  function saveScore(finalScore) {
    const scores = loadScores();
    scores.push(Math.floor(finalScore));
    scores.sort((a, b) => b - a);
    localStorage.setItem(SCORES_KEY, JSON.stringify(scores.slice(0, 5)));
  }
  function renderLeaderboard() {
    const scores = loadScores();
    leaderboardList.innerHTML = '';
    if (scores.length === 0) {
      leaderboardList.innerHTML = '<li class="empty">No scores yet — play a run!</li>';
      return;
    }
    scores.forEach((s, i) => {
      const li = document.createElement('li');
      li.innerHTML = `<span class="rank">#${i + 1}</span><b>${s}</b>`;
      leaderboardList.appendChild(li);
    });
  }

  // ---------- spawning ----------
  function spawnObstacle() {
    const lane = Math.floor(Math.random() * LANES);
    const w = laneWidth * 0.52;
    const h = w * 1.7;
    const palette = [
      ['#ff5470', '#c81e46'],
      ['#ffb830', '#c67700'],
      ['#4fa8ff', '#1a5fc4'],
      ['#c084fc', '#7c3aed'],
    ];
    const [c1, c2] = palette[Math.floor(Math.random() * palette.length)];
    obstacles.push({ lane, x: laneCenterX(lane), y: -h, w, h, c1, c2 });
  }

  function laneOccupied(lane, y, margin) {
    return obstacles.some(o => o.lane === lane && Math.abs(o.y - y) < margin);
  }

  function spawnCoin() {
    const lane = Math.floor(Math.random() * LANES);
    if (laneOccupied(lane, -40, 120)) return;
    coins.push({ lane, x: laneCenterX(lane), y: -40, r: laneWidth * 0.14, spin: 0 });
  }

  function spawnPowerUp() {
    const lane = Math.floor(Math.random() * LANES);
    if (laneOccupied(lane, -40, 160)) return;
    powerUps.push({ lane, x: laneCenterX(lane), y: -40, r: laneWidth * 0.18, spin: 0 });
  }

  function spawnParticles(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      particles.push({
        x, y,
        vx: (Math.random() - 0.5) * 260,
        vy: (Math.random() - 0.5) * 260 - 60,
        life: 0.5 + Math.random() * 0.4,
        age: 0,
        color,
        size: 2 + Math.random() * 3,
      });
    }
  }

  function spawnExhaust() {
    particles.push({
      x: player.x + (Math.random() - 0.5) * player.w * 0.4,
      y: player.y + player.h / 2,
      vx: (Math.random() - 0.5) * 20,
      vy: 40 + Math.random() * 40,
      life: 0.35,
      age: 0,
      color: 'rgba(180,190,210,0.5)',
      size: 3 + Math.random() * 3,
    });
  }

  function rectsOverlap(a, b) {
    return Math.abs(a.x - b.x) < (a.w + b.w) / 2 - Math.min(a.w, b.w) * 0.15 &&
           Math.abs(a.y - b.y) < (a.h + b.h) / 2 - Math.min(a.h, b.h) * 0.1;
  }
  function circleRectOverlap(c, r) {
    const dx = Math.abs(c.x - r.x);
    const dy = Math.abs(c.y - r.y);
    return dx < r.w / 2 + c.r * 0.6 && dy < r.h / 2 + c.r * 0.6;
  }

  // ---------- update ----------
  function update(dt) {
    roadOffset = (roadOffset + speed * dt) % (cssH * 0.08);
    speed += dt * (cssH * 0.012);

    const dx = player.targetX - player.x;
    player.x += dx * Math.min(1, dt * 14);
    player.tilt = Math.max(-0.16, Math.min(0.16, dx * 0.01));

    const diff = DIFFICULTIES[difficulty];

    lastSpawn += dt;
    const spawnInterval = Math.max(0.42, 1.05 - speed / (cssH * 3)) * diff.spawnMul;
    if (lastSpawn > spawnInterval) { lastSpawn = 0; spawnObstacle(); }

    lastCoinSpawn += dt;
    if (lastCoinSpawn > 1.4) { lastCoinSpawn = 0; if (Math.random() < 0.8) spawnCoin(); }

    lastPowerSpawn += dt;
    if (lastPowerSpawn > 9) { lastPowerSpawn = 0; if (Math.random() < 0.6) spawnPowerUp(); }

    if (Math.random() < dt * 14) spawnExhaust();

    for (const o of obstacles) o.y += speed * dt;
    obstacles = obstacles.filter(o => o.y < cssH + o.h);

    for (const c of coins) { c.y += speed * dt; c.spin += dt * 6; }
    coins = coins.filter(c => c.y < cssH + 40);

    for (const p of powerUps) { p.y += speed * dt; p.spin += dt * 4; }
    powerUps = powerUps.filter(p => p.y < cssH + 40);

    for (const p of particles) {
      p.age += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 300 * dt;
    }
    particles = particles.filter(p => p.age < p.life);

    if (comboTimer > 0) {
      comboTimer -= dt;
      if (comboTimer <= 0) { combo = 1; comboDisplay.classList.remove('show'); }
    }
    if (shieldTime > 0) shieldTime -= dt;
    if (shakeTime > 0) shakeTime -= dt;

    score += dt * 12 * combo;

    const playerBox = { x: player.x, y: player.y + player.h * 0.1, w: player.w, h: player.h * 0.8 };

    for (let i = coins.length - 1; i >= 0; i--) {
      if (circleRectOverlap(coins[i], playerBox)) {
        coinsCollected++;
        score += 40;
        combo = Math.min(5, combo + 0.5);
        comboTimer = 3;
        comboDisplay.textContent = 'x' + combo.toFixed(1) + ' COMBO';
        comboDisplay.classList.add('show');
        spawnParticles(coins[i].x, coins[i].y, '#ffd166', 10);
        sfxCoin();
        coins.splice(i, 1);
      }
    }

    for (let i = powerUps.length - 1; i >= 0; i--) {
      if (circleRectOverlap(powerUps[i], playerBox)) {
        shieldTime = 5;
        spawnParticles(powerUps[i].x, powerUps[i].y, '#4fa8ff', 16);
        sfxPower();
        powerUps.splice(i, 1);
      }
    }

    for (const o of obstacles) {
      if (rectsOverlap(playerBox, o)) {
        if (shieldTime > 0) {
          spawnParticles(o.x, o.y, '#4fa8ff', 14);
          obstacles = obstacles.filter(x => x !== o);
          shieldTime = Math.max(0, shieldTime - 1.2);
        } else {
          crash();
          return;
        }
      }
    }
  }

  function crash() {
    running = false;
    spawnParticles(player.x, player.y, '#ff5470', 26);
    shakeTime = 0.35;
    shakeMag = 10;
    sfxCrash();
    const isNew = saveBestIfNeeded();
    saveScore(score);
    finalScoreVal.textContent = Math.floor(score);
    finalCoinsVal.textContent = coinsCollected;
    finalBestVal.textContent = best;
    newBestBadge.classList.toggle('hidden', !isNew);
    reviveBtn.classList.toggle('hidden', reviveUsed);
    reviveBtn.disabled = false;
    reviveBtn.textContent = '📺 Watch Ad to Continue';
    setTimeout(() => gameOverOverlay.classList.remove('hidden'), 260);
  }

  // ---------- render ----------
  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawCar(x, y, w, h, c1, c2, tilt, glow) {
    ctx.save();
    ctx.translate(x, y);
    if (tilt) ctx.rotate(tilt);

    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(0, h / 2 + 4, w * 0.55, h * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();

    if (glow) {
      ctx.save();
      ctx.strokeStyle = 'rgba(79,168,255,0.85)';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#4fa8ff';
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.ellipse(0, 0, w * 0.72, h * 0.58, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    const grad = ctx.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2);
    grad.addColorStop(0, c1);
    grad.addColorStop(1, c2);
    ctx.fillStyle = grad;
    roundRect(-w / 2, -h / 2, w, h, w * 0.28);
    ctx.fill();

    ctx.fillStyle = 'rgba(15, 23, 42, 0.55)';
    roundRect(-w * 0.32, -h * 0.32, w * 0.64, h * 0.22, w * 0.14);
    ctx.fill();
    roundRect(-w * 0.32, h * 0.1, w * 0.64, h * 0.22, w * 0.14);
    ctx.fill();

    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fillRect(-w * 0.38, -h * 0.48, w * 0.18, h * 0.05);
    ctx.fillRect(w * 0.2, -h * 0.48, w * 0.18, h * 0.05);
    ctx.fillStyle = 'rgba(255,80,80,0.9)';
    ctx.fillRect(-w * 0.38, h * 0.43, w * 0.18, h * 0.05);
    ctx.fillRect(w * 0.2, h * 0.43, w * 0.18, h * 0.05);

    ctx.restore();
  }

  function drawRoad() {
    const isDay = theme === 'day';
    const g = ctx.createLinearGradient(0, 0, 0, cssH);
    if (isDay) { g.addColorStop(0, '#7a8aa8'); g.addColorStop(1, '#5c6c8c'); }
    else { g.addColorStop(0, '#3b4a6b'); g.addColorStop(1, '#232f4d'); }
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, cssW, cssH);

    ctx.fillStyle = isDay ? '#4c9a4c' : '#141c33';
    ctx.fillRect(0, 0, roadMargin, cssH);
    ctx.fillRect(cssW - roadMargin, 0, roadMargin, cssH);

    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    const curbW = roadMargin * 0.3;
    ctx.fillRect(roadMargin - curbW, 0, curbW, cssH);
    ctx.fillRect(cssW - roadMargin, 0, curbW, cssH);

    for (const s of streetlights) {
      const sy = ((s.y + roadOffset * 6) % (cssH + 100)) - 50;
      const sx = s.side === 0 ? roadMargin * 0.5 : cssW - roadMargin * 0.5;
      ctx.fillStyle = isDay ? 'rgba(0,0,0,0.25)' : 'rgba(255, 220, 150, 0.85)';
      ctx.beginPath();
      ctx.arc(sx, sy, 4, 0, Math.PI * 2);
      ctx.fill();
      if (!isDay) {
        ctx.fillStyle = 'rgba(255, 220, 150, 0.12)';
        ctx.beginPath();
        ctx.arc(sx, sy, 22, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = Math.max(2, cssW * 0.01);
    const dash = cssH * 0.05;
    ctx.setLineDash([dash, dash]);
    ctx.lineDashOffset = -roadOffset;
    for (let lane = 1; lane < LANES; lane++) {
      const x = roadMargin + laneWidth * lane;
      ctx.beginPath();
      ctx.moveTo(x, -dash);
      ctx.lineTo(x, cssH);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    const vg = ctx.createRadialGradient(cssW / 2, cssH * 0.4, cssH * 0.2, cssW / 2, cssH * 0.5, cssH * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, isDay ? 'rgba(0,0,0,0.12)' : 'rgba(0,0,0,0.35)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, cssW, cssH);
  }

  function drawCoin(c) {
    ctx.save();
    ctx.translate(c.x, c.y);
    const squash = Math.max(0.2, Math.abs(Math.cos(c.spin)));
    ctx.scale(squash, 1);
    const grad = ctx.createLinearGradient(-c.r, -c.r, c.r, c.r);
    grad.addColorStop(0, '#fff3b0');
    grad.addColorStop(1, '#ffb020');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, c.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#c67700';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  }

  function drawPowerUp(p) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.spin);
    ctx.fillStyle = 'rgba(79,168,255,0.25)';
    ctx.beginPath();
    ctx.arc(0, 0, p.r * 1.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#4fa8ff';
    roundRect(-p.r, -p.r, p.r * 2, p.r * 2, p.r * 0.4);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = `${p.r * 1.3}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🛡', 0, 1);
    ctx.restore();
  }

  function drawParticles() {
    for (const p of particles) {
      const t = 1 - p.age / p.life;
      ctx.globalAlpha = Math.max(0, t);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * t, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function render() {
    ctx.save();
    if (shakeTime > 0) {
      const m = shakeMag * (shakeTime / 0.35);
      ctx.translate((Math.random() - 0.5) * m, (Math.random() - 0.5) * m);
    }
    drawRoad();
    for (const c of coins) drawCoin(c);
    for (const p of powerUps) drawPowerUp(p);
    for (const o of obstacles) drawCar(o.x, o.y, o.w, o.h, o.c1, o.c2, 0, false);
    if (running) drawCar(player.x, player.y, player.w, player.h, '#2af0a0', '#0f9d58', player.tilt, shieldTime > 0);
    drawParticles();
    ctx.restore();
    scoreDisplay.textContent = String(Math.floor(score));
  }

  // ---------- loop ----------
  function loop(time) {
    if (!running || paused) return;
    const dt = Math.min(0.05, (time - lastTime) / 1000 || 0);
    lastTime = time;
    update(dt);
    render();
    if (running && !paused) requestAnimationFrame(loop);
  }

  function startGame() {
    ensureAudio();
    startOverlay.classList.add('hidden');
    gameOverOverlay.classList.add('hidden');
    pauseOverlay.classList.add('hidden');
    leaderboardOverlay.classList.add('hidden');
    pauseBtn.style.display = 'flex';
    resize();
    resetState();
    lastTime = performance.now();
    requestAnimationFrame(loop);
  }

  // Ad break before the very first round of a session begins.
  let hasPlayedOnce = false;
  function requestStartGame() {
    ensureAudio();
    if (hasPlayedOnce) { startGame(); return; }
    startBtn.disabled = true;
    requestAd({
      type: 'start',
      name: 'start_game',
      afterAd: () => { startBtn.disabled = false; hasPlayedOnce = true; startGame(); },
    });
  }

  // Ad break between rounds ("Play Again").
  function requestNextRound() {
    retryBtn.disabled = true;
    requestAd({
      type: 'next',
      name: 'next_round',
      afterAd: () => { retryBtn.disabled = false; startGame(); },
    });
  }

  function backToMenu() {
    running = false;
    paused = false;
    pauseBtn.style.display = 'none';
    gameOverOverlay.classList.add('hidden');
    pauseOverlay.classList.add('hidden');
    startOverlay.classList.remove('hidden');
    render();
  }

  function togglePause(forceState) {
    if (!running) return;
    const wasPaused = paused;
    paused = typeof forceState === 'boolean' ? forceState : !paused;
    pauseOverlay.classList.toggle('hidden', !paused);
    if (!paused && wasPaused) {
      resumeBtn.disabled = true;
      requestAd({
        type: 'pause',
        name: 'resume_game',
        afterAd: () => {
          resumeBtn.disabled = false;
          lastTime = performance.now();
          requestAnimationFrame(loop);
        },
      });
    } else if (!paused) {
      lastTime = performance.now();
      requestAnimationFrame(loop);
    }
  }

  // Rewarded ad: watch a full ad to revive once and continue the same run.
  function requestRevive() {
    if (reviveUsed) return;
    reviveBtn.disabled = true;
    reviveBtn.textContent = 'Loading ad…';
    requestAd({
      type: 'reward',
      name: 'revive_run',
      beforeReward: (showAdFn) => showAdFn(),
      adViewed: () => {
        reviveUsed = true;
        gameOverOverlay.classList.add('hidden');
        reviveAfterCrash();
      },
      adDismissed: () => {
        reviveUsed = true;
        reviveBtn.classList.add('hidden');
      },
    });
  }

  function moveLane(delta) {
    if (!running || paused) return;
    const next = Math.max(0, Math.min(LANES - 1, player.lane + delta));
    if (next !== player.lane) {
      player.lane = next;
      player.targetX = laneCenterX(player.lane);
      sfxSwitch();
    }
  }

  // ---------- input ----------
  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') moveLane(-1);
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') moveLane(1);
    if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') togglePause();
  });

  let touchStartX = null;
  canvas.addEventListener('touchstart', (e) => { touchStartX = e.touches[0].clientX; }, { passive: true });
  canvas.addEventListener('touchend', (e) => {
    if (touchStartX === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX;
    if (dx > 28) moveLane(1);
    else if (dx < -28) moveLane(-1);
    touchStartX = null;
  }, { passive: true });

  function bindHold(el, fn) {
    el.addEventListener('pointerdown', (e) => { e.preventDefault(); fn(); });
  }
  bindHold(leftBtn, () => moveLane(-1));
  bindHold(rightBtn, () => moveLane(1));

  startBtn.addEventListener('click', requestStartGame);
  retryBtn.addEventListener('click', requestNextRound);
  reviveBtn.addEventListener('click', requestRevive);
  menuBtn.addEventListener('click', backToMenu);
  quitBtn.addEventListener('click', backToMenu);
  pauseBtn.addEventListener('click', () => togglePause(true));
  resumeBtn.addEventListener('click', () => togglePause(false));

  soundBtn.addEventListener('click', () => {
    soundOn = !soundOn;
    localStorage.setItem(SOUND_KEY, soundOn ? 'on' : 'off');
    soundBtn.textContent = soundOn ? '🔊' : '🔇';
    if (soundOn) { ensureAudio(); sfxTick(); }
  });

  themeBtn.addEventListener('click', () => {
    theme = theme === 'day' ? 'night' : 'day';
    localStorage.setItem(THEME_KEY, theme);
    applyTheme();
  });

  difficultyRow.addEventListener('click', (e) => {
    const btn = e.target.closest('.diff-btn');
    if (!btn) return;
    difficulty = btn.dataset.diff;
    localStorage.setItem(DIFF_KEY, difficulty);
    [...difficultyRow.children].forEach(b => b.classList.toggle('active', b === btn));
  });

  showLeaderboardBtn.addEventListener('click', () => {
    renderLeaderboard();
    startOverlay.classList.add('hidden');
    leaderboardOverlay.classList.remove('hidden');
  });
  closeLeaderboardBtn.addEventListener('click', () => {
    leaderboardOverlay.classList.add('hidden');
    startOverlay.classList.remove('hidden');
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && running && !paused) togglePause(true);
  });

  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 200));

  // ---------- init ----------
  detectTouch();
  loadBest();
  loadSound();
  loadTheme();
  loadDifficulty();
  resize();
  render();
})();
