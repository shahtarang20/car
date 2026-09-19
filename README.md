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

1. Apply for AdSense at https://www.google.com/adsense with your live Vercel URL. Your site needs some real traffic/content history before Google usually approves it — a single-page game may need extra content (about page, privacy policy) to get approved.
2. Once approved, get your publisher ID (`ca-pub-XXXXXXXXXXXXXXXX`).
3. In `index.html`, replace `ca-pub-XXXXXXXXXXXXXXXX` in the `<script>` tag in `<head>` with your real ID.
4. Create ad units in the AdSense dashboard, and replace the `.ad-slot` placeholder `<div>`s with the `<ins class="adsbygoogle">` snippet AdSense gives you, e.g.:

```html
<ins class="adsbygoogle"
     style="display:block"
     data-ad-client="ca-pub-XXXXXXXXXXXXXXXX"
     data-ad-slot="YOUR_AD_SLOT_ID"
     data-ad-format="auto"
     data-full-width-responsive="true"></ins>
<script>(adsbygoogle = window.adsbygoogle || []).push({});</script>
```

5. Add an `ads.txt` file at the site root once AdSense gives you the exact line, e.g.:

```
google.com, pub-XXXXXXXXXXXXXXXX, DIRECT, f08c47fec0942fa0
```

6. AdSense also usually requires a Privacy Policy page — add a simple `privacy.html` linking data usage/cookies if you want faster approval.

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
