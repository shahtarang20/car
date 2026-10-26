# Road Dash

A simple browser car-dodging game, built with plain HTML/CSS/JS (no build step), ready to deploy on Vercel and monetize with Google AdSense.

## Run locally

Just open `index.html` in a browser, or serve it:

```
npx serve .
```

## Deploy to Vercel

1. Push this repo to GitHub.
2. Go to https://vercel.com/new and import the repo.
3. Framework preset: "Other" (static site) — no build command needed, output directory is the repo root.
4. Deploy. You'll get a `*.vercel.app` URL.
5. (Optional) Add a custom domain in the Vercel dashboard.

## Enable Google AdSense

Your AdSense account (`pub-5841910105267784`) is approved and already wired into this repo:
- `index.html`'s `<script>` tag in `<head>` loads `ca-pub-5841910105267784`.
- `ads.txt` at the site root already has the correct line.

What's still left to do:

1. **Create display ad units.** In the AdSense dashboard: Ads → By ad unit → Display ads → create one (or more). Copy each unit's `data-ad-slot` value.
2. ~~Paste the slot IDs in~~ — done: `RoadDash-Left` (3035911114) and `RoadDash-Right` (7843842676) are in the two `.ad-slot` blocks in `index.html`.
3. **Enable Ad break settings** (for the in-game ad breaks in `game.js`): AdSense → Ads → By site → your site (`game-roan-mu.vercel.app`) → turn on "Ad break settings". Without this, `adBreak()` calls just fall through to their fallback and the game still works, but you won't see real ads from those breaks.
4. **Deploy** — Vercel picks up the change automatically once pushed.
5. It can take Google a few hours up to ~1 day after enabling ad units/breaks before ads actually start rendering on a fresh site — this is normal.
6. A Privacy Policy page (`privacy.html`) is included and linked from the footer. Add a contact email to it if you want one listed.
7. **EEA/UK/Switzerland consent:** Google requires a consent message (CMP) for personalised ads there. Turn on Google's free one in AdSense → Privacy & messaging → European regulations message, and publish it — no code change needed, it loads via the AdSense script already in `index.html`.
8. Display-ad slots stay invisible until Google actually fills them (no empty boxes). New ad units can take a few hours to start filling. In AdSense → Ads → By site, switch **Auto ads OFF** for this site so Google doesn't also place ads over the game.

## Ad breaks (more ad impressions, the compliant way)

This game uses Google's **Ad Placement API for HTML5 games** (`window.adBreak(...)` in `game.js`), which is the officially supported way to show interstitial and rewarded ads inside a browser game — see https://developers.google.com/ad-placement. It's part of AdSense, not a separate account.

Ad breaks are wired in at 4 points:
- **`start`** — before the first round of a session begins.
- **`next`** — every time the player taps "Play Again".
- **`pause`** — when resuming from a pause the player chose (auto-pauses from switching tabs resume without an ad).
- **`reward`** — the "📺 Watch Ad to Continue" button on the game-over screen; grants a one-time revive per run only if the player actually finishes watching (`adViewed`).

Important setup notes:
- **You must opt in.** Ad Placement API ad breaks won't show anything until you enable "Ad break settings" for your site in the AdSense dashboard (Ads → By site → your domain). Until then, `requestAd()` just falls through after ~3.5 seconds (instantly if an ad blocker stopped the script) and the game continues normally — nothing breaks, you just won't see real ads yet.
- **Don't fake or force clicks.** The revive button rewards for *watching* a full ad (`adViewed`), never for clicking it — this matches AdSense policy. Do not change this to reward on `adDismissed`.
- **Frequency capping is handled by Google**, not by this code — the API automatically limits how often ad breaks actually serve an ad, so it's safe to call it at every one of these points without manually throttling.
- `requestAd(type, name, onResult)` always calls `onResult('viewed' | 'dismissed' | 'unavailable')` exactly once. While a real ad is on screen it waits for Google's completion callback (no short timeout), so long ads and rewarded videos can't strand the game or lose the revive.
- If you want fewer ad breaks, just remove the corresponding `requestAd(...)` call in `game.js` (e.g. the `pause` one in `resumeGame`) and call the continuation function directly instead.

## SEO

The code side is done: title/meta description tuned for search intent, Open Graph + Twitter card tags, `VideoGame` and `FAQPage` structured data (JSON-LD), a canonical URL, `robots.txt`, `sitemap.xml`, `manifest.json`, and a real crawlable text section (About / How to play / Features / FAQ) below the game — a canvas-only game has almost no indexable text otherwise, which is why that section exists.

