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
2. **Paste the slot IDs in.** In `index.html`, find the two `.ad-slot` blocks (search `YOUR_AD_SLOT_ID`) and replace them with your real slot IDs.
3. **Enable Ad break settings** (for the in-game ad breaks in `game.js`): AdSense → Ads → By site → your site (`game-roan-mu.vercel.app`) → turn on "Ad break settings". Without this, `adBreak()` calls just fall through to their fallback and the game still works, but you won't see real ads from those breaks.
4. **Deploy** — Vercel picks up the change automatically once pushed.
5. It can take Google a few hours up to ~1 day after enabling ad units/breaks before ads actually start rendering on a fresh site — this is normal.
6. AdSense also usually wants a visible Privacy Policy — add a simple `privacy.html` linking data/cookie usage if you haven't already, and link it from the footer.

## Ad breaks (more ad impressions, the compliant way)

This game uses Google's **Ad Placement API for HTML5 games** (`window.adBreak(...)` in `game.js`), which is the officially supported way to show interstitial and rewarded ads inside a browser game — see https://developers.google.com/ad-placement. It's part of AdSense, not a separate account.

Ad breaks are wired in at 4 points:
- **`start`** — before the first round of a session begins.
- **`next`** — every time the player taps "Play Again".
- **`pause`** — when resuming from the pause menu.
- **`reward`** — the "📺 Watch Ad to Continue" button on the game-over screen; grants a one-time revive per run only if the player actually finishes watching (`adViewed`).

Important setup notes:
- **You must opt in.** Ad Placement API ad breaks won't show anything until you enable "Ad break settings" for your site in the AdSense dashboard (Ads → By site → your domain). Until then, `requestAd()` just falls through to its fallback after 4 seconds and the game continues normally — nothing breaks, you just won't see real ads yet.
- **Don't fake or force clicks.** The revive button rewards for *watching* a full ad (`adViewed`), never for clicking it — this matches AdSense policy. Do not change this to reward on `adDismissed`.
- **Frequency capping is handled by Google**, not by this code — the API automatically limits how often ad breaks actually serve an ad, so it's safe to call it at every one of these points without manually throttling.
- If you want fewer ad breaks, just remove the corresponding `requestAd(...)` call in `game.js` (e.g. drop the `pause` one in `togglePause`) and call the continuation function directly instead.

## Game controls

- Desktop: Arrow keys or A/D to switch lanes.
- Mobile: swipe left/right on the canvas.

## Customizing

- Difficulty ramp, spawn rate, and colors are all in `game.js`.
- Canvas size is 360x600 by default; increase for a bigger playing field on desktop.
