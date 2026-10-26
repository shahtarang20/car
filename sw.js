/* Road Dash service worker.
 *
 * Goals: installable + works offline, but never serve stale game code for long.
 *
 * Strategy
 *  - Only same-origin GET requests are handled. Everything cross-origin
 *    (AdSense, Google scripts, analytics, ad creatives) goes straight to the
 *    network untouched. Range requests are ignored too.
 *  - Navigations: network-first with a ~3 s timeout, falling back to the cache
 *    (ignoring the query string so "/?s=123&n=Bob" and "/?source=pwa" work
 *    offline), and finally to the cached "/index.html".
 *  - Static assets (js/css/png/svg/json/...): network-first with a short
 *    timeout, then cache. We deploy often and a stale game.js is a worse bug
 *    than a few extra milliseconds, so fresh code always wins when the network
 *    is reachable; the cache only matters when offline or very slow.
 *  - Only 200 "basic" responses are written to the cache.
 *  - sw.js itself is never cached by us (and is served must-revalidate).
 */
'use strict';

const CACHE_VERSION = 'roaddash-v2';
const NAV_TIMEOUT_MS = 3000;
const ASSET_TIMEOUT_MS = 2500;

const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/game.js',
  '/share.js',
  '/install.js',
  '/privacy',
  '/privacy.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
  '/icons/apple-touch-icon.png',
  '/icons/favicon-32.png',
  '/icons/icon.svg',
  '/og-image.png'
];

// ---- install: precache each URL on its own so one 404 never aborts install --
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) =>
      Promise.all(
        PRECACHE_URLS.map((url) =>
          // cache:'reload' bypasses the HTTP cache so we precache fresh files.
          fetch(new Request(url, { cache: 'reload' }))
            .then((res) => (isCacheable(res) ? stripRedirect(res).then((clean) => cache.put(url, clean)) : null))
            .catch(() => null)
        )
      )
    ).then(() => self.skipWaiting())
  );
});

// ---- activate: drop old caches, take control, enable navigation preload ----
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)));
    } catch (e) { /* ignore */ }
    try {
      if (self.registration.navigationPreload) await self.registration.navigationPreload.enable();
    } catch (e) { /* optional feature */ }
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

// ---- fetch ------------------------------------------------------------------
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  if (req.headers.has('range')) return;

  let url;
  try { url = new URL(req.url); } catch (e) { return; }
  if (url.origin !== self.location.origin) return;       // never touch cross-origin
  if (url.pathname === '/sw.js') return;                 // never cache ourselves

  if (req.mode === 'navigate') {
    event.respondWith(handleNavigation(event));
  } else {
    event.respondWith(handleAsset(req));
  }
});

// With cleanUrls, '/index.html' and '/privacy.html' answer 308. A cached
// response flagged `redirected` can't be served to a navigation (WebKit
// rejects it), so rebuild it as a plain 200 before storing.
function stripRedirect(res) {
  if (!res.redirected) return Promise.resolve(res);
  return res.blob().then((body) => new Response(body, { status: 200, statusText: 'OK', headers: res.headers }));
}

function isCacheable(res) {
  return !!res && res.status === 200 && res.type === 'basic';
}

/** Resolve with the fetch promise, or reject if it takes longer than ms. */
function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then((v) => { clearTimeout(t); resolve(v); },
                 (e) => { clearTimeout(t); reject(e); });
  });
}

function putInCache(req, res) {
  if (!isCacheable(res)) return;
  const copy = res.clone();
  caches.open(CACHE_VERSION).then((c) => c.put(req, copy)).catch(() => {});
}

async function handleNavigation(event) {
  const req = event.request;
  const network = (async () => {
    const preloaded = event.preloadResponse ? await event.preloadResponse : undefined;
    return preloaded || fetch(req);
  })();
  // If the timeout wins, let the real request finish in the background so the
  // cache still gets refreshed.
  network.then((res) => {
    if (isCacheable(res)) {
      const u = new URL(req.url);
      // Cache under the bare path so every "?query" variant shares one entry.
      putInCache(new Request(u.origin + u.pathname), res);
    }
  }, () => {});

  try {
    const res = await withTimeout(network.then((r) => r.clone()), NAV_TIMEOUT_MS);
    // Serve real HTTP errors (e.g. 404 page) as-is; only fall back on failure.
    return res;
  } catch (e) {
    const cache = await caches.open(CACHE_VERSION);
    return (
      (await cache.match(req, { ignoreSearch: true })) ||
      (await cache.match('/index.html')) ||
      (await cache.match('/')) ||
      new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } })
    );
  }
}

async function handleAsset(req) {
  try {
    const res = await withTimeout(fetch(req), ASSET_TIMEOUT_MS);
    putInCache(req, res);
    return res;
  } catch (e) {
    const cache = await caches.open(CACHE_VERSION);
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    // Slow (not offline) and nothing cached: wait for the network after all.
    try { return await fetch(req); } catch (err) { return Response.error(); }
  }
}