**There is no code change that guarantees a #1 ranking.** Google also weighs backlinks, domain age/authority, competition for the keywords, and real user engagement (time on page, return visits) — none of which can be set in a file. What's below is everything that actually is in your control:

What's still left to do (all outside the codebase):

1. ~~Add a real og-image~~ — done: `og-image.png` (1200×630, under 250 KB so WhatsApp shows it) is the card people see when a Road Dash link is shared.
2. **Get a custom domain.** A `*.vercel.app` subdomain shares reputation with every other Vercel project on that domain and looks less trustworthy to both users and Google. Buy a short, keyword-relevant domain (e.g. `roaddashgame.com`) and add it in Vercel → Domains — this alone meaningfully helps.
3. **Submit to Google Search Console** (https://search.google.com/search-console): verify the domain, then submit `https://yourdomain.com/sitemap.xml` so Google actually crawls it instead of waiting to discover it.
4. **Update the domain everywhere.** `robots.txt`, `sitemap.xml`, and the canonical/`og:url` tags in `index.html` currently point at `car-two-wheat.vercel.app` — update all of them to your final custom domain once you have one.
5. **Get backlinks.** Share the game on relevant forums, Reddit (r/WebGames, r/incremental_games, etc.), Product Hunt, itch.io, or game-listing directories. Inbound links from other sites are one of the strongest ranking signals and nothing in the code can substitute for them.
6. **Keep it fast.** The site is already a lightweight static page (no framework, no build step) — that's good for Core Web Vitals, which Google uses as a ranking factor. Avoid adding heavy dependencies later.

## Install as an app (PWA)

Road Dash is an installable, offline-capable web app:

- `manifest.json` + `icons/` — name, colors, standalone display, maskable icons, "Play now" shortcut.
- `sw.js` — service worker: caches the game shell (network-first, so new deploys show up immediately; cache is the offline fallback). It never touches Google ad requests.
- `install.js` — registers the service worker and powers every `[data-install-btn]` button: native install prompt on Chrome/Edge/Android, step-by-step "Add to Home Screen" help on iPhone/iPad Safari, "open in your browser" help inside the Instagram/Facebook in-app browsers. After a player's 2nd run it also shows a small dismissible install banner (never more than once a session, then 7 days apart).
- `vercel.json` sets the cache headers the service worker needs (`sw.js` must never be cached).

Installability requires HTTPS — Vercel provides that. Test with Chrome DevTools → Application → Manifest.

## Sharing scores (WhatsApp, Instagram, Facebook…)

`share.js` draws a 1080×1350 score card (your car skin, score, coins, difficulty, "New best" ribbon) on a canvas and opens a share sheet:

- **Share / More** — the phone's native share sheet with the card **image attached** (this is how it reaches Instagram Stories/Feed, WhatsApp, Messenger, etc.).
- **WhatsApp / Facebook / X / Telegram** — opens that app's share URL with text + link.
- **Instagram** has no web share URL, so it uses the native share sheet when available; otherwise the card is saved and the player gets an "Open Instagram" button.
- **Copy link / Save card** — always available.

Every shared link looks like `https://yourdomain/?s=1234&n=Name&utm_source=share&utm_medium=whatsapp`. Friends who open it see a "Name scored 1,234 — can you beat it?" banner, and the game tells them when they beat it. The **rich link preview** (the card WhatsApp/Facebook/Telegram render for a link) comes from the `og:*` meta tags + `og-image.png` in `index.html`. Sharing for the first time gives a one-off 50-coin bonus and the "Social Driver" achievement.

Note: link previews are the same static image for everyone (the personalised card travels as the attached image). A per-score preview image would need a serverless function that renders PNGs — possible later, intentionally not added so the project stays build-free.

Share URLs use the `<link rel="canonical">` in `index.html` as the site address — change that one tag when you move to a custom domain (plus `og:url`, `og:image`, `twitter:image`, `robots.txt`, `sitemap.xml`, and the JSON-LD URLs).

## Game controls

- Desktop: Arrow keys or A/D to switch lanes, P / Esc to pause, M to mute.
- Mobile: swipe or tap the left/right side of the road (or use the on-screen arrows).

## Customizing

- Difficulty ramp, spawn rate, and colors are all in `game.js`.
- Canvas size is 360x600 by default; increase for a bigger playing field on desktop.
