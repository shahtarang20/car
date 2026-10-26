(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);

  const wrap = document.querySelector('.game-wrap');
  const canvas = $('gameCanvas');
  const ctx = canvas.getContext('2d');

  const scoreDisplay = $('scoreDisplay');
  const bestDisplay = $('bestDisplay');
  const comboDisplay = $('comboDisplay');
  const shieldDisplay = $('shieldDisplay');
  const srStatus = $('srStatus');

  const startOverlay = $('startOverlay');
  const pauseOverlay = $('pauseOverlay');
  const gameOverOverlay = $('gameOverOverlay');
  const leaderboardOverlay = $('leaderboardOverlay');
  const garageOverlay = $('garageOverlay');
  const achievementsOverlay = $('achievementsOverlay');
  const allOverlays = [startOverlay, pauseOverlay, gameOverOverlay, leaderboardOverlay, garageOverlay, achievementsOverlay];

  const startBtn = $('startBtn');
  const retryBtn = $('retryBtn');
  const resumeBtn = $('resumeBtn');
  const quitBtn = $('quitBtn');
  const menuBtn = $('menuBtn');
  const pauseBtn = $('pauseBtn');
  const soundBtn = $('soundBtn');
  const themeBtn = $('themeBtn');
  const leftBtn = $('leftBtn');
  const rightBtn = $('rightBtn');
  const reviveBtn = $('reviveBtn');
  const shareBtn = $('shareBtn');
  const inviteBtn = $('inviteBtn');
  const difficultyRow = $('difficultyRow');
  const streakLine = $('streakLine');
  const challengeLine = $('challengeLine');
  const menuBest = $('menuBest');
  const menuWallet = $('menuWallet');
  const leaderboardList = $('leaderboardList');
  const achievementsList = $('achievementsList');
  const achievementsCount = $('achievementsCount');
  const skinGrid = $('skinGrid');
  const walletVal = $('walletVal');
  const toastStack = $('toastStack');
  const gameOverEmoji = $('gameOverEmoji');
  const gameOverTitle = $('gameOverTitle');
  const newBestBadge = $('newBestBadge');
  const finalScoreVal = $('finalScoreVal');
  const finalCoinsVal = $('finalCoinsVal');
  const finalBestVal = $('finalBestVal');
  const finalTimeVal = $('finalTimeVal');
  const gameOverNote = $('gameOverNote');

  const BEST_KEY = 'roaddash_best_score';
  const SOUND_KEY = 'roaddash_sound_on';
  const THEME_KEY = 'roaddash_theme';
  const SCORES_KEY = 'roaddash_leaderboard';
  const DIFF_KEY = 'roaddash_difficulty';
  const STATS_KEY = 'roaddash_stats';

  const LANES = 3;
  const ROAD_MARGIN_RATIO = 0.06;
  const SHARE_BONUS_COINS = 50;

  const DIFFICULTIES = {
    easy:   { speedMul: 0.8,  spawnMul: 1.25, label: 'Easy'   },
    normal: { speedMul: 1.0,  spawnMul: 1.0,  label: 'Normal' },
    hard:   { speedMul: 1.3,  spawnMul: 0.78, label: 'Hard'   },
  };

  const CAR_SKINS = [
    { id: 'classic',  name: 'Classic',  cost: 0,   c1: '#2af0a0', c2: '#0f9d58' },
    { id: 'crimson',  name: 'Crimson',  cost: 150, c1: '#ff6b81', c2: '#c0392b' },
    { id: 'azure',    name: 'Azure',    cost: 150, c1: '#5dd5ff', c2: '#1a73e8' },
    { id: 'gold',     name: 'Gold Rush',cost: 300, c1: '#ffe066', c2: '#e6a817' },
    { id: 'violet',   name: 'Violet',   cost: 300, c1: '#c58bff', c2: '#7c3aed' },
    { id: 'obsidian', name: 'Obsidian', cost: 500, c1: '#8b97b8', c2: '#1c2438' },
  ];

  const ACHIEVEMENTS = [
    { id: 'first_run',   icon: '🚦', name: 'First Drive',      desc: 'Play your first run',              check: s => s.gamesPlayed >= 1 },
    { id: 'coin_100',    icon: '🪙', name: 'Coin Collector',   desc: 'Collect 100 coins lifetime',        check: s => s.lifetimeCoins >= 100 },
    { id: 'coin_500',    icon: '💰', name: 'Coin Hoarder',     desc: 'Collect 500 coins lifetime',        check: s => s.lifetimeCoins >= 500 },
    { id: 'combo_5',     icon: '🔥', name: 'Combo Master',     desc: 'Reach x5.0 combo in a run',         check: s => s.bestCombo >= 5 },
    { id: 'survive_60',  icon: '⏱️', name: 'Road Warrior',     desc: 'Survive 60 seconds in one run',     check: s => s.bestSurvival >= 60 },
    { id: 'survive_120', icon: '🏆', name: 'Endurance Driver', desc: 'Survive 120 seconds in one run',    check: s => s.bestSurvival >= 120 },
    { id: 'near_10',     icon: '😅', name: 'Close Call',       desc: '10 near-misses in a single run',    check: s => s.bestNearMiss >= 10 },
    { id: 'streak_3',    icon: '📅', name: 'Regular',          desc: 'Reach a 3-day play streak',         check: s => s.bestStreak >= 3 },
    { id: 'streak_7',    icon: '🌟', name: 'Dedicated',        desc: 'Reach a 7-day play streak',         check: s => s.bestStreak >= 7 },
    { id: 'social',      icon: '📣', name: 'Social Driver',    desc: 'Share your score with a friend',    check: s => s.sharedCount >= 1 },
  ];

  const ROAD_COLORS = [
    ['#ff5470', '#c81e46'],
    ['#ffb830', '#c67700'],
    ['#4fa8ff', '#1a5fc4'],
    ['#c084fc', '#7c3aed'],
  ];

  const AD_WAIT_MS = 3500;        // how long we wait for an interstitial to start (API ready)
  const AD_COLD_WAIT_MS = 1500;   // ...and when Google's API hasn't reported ready (blocked / not enrolled)
  const AD_REWARD_WAIT_MS = 6000; // rewarded ads are slower to load
  const CRASH_SLOWMO = 0.4;
  const CRASH_DURATION = 0.8;
  const MENU_SPEED_RATIO = 0.2;
  const SPEEDUP_EVERY = 20;       // seconds of play between "Speed up!" callouts

  const reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- safe storage (private mode / blocked storage must never break the game) ----------
  const store = {
    get(key, fallback) {
      try {
        const v = localStorage.getItem(key);
        return v === null ? fallback : v;
      } catch (e) { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(key, value); } catch (e) { /* ignore */ }
    },
  };

  // ---------- state ----------
  let cssW = 360, cssH = 600, dpr = 1;
  let roadMargin = 0, roadWidth = 0, laneWidth = 0;

  let state = 'menu'; // menu | countdown | playing | paused | crashing | over
  let player, obstacles, particles, coins, powerUps, floatTexts, streaks;
  let score = 0, coinsCollected = 0, best = 0, speed = 0;
  let lastSpawn = 0, lastCoinSpawn = 0, lastPowerSpawn = 0, lastTime = 0, roadScroll = 0;
  let soundOn = true, theme = 'night', difficulty = 'normal';
  let combo = 1, comboTimer = 0, runBestCombo = 1;
  let shieldTime = 0, shieldMax = 5;
  let shakeTime = 0, shakeMag = 0;
  let flashAlpha = 0;
  let isTouchDevice = false;
  let reviveUsed = false;
  let runTime = 0;
  let nearMissCount = 0;
  let speedMilestone = 0;
  let stats = null;
  let selectedSkin = 'classic';
  let challenge = null;
  let challengeBeaten = false;

  // per-run bookkeeping so a revive doesn't double-count coins/games/leaderboard
  let bestAtRunStart = 0;
  let runCounted = false;
  let runCoinsBanked = 0;
  let runSavedScore = null;

  let countdownT = 0, countdownKind = 'new', lastCountNum = -1;
  let crashT = 0;
  let pausedManual = false;
  let adPending = false;
  let lastScoreText = '';
  let countToken = 0;
  let announceTimer = 0;
  let keyboardNav = false;

  // ---------- ad breaks (Google Ad Placement API for HTML5 games) ----------
  // Docs: https://developers.google.com/ad-placement
  // onResult is ALWAYS called exactly once with 'viewed' | 'dismissed' | 'unavailable',
  // even when the API is missing / blocked / has no fill, so the game is never
  // stuck waiting on an ad. Once an ad is actually on screen we stop the short
  // "did it start?" timer and wait for Google's completion callback instead.
  function requestAd(type, name, onResult) {
    if (adPending) return false;
    if (window.__adsBlocked || typeof window.adBreak !== 'function') {
      setTimeout(() => onResult('unavailable'), 0);
      return true;
    }
    adPending = true;
    let finished = false;
    let timer = 0;
    const finish = (result) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      adPending = false;
      onResult(result);
    };
    const arm = (ms) => {
      clearTimeout(timer);
      timer = setTimeout(() => finish('unavailable'), ms);
    };
    const opts = {
      type,
      name,
      adBreakDone: (info) => finish(info && info.breakStatus === 'viewed' ? 'viewed' : 'unavailable'),
    };
    if (type === 'reward') {
      opts.beforeReward = (showAdFn) => {
        if (finished) return; // we already gave up on this one
        arm(180000);
        showAdFn();
      };
      opts.adViewed = () => finish('viewed');
      opts.adDismissed = () => finish('dismissed');
    } else {
      opts.beforeAd = () => {
        // The ad arrived after we gave up waiting and the game moved on:
        // pause so it never plays over a live run.
        if (finished) { pauseGame(false); return; }
        arm(180000);
      };
      opts.afterAd = () => finish('viewed');
    }
    arm(type === 'reward' ? AD_REWARD_WAIT_MS : (window.__adReady ? AD_WAIT_MS : AD_COLD_WAIT_MS));
    try {
      window.adBreak(opts);
    } catch (e) {
      finish('unavailable');
    }
    return true;
  }

  function setAdSound() {
    if (typeof window.adConfig === 'function') {
      try { window.adConfig({ sound: soundOn ? 'on' : 'off' }); } catch (e) { /* ignore */ }
    }
  }

  // ---------- audio ----------
  let audioCtx = null;
  function ensureAudio() {
    if (!audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) { try { audioCtx = new AC(); } catch (e) { audioCtx = null; } }
    }
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
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
  function sfxGo() { beep(1320, 0.18, 'triangle', 0.07); }
  function sfxSpeedUp() { beep(440, 0.1, 'triangle', 0.05); beep(660, 0.14, 'triangle', 0.05); }

  function buzz(pattern) {
    if (reducedMotion || !navigator.vibrate) return;
    try { navigator.vibrate(pattern); } catch (e) { /* ignore */ }
  }

  function announce(msg) {
    if (!srStatus) return;
    clearTimeout(announceTimer);
    srStatus.textContent = '';
    announceTimer = setTimeout(() => { srStatus.textContent = msg; }, 50);
  }

  // ---------- responsive sizing ----------
  function resize() {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const prevH = cssH;
    cssW = rect.width;
    cssH = rect.height;
    dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    roadMargin = cssW * ROAD_MARGIN_RATIO;
    roadWidth = cssW - roadMargin * 2;
    laneWidth = roadWidth / LANES;

    if (!player) return;
    // Re-fit the live scene to the new size so rotating a phone or resizing the
    // window mid-run doesn't leave cars between lanes or at the wrong depth.
    const ky = prevH > 0 ? cssH / prevH : 1;
    const w = laneWidth * 0.52;
    const h = w * 1.7;
    player.w = w;
    player.h = h;
    player.y = cssH - h - cssH * 0.08;
    player.x = laneCenterX(player.lane);
    player.targetX = player.x;
    speed *= ky;
    for (const o of obstacles) { o.x = laneCenterX(o.lane); o.y *= ky; o.w = w; o.h = h; }
    for (const c of coins) { c.x = laneCenterX(c.lane); c.y *= ky; c.r = laneWidth * 0.14; }
    for (const p of powerUps) { p.x = laneCenterX(p.lane); p.y *= ky; p.r = laneWidth * 0.18; }
    for (const s of streaks) { s.y *= ky; }
    if (state !== 'playing' && state !== 'countdown') render();
  }

  function laneCenterX(lane) {
    return roadMargin + laneWidth * lane + laneWidth / 2;
  }

  function detectTouch() {
    isTouchDevice = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
    if (isTouchDevice) document.body.classList.add('touch-device');
  }

  // ---------- scene / run state ----------
  function setState(next) {
    state = next;
    wrap.dataset.state = next;
  }

  // The visual scene (player car, empty road) — used by the menu and every run.
  function resetScene() {
    const w = laneWidth * 0.52;
    const h = w * 1.7;
    player = { lane: 1, x: laneCenterX(1), targetX: laneCenterX(1), y: cssH - h - cssH * 0.08, w, h, tilt: 0 };
    obstacles = [];
    particles = [];
    floatTexts = [];
    coins = [];
    powerUps = [];
    streaks = [];
    for (let i = 0; i < 9; i++) {
      streaks.push({ x: roadMargin + Math.random() * roadWidth, y: Math.random() * cssH, len: cssH * (0.04 + Math.random() * 0.05) });
    }
    shieldTime = 0;
    shakeTime = 0;
    flashAlpha = 0;
    combo = 1;
    comboTimer = 0;
    comboDisplay.classList.remove('show');
    speed = cssH * MENU_SPEED_RATIO;
  }

  function resetRun() {
    resetScene();
    score = 0;
    coinsCollected = 0;
    nearMissCount = 0;
    runTime = 0;
    runBestCombo = 1;
    speedMilestone = 0;
    const diff = DIFFICULTIES[difficulty];
    speed = cssH * 0.36 * diff.speedMul;
    lastSpawn = 0;
    lastCoinSpawn = 0;
    lastPowerSpawn = 0;
    // Daily-streak bonus: a couple of free shield seconds to start the run.
    shieldTime = stats.streak >= 2 ? Math.min(3, stats.streak * 0.5) : 0;
    shieldMax = Math.max(5, shieldTime);
    reviveUsed = false;
    bestAtRunStart = best;
    runCounted = false;
    runCoinsBanked = 0;
    runSavedScore = null;
    lastScoreText = '';
    challengeBeaten = false;
  }

  function loadBest() {
    best = Number(store.get(BEST_KEY, 0)) || 0;
    bestDisplay.textContent = 'BEST ' + best;
  }
  function loadSound() {
    soundOn = store.get(SOUND_KEY, 'on') !== 'off';
    soundBtn.textContent = soundOn ? '🔊' : '🔇';
    soundBtn.setAttribute('aria-label', soundOn ? 'Mute sound' : 'Unmute sound');
  }
  function loadTheme() {
    theme = store.get(THEME_KEY, 'night');
    applyTheme();
  }
  function applyTheme() {
    document.body.setAttribute('data-theme', theme === 'day' ? 'day' : '');
    themeBtn.textContent = theme === 'day' ? '☀️' : '🌙';
    themeBtn.setAttribute('aria-label', theme === 'day' ? 'Switch to night theme' : 'Switch to day theme');
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'day' ? '#cfe8ff' : '#0b1120');
    if (state !== 'playing' && state !== 'countdown' && roadWidth) render();
  }
  function loadDifficulty() {
    const saved = store.get(DIFF_KEY, 'normal');
    difficulty = Object.prototype.hasOwnProperty.call(DIFFICULTIES, saved) ? saved : 'normal';
    [...difficultyRow.children].forEach(btn => {
      const on = btn.dataset.diff === difficulty;
      btn.classList.toggle('active', on);
      btn.setAttribute('aria-checked', String(on));
    });
  }

  // ---------- persistent stats: streaks, achievements, wallet ----------
  function defaultStats() {
    return {
      gamesPlayed: 0,
      lifetimeCoins: 0,
      coinBank: 0,
      bestCombo: 1,
      bestSurvival: 0,
      bestNearMiss: 0,
      streak: 0,
      bestStreak: 0,
      lastPlayedDate: null,
      unlockedSkins: ['classic'],
      selectedSkin: 'classic',
      unlockedAchievements: [],
      sharedCount: 0,
      shareBonusClaimed: false,
    };
  }

  function loadStats() {
    try {
      const raw = JSON.parse(store.get(STATS_KEY, 'null'));
      stats = raw && typeof raw === 'object' ? { ...defaultStats(), ...raw } : defaultStats();
    } catch (e) {
      stats = defaultStats();
    }
    const defaults = defaultStats();
    for (const k of Object.keys(defaults)) {
      if (typeof defaults[k] === 'number' && !(Number.isFinite(stats[k]) && stats[k] >= 0)) stats[k] = defaults[k];
    }
    stats.bestCombo = Math.max(1, stats.bestCombo);
    if (!Array.isArray(stats.unlockedSkins) || !stats.unlockedSkins.includes('classic')) stats.unlockedSkins = ['classic', ...(Array.isArray(stats.unlockedSkins) ? stats.unlockedSkins : [])];
    if (!Array.isArray(stats.unlockedAchievements)) stats.unlockedAchievements = [];
    selectedSkin = CAR_SKINS.some(s => s.id === stats.selectedSkin) && stats.unlockedSkins.includes(stats.selectedSkin) ? stats.selectedSkin : 'classic';
  }
  function saveStats() {
    store.set(STATS_KEY, JSON.stringify(stats));
  }

  // Local calendar date (not UTC) so the streak rolls over at the player's midnight.
  function dateKey(d) {
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${m}-${day}`;
  }

  function applyDailyStreak() {
    const today = dateKey(new Date());
    if (stats.lastPlayedDate === today) return;
    const y = new Date();
    y.setDate(y.getDate() - 1);
    stats.streak = stats.lastPlayedDate === dateKey(y) ? stats.streak + 1 : 1;
    stats.lastPlayedDate = today;
    stats.bestStreak = Math.max(stats.bestStreak, stats.streak);
    saveStats();
  }

  function renderStreakBanner() {
    if (stats.streak >= 2) {
      streakLine.textContent = `🔥 Day ${stats.streak} streak — bonus starting shield!`;
      streakLine.classList.remove('hidden');
    } else {
      streakLine.classList.add('hidden');
    }
  }

  function showToast(icon, title, desc) {
    const el = document.createElement('div');
    el.className = 'achv-toast';
    const iconEl = document.createElement('span');
    iconEl.className = 'icon';
    iconEl.textContent = icon;
    const body = document.createElement('span');
    const b = document.createElement('b');
    b.textContent = title;
    const d = document.createElement('span');
    d.className = 'desc';
    d.textContent = desc;
    body.append(b, d);
    el.append(iconEl, body);
    toastStack.appendChild(el);
    setTimeout(() => el.remove(), 3100);
  }

  function checkAchievements() {
    for (const a of ACHIEVEMENTS) {
      if (!stats.unlockedAchievements.includes(a.id) && a.check(stats)) {
        stats.unlockedAchievements.push(a.id);
        showToast(a.icon, 'Achievement unlocked!', a.name);
        buzz(30);
      }
    }
    saveStats();
  }

  function renderAchievements() {
    achievementsList.textContent = '';
    for (const a of ACHIEVEMENTS) {
      const unlocked = stats.unlockedAchievements.includes(a.id);
      const li = document.createElement('li');
      li.className = 'achv-row' + (unlocked ? ' unlocked' : '');
      const left = document.createElement('span');
      left.className = 'achv-main';
      const ic = document.createElement('span');
      ic.className = 'achv-icon';
      ic.textContent = a.icon;
      const txt = document.createElement('span');
      const name = document.createElement('b');
      name.textContent = a.name;
      const desc = document.createElement('small');
      desc.textContent = a.desc;
      txt.append(name, desc);
      left.append(ic, txt);
      const mark = document.createElement('span');
      mark.textContent = unlocked ? '✅' : '🔒';
      mark.setAttribute('aria-label', unlocked ? 'Unlocked' : 'Locked');
      li.append(left, mark);
      achievementsList.appendChild(li);
    }
    achievementsCount.textContent = `${stats.unlockedAchievements.length} / ${ACHIEVEMENTS.length} unlocked`;
  }

  function skinById(id) {
    return CAR_SKINS.find(s => s.id === id) || CAR_SKINS[0];
  }

  function makeSkinThumb(skin) {
    const c = document.createElement('canvas');
    const w = 44, h = 64, ratio = 2;
    c.width = w * ratio;
    c.height = h * ratio;
    c.style.width = w + 'px';
    c.style.height = h + 'px';
    const g = c.getContext('2d');
    g.scale(ratio, ratio);
    drawCarTo(g, w / 2, h / 2, 26, 44, skin.c1, skin.c2, 0, false, false);
    return c;
  }

  function nextSkinGoal() {
    const locked = CAR_SKINS.filter(s => !stats.unlockedSkins.includes(s.id)).sort((a, b) => a.cost - b.cost);
    return locked[0] || null;
  }

  function renderGarage() {
    walletVal.textContent = stats.coinBank;
    skinGrid.textContent = '';
    for (const skin of CAR_SKINS) {
      const unlocked = stats.unlockedSkins.includes(skin.id);
      const equipped = selectedSkin === skin.id;
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'skin-card' + (unlocked ? '' : ' locked') + (equipped ? ' selected' : '');
      card.setAttribute('aria-pressed', String(equipped));

      const swatch = document.createElement('div');
      swatch.className = 'skin-swatch';
      swatch.style.background = `radial-gradient(circle at 50% 60%, ${skin.c1}33, transparent 70%)`;
      swatch.appendChild(makeSkinThumb(skin));

      const name = document.createElement('div');
      name.className = 'skin-name';
      name.textContent = skin.name;

      const sub = document.createElement('div');
      sub.className = 'skin-sub';
      if (unlocked) {
        sub.textContent = equipped ? 'Equipped' : 'Tap to equip';
      } else {
        const cost = document.createElement('span');
        cost.className = 'skin-cost';
        cost.textContent = '🪙 ' + skin.cost;
        sub.appendChild(cost);
      }
      card.append(swatch, name, sub);

      card.addEventListener('click', () => {
        if (unlocked) {
          selectedSkin = skin.id;
          stats.selectedSkin = skin.id;
          saveStats();
          renderGarage();
          updateMenuStats();
        } else if (stats.coinBank >= skin.cost) {
          stats.coinBank -= skin.cost;
          stats.unlockedSkins.push(skin.id);
          selectedSkin = skin.id;
          stats.selectedSkin = skin.id;
          saveStats();
          renderGarage();
          updateMenuStats();
          showToast('🚘', 'New skin unlocked!', skin.name);
          buzz(25);
          sfxPower();
        } else {
          showToast('🪙', 'Not enough coins', `${skin.cost - stats.coinBank} more coins for ${skin.name}`);
          card.classList.remove('nope');
          void card.offsetWidth;
          card.classList.add('nope');
        }
      });
      skinGrid.appendChild(card);
    }
  }

  function currentSkinColors() {
    const skin = skinById(selectedSkin);
    return [skin.c1, skin.c2];
  }

  function loadScores() {
    try {
      const arr = JSON.parse(store.get(SCORES_KEY, '[]'));
      return Array.isArray(arr) ? arr.filter(n => Number.isFinite(n)) : [];
    } catch (e) { return []; }
  }
  function saveScore(finalScore) {
    const scores = loadScores();
    scores.push(Math.floor(finalScore));
    scores.sort((a, b) => b - a);
    store.set(SCORES_KEY, JSON.stringify(scores.slice(0, 5)));
  }
  function removeScore(value) {
    const scores = loadScores();
    const i = scores.indexOf(value);
    if (i >= 0) {
      scores.splice(i, 1);
      store.set(SCORES_KEY, JSON.stringify(scores));
    }
  }
  function renderLeaderboard() {
    const scores = loadScores();
    leaderboardList.textContent = '';
    if (scores.length === 0) {
      const li = document.createElement('li');
      li.className = 'empty';
      li.textContent = 'No scores yet — play a run!';
      leaderboardList.appendChild(li);
      return;
    }
    const medals = ['🥇', '🥈', '🥉'];
    scores.forEach((s, i) => {
      const li = document.createElement('li');
      const rank = document.createElement('span');
      rank.className = 'rank';
      rank.textContent = medals[i] || '#' + (i + 1);
      const val = document.createElement('b');
      val.textContent = s.toLocaleString();
      li.append(rank, val);
      leaderboardList.appendChild(li);
    });
  }

  // ---------- overlays ----------
  function showOverlay(el) {
    for (const o of allOverlays) o.classList.toggle('hidden', o !== el);
    if (!el) return;
    // Only move focus for keyboard users — a focus ring popping onto "Play" is
    // noise for mouse and touch players.
    const target = keyboardNav ? el.querySelector('[data-autofocus]') : null;
    if (target && !target.disabled) {
      try { target.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
    }
  }
  function hideOverlays() {
    showOverlay(null);
    if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
  }

  function updateMenuStats() {
    menuBest.textContent = best.toLocaleString();
    menuWallet.textContent = stats.coinBank.toLocaleString();
    if (challenge) {
      challengeLine.classList.remove('hidden');
      challengeLine.textContent = '';
      const who = challenge.name ? challenge.name : 'A friend';
      const strong = document.createElement('b');
      strong.textContent = challenge.score.toLocaleString();
      challengeLine.append('🎯 ' + who + ' scored ', strong, ' — can you beat it?');
    } else {
      challengeLine.classList.add('hidden');
    }
  }

  function showMenu() {
    setState('menu');
    resetScene();
    updateMenuStats();
    renderStreakBanner();
    showOverlay(startOverlay);
    render();
  }

  // ---------- spawning ----------
  function spawnObstacle() {
    // Never let the last few cars wall off every lane at once — that would be
    // an unwinnable pattern, not a skill test.
    const nearTop = obstacles.filter(o => o.y < Math.max(player.h * 3.4, speed * 0.7));
    const blocked = new Set(nearTop.map(o => o.lane));
    let lanes = [0, 1, 2];
    if (blocked.size >= LANES - 1) lanes = lanes.filter(l => blocked.has(l));
    const lane = lanes[Math.floor(Math.random() * lanes.length)];
    const w = laneWidth * 0.52;
    const h = w * 1.7;
    const [c1, c2] = ROAD_COLORS[Math.floor(Math.random() * ROAD_COLORS.length)];
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

  function spawnFloatText(x, y, text, color, size) {
    floatTexts.push({ x, y, text, color, size: size || 15, age: 0, life: 0.8 });
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
  // Shared by every state: particles, floating text, screen flash/shake, and
  // the player car easing toward its lane.
  function updateEffects(dt) {
    const dx = player.targetX - player.x;
    player.x += dx * Math.min(1, dt * 14);
    player.tilt = Math.max(-0.16, Math.min(0.16, dx * 0.01));

    for (const p of particles) {
      p.age += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 300 * dt;
    }
    particles = particles.filter(p => p.age < p.life);

    for (const t of floatTexts) { t.age += dt; t.y -= dt * 40; }
    floatTexts = floatTexts.filter(t => t.age < t.life);

    if (shakeTime > 0) shakeTime -= dt;
    if (flashAlpha > 0) flashAlpha = Math.max(0, flashAlpha - dt * 1.8);
  }

  function scrollRoad(dt, sp) {
    roadScroll += sp * dt;
    for (const s of streaks) {
      s.y += sp * 1.5 * dt;
      if (s.y - s.len > cssH) {
        s.y = -s.len;
        s.x = roadMargin + Math.random() * roadWidth;
      }
    }
  }

  function updateMenu(dt) {
    scrollRoad(dt, speed);
    updateEffects(dt);
    if (Math.random() < dt * 8) spawnExhaust();
  }

  function updateCountdown(dt) {
    scrollRoad(dt, cssH * 0.14);
    updateEffects(dt);
    if (Math.random() < dt * 14) spawnExhaust();
    countdownT += dt;
    const step = countdownKind === 'new' ? 0.62 : 0.5;
    const num = countdownT < step * 3 ? 3 - Math.floor(countdownT / step) : 0;
    if (num !== lastCountNum) {
      lastCountNum = num;
      if (num > 0) sfxTick(); else sfxGo();
    }
    if (countdownT >= step * 3 + 0.3) {
      setState('playing');
      announce('Go!');
    }
  }

  function update(dt) {
    runTime += dt;
    scrollRoad(dt, speed);
    // Ramp up, but cap so late runs stay beatable (and "Endurance Driver" reachable).
    speed = Math.min(speed + dt * (cssH * 0.012), cssH * 1.25 * DIFFICULTIES[difficulty].speedMul);

    updateEffects(dt);

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

    // Near-miss: an obstacle that slides past the player with only a small
    // lateral gap and no collision — rewarded with bonus points + a flash.
    for (const o of obstacles) {
      if (o.nearMissChecked) continue;
      if (o.y > player.y + player.h / 2) {
        o.nearMissChecked = true;
        const gap = Math.abs(o.x - player.x) - (o.w + player.w) / 2;
        if (gap > 0 && gap < laneWidth * 0.35) {
          nearMissCount++;
          score += 15;
          flashAlpha = reducedMotion ? 0.12 : 0.35;
          spawnFloatText(player.x, player.y - player.h / 2, 'Close call! +15', '#ffd166');
          beep(700, 0.07, 'square', 0.05);
          buzz(12);
        }
      }
    }

    obstacles = obstacles.filter(o => o.y < cssH + o.h);

    for (const c of coins) { c.y += speed * dt; c.spin += dt * 6; }
    coins = coins.filter(c => c.y < cssH + 40);

    for (const p of powerUps) { p.y += speed * dt; p.spin += dt * 4; }
    powerUps = powerUps.filter(p => p.y < cssH + 40);

    if (comboTimer > 0) {
      comboTimer -= dt;
      if (comboTimer <= 0) { combo = 1; comboDisplay.classList.remove('show'); }
    }
    if (shieldTime > 0) shieldTime -= dt;

    score += dt * 12 * combo;

    const level = Math.floor(runTime / SPEEDUP_EVERY);
    if (level > speedMilestone) {
      speedMilestone = level;
      spawnFloatText(cssW / 2, cssH * 0.34, 'SPEED UP!', '#4fa8ff', 24);
      sfxSpeedUp();
    }

    const playerBox = { x: player.x, y: player.y + player.h * 0.1, w: player.w, h: player.h * 0.8 };

    for (let i = coins.length - 1; i >= 0; i--) {
      if (circleRectOverlap(coins[i], playerBox)) {
        coinsCollected++;
        score += 40;
        combo = Math.min(5, combo + 0.5);
        runBestCombo = Math.max(runBestCombo, combo);
        comboTimer = 3;
        comboDisplay.textContent = 'x' + combo.toFixed(1) + ' COMBO';
        comboDisplay.classList.add('show');
        comboDisplay.classList.remove('pop');
        void comboDisplay.offsetWidth;
        comboDisplay.classList.add('pop');
        spawnParticles(coins[i].x, coins[i].y, '#ffd166', 10);
        spawnFloatText(coins[i].x, coins[i].y, '+40', '#ffd166');
        sfxCoin();
        coins.splice(i, 1);
      }
    }

    for (let i = powerUps.length - 1; i >= 0; i--) {
      if (circleRectOverlap(powerUps[i], playerBox)) {
        shieldTime = 5;
        shieldMax = 5;
        spawnParticles(powerUps[i].x, powerUps[i].y, '#4fa8ff', 16);
        spawnFloatText(powerUps[i].x, powerUps[i].y, 'Shield!', '#4fa8ff');
        sfxPower();
        buzz(15);
        powerUps.splice(i, 1);
      }
    }

    for (const o of obstacles) {
      if (rectsOverlap(playerBox, o)) {
        if (shieldTime > 0) {
          spawnParticles(o.x, o.y, '#4fa8ff', 14);
          obstacles = obstacles.filter(x => x !== o);
          shieldTime = Math.max(0, shieldTime - 1.2);
          buzz(20);
        } else {
          crash();
          return;
        }
      }
    }
  }

  function updateCrash(dt) {
    const sdt = dt * CRASH_SLOWMO;
    crashT += dt;
    scrollRoad(sdt, speed * 0.6);
    for (const o of obstacles) o.y += speed * 0.6 * sdt;
    updateEffects(sdt);
    if (crashT >= CRASH_DURATION) showGameOver();
  }

  function updateOver(dt) {
    updateEffects(dt);
  }

  // Persist everything a run earned. Safe to call again after a revive: coins,
  // games-played and the leaderboard entry are applied as deltas, not twice.
  function commitRun() {
    const finalScore = Math.floor(score);
    if (finalScore > best) {
      best = finalScore;
      store.set(BEST_KEY, String(best));
    }
    bestDisplay.textContent = 'BEST ' + best;

    if (runSavedScore !== null) removeScore(runSavedScore);
    saveScore(finalScore);
    runSavedScore = finalScore;

    if (!runCounted) { stats.gamesPlayed += 1; runCounted = true; }
    const coinDelta = coinsCollected - runCoinsBanked;
    runCoinsBanked = coinsCollected;
    stats.lifetimeCoins += coinDelta;
    stats.coinBank += coinDelta;
    stats.bestCombo = Math.max(stats.bestCombo, runBestCombo);
    stats.bestSurvival = Math.max(stats.bestSurvival, runTime);
    stats.bestNearMiss = Math.max(stats.bestNearMiss, nearMissCount);
    saveStats();
    checkAchievements();
    return finalScore;
  }

  function crash() {
    setState('crashing');
    crashT = 0;
    spawnParticles(player.x, player.y, '#ff5470', 26);
    spawnParticles(player.x, player.y, '#ffd166', 12);
    shakeTime = reducedMotion ? 0.12 : 0.35;
    shakeMag = reducedMotion ? 3 : 12;
    sfxCrash();
    buzz([60, 40, 90]);
    commitRun();
    comboDisplay.classList.remove('show');
    announce('Crashed. Score ' + Math.floor(score));
  }

  function formatTime(secs) {
    const s = Math.floor(secs);
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  }

  function animateNumber(el, to, ms) {
    const token = ++countToken;
    if (reducedMotion || to < 10) { el.textContent = to.toLocaleString(); return; }
    const t0 = performance.now();
    const step = (now) => {
      if (token !== countToken) return;
      const p = Math.min(1, (now - t0) / ms);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(to * eased).toLocaleString();
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  function showGameOver() {
    setState('over');
    const finalScore = Math.floor(score);
    const isNew = finalScore > bestAtRunStart && finalScore > 0;

    gameOverOverlay.classList.toggle('new-best', isNew);
    gameOverEmoji.textContent = isNew ? '🏆' : '💥';
    gameOverTitle.textContent = isNew ? 'New Best!' : 'Crashed!';
    newBestBadge.textContent = bestAtRunStart > 0 ? `⭐ +${(finalScore - bestAtRunStart).toLocaleString()} over your old best` : '⭐ First high score!';
    newBestBadge.classList.toggle('hidden', !isNew);
    animateNumber(finalScoreVal, finalScore, 700);
    finalCoinsVal.textContent = coinsCollected;
    finalBestVal.textContent = best.toLocaleString();
    finalTimeVal.textContent = formatTime(runTime);

    // One contextual line: friend challenge result > next-skin progress.
    let note = '';
    if (challenge) {
      if (finalScore > challenge.score) {
        note = `🎯 You beat ${challenge.name || 'your friend'}'s ${challenge.score.toLocaleString()}!`;
        if (!challengeBeaten) { challengeBeaten = true; showToast('🎯', 'Challenge beaten!', `You passed ${challenge.name || 'your friend'}`); }
      } else {
        note = `🎯 ${(challenge.score - finalScore).toLocaleString()} more to beat ${challenge.name || 'your friend'}'s ${challenge.score.toLocaleString()}`;
      }
    } else {
      const goal = nextSkinGoal();
      if (goal) {
        const need = goal.cost - stats.coinBank;
        note = need > 0 ? `🪙 ${need} more coins to unlock ${goal.name}` : `🚘 You can afford ${goal.name} in the Garage!`;
      }
    }
    gameOverNote.textContent = note;
    gameOverNote.classList.toggle('hidden', !note);

    reviveBtn.classList.toggle('hidden', reviveUsed || !!window.__adsBlocked);
    reviveBtn.disabled = false;
    reviveBtn.textContent = '📺 Watch Ad to Continue';
    retryBtn.disabled = false;
    showOverlay(gameOverOverlay);

    if (window.RoadDashInstall && typeof window.RoadDashInstall.suggest === 'function' && stats.gamesPlayed >= 2) {
      setTimeout(() => { if (state === 'over') window.RoadDashInstall.suggest(); }, 4500);
    }
  }

  // ---------- render ----------
  function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  function drawCarTo(c, x, y, w, h, c1, c2, tilt, glow, shadow) {
    c.save();
    c.translate(x, y);
    if (tilt) c.rotate(tilt);

    if (shadow !== false) {
      c.fillStyle = 'rgba(0,0,0,0.35)';
      c.beginPath();
      c.ellipse(0, h / 2 + 4, w * 0.55, h * 0.12, 0, 0, Math.PI * 2);
      c.fill();
    }

    if (glow) {
      c.save();
      c.strokeStyle = 'rgba(79,168,255,0.85)';
      c.lineWidth = 3;
      c.shadowColor = '#4fa8ff';
      c.shadowBlur = 14;
      c.beginPath();
      c.ellipse(0, 0, w * 0.72, h * 0.58, 0, 0, Math.PI * 2);
      c.stroke();
      c.restore();
    }

    const grad = c.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2);
    grad.addColorStop(0, c1);
    grad.addColorStop(1, c2);
    c.fillStyle = grad;
    roundRect(c, -w / 2, -h / 2, w, h, w * 0.28);
    c.fill();

    c.fillStyle = 'rgba(15, 23, 42, 0.55)';
    roundRect(c, -w * 0.32, -h * 0.32, w * 0.64, h * 0.22, w * 0.14);
    c.fill();
    roundRect(c, -w * 0.32, h * 0.1, w * 0.64, h * 0.22, w * 0.14);
    c.fill();

    c.fillStyle = 'rgba(255,255,255,0.9)';
    c.fillRect(-w * 0.38, -h * 0.48, w * 0.18, h * 0.05);
    c.fillRect(w * 0.2, -h * 0.48, w * 0.18, h * 0.05);
    c.fillStyle = 'rgba(255,80,80,0.9)';
    c.fillRect(-w * 0.38, h * 0.43, w * 0.18, h * 0.05);
    c.fillRect(w * 0.2, h * 0.43, w * 0.18, h * 0.05);

    c.restore();
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

    // Streetlights scroll at exactly road speed (no wrap-around jump).
    const spacing = cssH / 3;
    const base = roadScroll % spacing;
    for (let y = -spacing + base, i = 0; y < cssH + spacing; y += spacing, i++) {
      for (let side = 0; side < 2; side++) {
        const sy = y + (side === 1 ? spacing / 2 : 0);
        const sx = side === 0 ? roadMargin * 0.5 : cssW - roadMargin * 0.5;
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
    }

    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = Math.max(2, cssW * 0.01);
    const dash = cssH * 0.05;
    ctx.setLineDash([dash, dash]);
    ctx.lineDashOffset = -(roadScroll % (dash * 2));
    for (let lane = 1; lane < LANES; lane++) {
      const x = roadMargin + laneWidth * lane;
      ctx.beginPath();
      ctx.moveTo(x, -dash * 2);
      ctx.lineTo(x, cssH);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Speed streaks fade in as the run gets faster.
    const streakAlpha = state === 'playing' ? Math.max(0, Math.min(0.28, (speed / cssH - 0.55) * 0.45)) : 0;
    if (streakAlpha > 0.01) {
      ctx.strokeStyle = `rgba(255,255,255,${streakAlpha})`;
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      for (const s of streaks) {
        ctx.beginPath();
        ctx.moveTo(s.x, s.y - s.len);
        ctx.lineTo(s.x, s.y);
        ctx.stroke();
      }
      ctx.lineCap = 'butt';
    }

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
    roundRect(ctx, -p.r, -p.r, p.r * 2, p.r * 2, p.r * 0.4);
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

  function drawFloatTexts() {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    for (const t of floatTexts) {
      const p = t.age / t.life;
      ctx.globalAlpha = Math.max(0, 1 - p);
      ctx.font = `800 ${t.size}px sans-serif`;
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(6,10,20,0.55)';
      ctx.strokeText(t.text, t.x, t.y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  }

  function drawCountdown() {
    const step = countdownKind === 'new' ? 0.62 : 0.5;
    const inGo = countdownT >= step * 3;
    const phase = inGo ? Math.min(1, (countdownT - step * 3) / 0.3) : (countdownT % step) / step;
    const label = inGo ? 'GO!' : String(3 - Math.floor(countdownT / step));
    const pop = reducedMotion ? 1 : 1.35 - 0.35 * (1 - Math.pow(1 - Math.min(1, phase * 2.5), 3));
    const alpha = phase < 0.65 ? 1 : Math.max(0, 1 - (phase - 0.65) / 0.35);

    ctx.save();
    ctx.translate(cssW / 2, cssH * 0.38);
    ctx.scale(pop, pop);
    ctx.globalAlpha = alpha;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `900 ${Math.round(cssW * 0.3)}px -apple-system, "Segoe UI", Roboto, sans-serif`;
    ctx.lineWidth = Math.max(4, cssW * 0.015);
    ctx.strokeStyle = 'rgba(6,10,20,0.6)';
    ctx.strokeText(label, 0, 0);
    ctx.fillStyle = inGo ? '#22e08a' : '#ffffff';
    ctx.shadowColor = inGo ? 'rgba(34,224,138,0.8)' : 'rgba(255,255,255,0.5)';
    ctx.shadowBlur = 24;
    ctx.fillText(label, 0, 0);
    ctx.restore();

    if (stats.gamesPlayed === 0 && countdownKind === 'new') {
      const hint = isTouchDevice ? 'Swipe or tap left / right to steer' : 'Use ← → or A / D to steer';
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `700 ${Math.round(Math.max(13, cssW * 0.04))}px -apple-system, "Segoe UI", Roboto, sans-serif`;
      const tw = ctx.measureText(hint).width + 28;
      const th = Math.max(13, cssW * 0.04) + 18;
      ctx.fillStyle = 'rgba(6,10,20,0.62)';
      roundRect(ctx, cssW / 2 - tw / 2, cssH * 0.55 - th / 2, tw, th, th / 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.fillText(hint, cssW / 2, cssH * 0.55);
      ctx.restore();
    }
  }

  function render() {
    if (!roadWidth || !player) return;
    ctx.save();
    if (shakeTime > 0) {
      const m = shakeMag * (shakeTime / 0.35);
      ctx.translate((Math.random() - 0.5) * m, (Math.random() - 0.5) * m);
    }
    drawRoad();
    for (const c of coins) drawCoin(c);
    for (const p of powerUps) drawPowerUp(p);
    for (const o of obstacles) drawCarTo(ctx, o.x, o.y, o.w, o.h, o.c1, o.c2, 0, false);
    if (state !== 'crashing' && state !== 'over') {
      const [c1, c2] = currentSkinColors();
      drawCarTo(ctx, player.x, player.y, player.w, player.h, c1, c2, player.tilt, shieldTime > 0);
    }
    drawParticles();
    drawFloatTexts();
    if (state === 'countdown') drawCountdown();
    if (flashAlpha > 0) {
      ctx.fillStyle = `rgba(255, 209, 102, ${flashAlpha})`;
      ctx.fillRect(0, 0, cssW, cssH);
    }
    ctx.restore();

    const txt = String(Math.floor(score));
    if (txt !== lastScoreText) {
      lastScoreText = txt;
      scoreDisplay.textContent = txt;
    }
    const shielded = shieldTime > 0 && (state === 'playing' || state === 'countdown' || state === 'paused');
    shieldDisplay.classList.toggle('show', shielded);
    if (shielded) shieldDisplay.style.setProperty('--p', Math.max(0, Math.min(1, shieldTime / shieldMax)).toFixed(3));
  }

  // ---------- main loop (always running; behaviour depends on state) ----------
  function frame(time) {
    requestAnimationFrame(frame);
    let dt = (time - lastTime) / 1000;
    lastTime = time;
    if (!(dt > 0)) return;
    dt = Math.min(0.05, dt);
    if (!player) return;
    // A share / install sheet is open: stop animating behind it (saves battery
    // and keeps the card render snappy).
    if (document.body.classList.contains('modal-open')) return;
    switch (state) {
      case 'menu': updateMenu(dt); break;
      case 'countdown': updateCountdown(dt); break;
      case 'playing': update(dt); break;
      case 'crashing': updateCrash(dt); break;
      case 'over': updateOver(dt); break;
      default: return; // paused: the frozen frame is already on screen
    }
    // Game-over screen: once the crash debris has settled there is nothing to repaint.
    if (state === 'over' && !particles.length && !floatTexts.length && shakeTime <= 0 && flashAlpha <= 0) return;
    render();
  }

  // ---------- flow ----------
  function beginRun() {
    ensureAudio();
    hideOverlays();
    resize();
    resetRun();
    countdownKind = 'new';
    countdownT = 0;
    lastCountNum = -1;
    setState('countdown');
    announce('Get ready');
  }

  function beginResume() {
    countdownKind = 'resume';
    countdownT = 0;
    lastCountNum = -1;
    setState('countdown');
  }

  // Ad break before the very first round of a session begins.
  let hasPlayedOnce = false;
  function requestStartGame() {
    ensureAudio();
    if (hasPlayedOnce) { beginRun(); return; }
    startBtn.disabled = true;
    const label = startBtn.textContent;
    startBtn.textContent = 'Loading…';
    const started = requestAd('start', 'start_game', () => {
      startBtn.disabled = false;
      startBtn.textContent = label;
      hasPlayedOnce = true;
      if (state === 'menu') beginRun();
    });
    if (!started) { startBtn.disabled = false; startBtn.textContent = label; }
  }

  // Ad break between rounds ("Play Again").
  function requestNextRound() {
    if (state !== 'over') return;
    ensureAudio();
    retryBtn.disabled = true;
    const started = requestAd('next', 'next_round', () => {
      retryBtn.disabled = false;
      if (state === 'over') beginRun();
    });
    if (!started) retryBtn.disabled = false;
  }

  // Bank score/coins/best for a run the player walks away from (quit, tab
  // closed, app swiped away). commitRun() is delta-safe, so calling it again
  // on a later crash never double counts.
  function bankLiveRun() {
    if (runTime > 1 && (state === 'playing' || state === 'countdown' || state === 'paused')) commitRun();
  }

  function backToMenu() {
    if (adPending) return;
    bankLiveRun();
    pauseBtn.blur();
    showMenu();
  }

  function pauseGame(manual) {
    if (state !== 'playing' && state !== 'countdown') return;
    bankLiveRun();
    pausedManual = !!manual;
    setState('paused');
    showOverlay(pauseOverlay);
    announce('Paused');
  }

  function resumeGame() {
    if (state !== 'paused' || adPending) return;
    const go = () => {
      if (state !== 'paused') return;
      hideOverlays();
      beginResume();
    };
    if (pausedManual) {
      resumeBtn.disabled = true;
      requestAd('pause', 'resume_game', () => {
        resumeBtn.disabled = false;
        go();
      });
    } else {
      go();
    }
  }

  function togglePause() {
    if (state === 'paused') resumeGame();
    else pauseGame(true);
  }

  // Rewarded ad: watch a full ad to revive once and continue the same run.
  function requestRevive() {
    if (reviveUsed || state !== 'over') return;
    reviveBtn.disabled = true;
    reviveBtn.textContent = 'Loading ad…';
    requestAd('reward', 'revive_run', (result) => {
      if (state !== 'over') return;
      if (result === 'viewed') {
        reviveUsed = true;
        revive();
      } else if (result === 'dismissed') {
        reviveUsed = true;
        reviveBtn.classList.add('hidden');
        showToast('📺', 'Ad skipped', 'Watch the full ad to continue your run');
      } else {
        reviveBtn.disabled = false;
        reviveBtn.textContent = '📺 Watch Ad to Continue';
        showToast('📺', 'No ad available', 'Try again in a moment');
      }
    });
  }

  function revive() {
    shieldTime = 2.5;
    shieldMax = 5;
    obstacles = obstacles.filter(o => Math.abs(o.y - player.y) > player.h * 2.2);
    hideOverlays();
    beginResume();
    announce('Continue');
  }

  function moveLane(delta) {
    if (state !== 'playing' && state !== 'countdown') return;
    const next = Math.max(0, Math.min(LANES - 1, player.lane + delta));
    if (next !== player.lane) {
      player.lane = next;
      player.targetX = laneCenterX(player.lane);
      sfxSwitch();
    }
  }

  // ---------- sharing ----------
  function currentShareData(mode) {
    const skin = skinById(selectedSkin);
    const finalScore = Math.floor(score);
    return {
      mode,
      score: mode === 'invite' ? best : finalScore,
      best,
      coins: mode === 'invite' ? stats.coinBank : coinsCollected,
      difficulty,
      skin: { name: skin.name, c1: skin.c1, c2: skin.c2 },
      isNewBest: mode === 'score' && finalScore > bestAtRunStart && finalScore > 0,
      survivalSecs: Math.floor(runTime),
      nearMisses: nearMissCount,
      bestCombo: runBestCombo,
    };
  }

  function shareBaseUrl() {
    const link = document.querySelector('link[rel="canonical"]');
    return link && link.href ? link.href : location.origin + '/';
  }

  // Fallback if share.js failed to load: native share sheet, else copy the link.
  function fallbackShare(mode) {
    const data = currentShareData(mode);
    const text = mode === 'invite' && data.best === 0
      ? 'Try Road Dash — free car dodging game in your browser 🚗💨'
      : `I scored ${data.score.toLocaleString()} on Road Dash 🚗💨 Think you can beat me?`;
    const url = shareBaseUrl();
    if (navigator.share) {
      navigator.share({ title: 'Road Dash', text, url }).catch(() => {});
    } else if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text + ' ' + url).then(() => showToast('🔗', 'Link copied', 'Paste it anywhere to share')).catch(() => {});
    }
  }

  function openShare(mode) {
    if (window.RoadDashShare && typeof window.RoadDashShare.open === 'function') {
      window.RoadDashShare.open(currentShareData(mode));
    } else {
      fallbackShare(mode);
    }
  }

  document.addEventListener('roaddash:shared', () => {
    stats.sharedCount = (stats.sharedCount || 0) + 1;
    if (!stats.shareBonusClaimed) {
      stats.shareBonusClaimed = true;
      stats.coinBank += SHARE_BONUS_COINS;
      showToast('🪙', `+${SHARE_BONUS_COINS} coins`, 'Thanks for sharing Road Dash!');
    }
    checkAchievements();
    updateMenuStats();
  });

  // ---------- input ----------
  const isModalOpen = () => document.body.classList.contains('modal-open');

  document.addEventListener('pointerdown', () => { keyboardNav = false; }, true);

  // Enter / Space starts, retries or resumes when nothing else has focus.
  function primaryAction() {
    const hidden = (el) => el.classList.contains('hidden');
    if (state === 'menu' && !hidden(startOverlay)) startBtn.click();
    else if (state === 'over' && !hidden(gameOverOverlay)) retryBtn.click();
    else if (state === 'paused') resumeBtn.click();
    else return false;
    return true;
  }

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Shift' && e.key !== 'Control' && e.key !== 'Alt' && e.key !== 'Meta') keyboardNav = true;
    if (isModalOpen() || e.ctrlKey || e.metaKey || e.altKey) return;
    const tag = e.target && e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    const k = e.key;
    const driving = state === 'playing' || state === 'countdown' || state === 'crashing' || state === 'paused';
    const bodyFocus = !document.activeElement || document.activeElement === document.body;
    // Space / paging keys must never scroll the page out from under the game.
    if (driving && bodyFocus && (k === ' ' || k === 'PageUp' || k === 'PageDown' || k === 'Home' || k === 'End' || k === 'ArrowUp' || k === 'ArrowDown')) e.preventDefault();
    if ((k === 'Enter' || k === ' ') && bodyFocus) {
      if (!e.repeat && primaryAction()) e.preventDefault();
      return;
    }
    if (k === 'ArrowLeft' || k === 'a' || k === 'A') { moveLane(-1); if (state === 'playing') e.preventDefault(); }
    else if (k === 'ArrowRight' || k === 'd' || k === 'D') { moveLane(1); if (state === 'playing') e.preventDefault(); }
    else if (k === 'p' || k === 'P') { if (!e.repeat) togglePause(); }
    else if (k === 'm' || k === 'M') { toggleSound(); }
    else if (k === 'Escape') {
      if (state === 'playing' || state === 'countdown' || state === 'paused') togglePause();
      else if (!leaderboardOverlay.classList.contains('hidden') || !garageOverlay.classList.contains('hidden') || !achievementsOverlay.classList.contains('hidden')) showOverlay(startOverlay);
    }
  });

  // Touch: steer the moment a swipe passes the threshold (not on finger-up),
  // and treat a quick tap on the left/right half of the road as a lane change.
  let touchX = null, touchY = null, touchMoved = false;
  canvas.addEventListener('touchstart', (e) => {
    const t = e.touches[0];
    touchX = t.clientX;
    touchY = t.clientY;
    touchMoved = false;
  }, { passive: true });
  canvas.addEventListener('touchmove', (e) => {
    if (touchX === null) return;
    const dx = e.touches[0].clientX - touchX;
    if (Math.abs(dx) > 26) {
      moveLane(dx > 0 ? 1 : -1);
      touchX = e.touches[0].clientX;
      touchMoved = true;
    }
  }, { passive: true });
  canvas.addEventListener('touchend', (e) => {
    if (touchX === null) return;
    const t = e.changedTouches[0];
    if (!touchMoved && Math.abs(t.clientX - touchX) < 10 && Math.abs(t.clientY - touchY) < 10) {
      const rect = canvas.getBoundingClientRect();
      moveLane(t.clientX < rect.left + rect.width / 2 ? -1 : 1);
    }
    touchX = null;
  }, { passive: true });
  canvas.addEventListener('touchcancel', () => { touchX = null; }, { passive: true });

  function bindHold(el, fn) {
    el.addEventListener('pointerdown', (e) => { e.preventDefault(); fn(); });
  }
  bindHold(leftBtn, () => moveLane(-1));
  bindHold(rightBtn, () => moveLane(1));

  function toggleSound() {
    soundOn = !soundOn;
    store.set(SOUND_KEY, soundOn ? 'on' : 'off');
    soundBtn.textContent = soundOn ? '🔊' : '🔇';
    soundBtn.setAttribute('aria-label', soundOn ? 'Mute sound' : 'Unmute sound');
    setAdSound();
    if (soundOn) { ensureAudio(); sfxTick(); }
  }

  startBtn.addEventListener('click', requestStartGame);
  retryBtn.addEventListener('click', requestNextRound);
  reviveBtn.addEventListener('click', requestRevive);
  shareBtn.addEventListener('click', () => openShare('score'));
  inviteBtn.addEventListener('click', () => openShare('invite'));
  menuBtn.addEventListener('click', backToMenu);
  quitBtn.addEventListener('click', backToMenu);
  pauseBtn.addEventListener('click', () => { pauseGame(true); });
  resumeBtn.addEventListener('click', resumeGame);
  soundBtn.addEventListener('click', toggleSound);

  themeBtn.addEventListener('click', () => {
    theme = theme === 'day' ? 'night' : 'day';
    store.set(THEME_KEY, theme);
    applyTheme();
  });

  difficultyRow.addEventListener('click', (e) => {
    const btn = e.target.closest('.diff-btn');
    if (!btn) return;
    difficulty = btn.dataset.diff;
    store.set(DIFF_KEY, difficulty);
    [...difficultyRow.children].forEach(b => {
      const on = b === btn;
      b.classList.toggle('active', on);
      b.setAttribute('aria-checked', String(on));
    });
  });

  $('showLeaderboardBtn').addEventListener('click', () => { renderLeaderboard(); showOverlay(leaderboardOverlay); });
  $('closeLeaderboardBtn').addEventListener('click', () => showOverlay(startOverlay));
  $('showGarageBtn').addEventListener('click', () => { renderGarage(); showOverlay(garageOverlay); });
  $('closeGarageBtn').addEventListener('click', () => showOverlay(startOverlay));
  $('showAchievementsBtn').addEventListener('click', () => { renderAchievements(); showOverlay(achievementsOverlay); });
  $('closeAchievementsBtn').addEventListener('click', () => showOverlay(startOverlay));

  // Switching tabs / locking the phone auto-pauses (no ad break on resume —
  // only a deliberate pause earns one).
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pauseGame(false);
  });
  window.addEventListener('pagehide', () => pauseGame(false));
  new MutationObserver(() => {
    if (document.body.classList.contains('modal-open')) pauseGame(false);
  }).observe(document.body, { attributes: true, attributeFilter: ['class'] });

  if (typeof ResizeObserver === 'function') {
    new ResizeObserver(() => resize()).observe(canvas);
  }
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 200));

  // ---------- init ----------
  detectTouch();
  loadBest();
  loadSound();
  loadTheme();
  loadDifficulty();
  loadStats();
  applyDailyStreak();
  if (window.RoadDashShare && typeof window.RoadDashShare.getChallenge === 'function') {
    try { challenge = window.RoadDashShare.getChallenge(); } catch (e) { challenge = null; }
  }
  setAdSound();
  resize();
  resetScene();
  showMenu();
  lastTime = performance.now();
  requestAnimationFrame(frame);
})();
