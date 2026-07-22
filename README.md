# Atmos v2 — a premium, frontend-only weather dashboard

Still no backend, no build step, no API key. Everything below runs
directly in the visitor's browser.

## What's new in this version
- **Dynamic weather + time-of-day backgrounds** — crossfades based on
  condition (clear/cloudy/rain/storm/snow/fog/etc.) and day/night.
  Drop your own photos into `assets/weather/` (see the README in
  that folder for exact filenames) — until you do, it gracefully
  falls back to your original background photo with an animated tint.
- **Canvas particles** — rain, snow, twinkling stars at night, and
  lightning flashes during storms. Toggle off in Settings.
- **3D tilt** on cards (mouse-follow), holographic glowing borders,
  glass panels with adjustable blur.
- **Proper modal system** — Settings, Air Quality, Weather Map,
  Compare Cities, About/Changelog, Keyboard Shortcuts — no browser
  alert boxes anywhere.
- **AI Weather Assistant** (bottom-right button, or press `A`) — rule-based
  today, answering questions about clothing, travel, workouts, running,
  cycling, farming, hydration, UV, and rain, in English or Hindi. Speaks
  replies aloud (Web Speech API) and accepts voice questions where the
  browser supports it (Chrome/Edge). See the big comment above
  `getAIResponse()` in `script.js` for exactly how to wire in a real
  API (OpenAI/Gemini/Claude) later.
- **Live weather map** — Leaflet + OpenStreetMap + a free live
  precipitation radar layer (RainViewer), opened lazily so it doesn't
  slow down the main dashboard.
- **Full air quality panel** — AQI, PM2.5, PM10, pressure, wind
  direction, UV, feels-like, all colour-coded.
- **Weather alerts** — auto-generated banner chips for storms, heavy
  rain, fog, snow, strong wind, heatwave, high UV.
- **Animated timeline** (Now / +1h / +3h / +6h / +12h / Tomorrow / 7 Days).
- **Sunrise/sunset progress ring** + a real moon-phase indicator
  (calculated locally, no API needed).
- **Recent searches**, alongside your existing saved cities.
- **Settings panel** — units, wind units, assistant language,
  animations on/off, tilt on/off, background overlay intensity, glass
  blur, font size — all saved to `localStorage`.
- **Keyboard shortcuts**: `/` search, `U` units, `M` map, `A` assistant,
  `S` settings, `?` shortcuts list, `Esc` closes anything open.
- **PWA-ready** — `manifest.json` + `sw.js` let people "Add to Home
  Screen" and keep the app shell (not live data) available offline.
- Accessibility: `aria-label`s throughout, `prefers-reduced-motion`
  fully respected (disables particles/animations), focus-manageable
  modals, keyboard-operable everywhere.

## Honest list of what's simplified (by design, not by accident)
- **AI assistant is rule-based**, not a real LLM — wiring in a real one
  from a pure static site means shipping your API key to every visitor's
  browser, which isn't safe for a public deploy. The code is structured
  so swapping in a real API later is a one-function change (see the
  comment block in `script.js`), ideally behind a small serverless
  proxy so the key stays private.
- **Weather map** shows a live precipitation radar layer (free, no key).
  Temperature/wind/cloud *map overlays* generally require a paid tile
  provider (e.g. OpenWeatherMap with a key) — happy to wire that in if
  you get a free-tier key later.
- **"Rotating 3D Earth" / full 3D globe** was scoped down to the 3D
  card-tilt + holographic effects — a real WebGL globe (three.js) is a
  reasonable next addition if you want it, it's just a substantial
  separate feature.
- **PDF export / share-as-image / screenshot button** aren't in yet —
  next on the list if you want them; they're addable without a backend
  (jsPDF + canvas), just kept out of this pass to avoid bloating an
  already large update.
- Historical weather isn't wired in — Open-Meteo does have a free
  historical/archive API, so it's addable later.

## Data & library sources (all free, no key required)
- `geocoding-api.open-meteo.com` — city search
- `api.open-meteo.com` — forecast (current + hourly + daily)
- `air-quality-api.open-meteo.com` — AQI, PM2.5, PM10
- `api.bigdatacloud.net` — reverse geocoding for "use my location"
- `tile.openstreetmap.org` + `tilecache.rainviewer.com` — map + radar
- `cdnjs.cloudflare.com` — Leaflet.js (map library) and Google Fonts

## Run locally
```bash
npx serve .
# or
python3 -m http.server 8000
```

## Deploy — same as before
Since you're uploading straight to GitHub: unzip this, make sure
`index.html` sits at your repo's top level (not inside a subfolder),
upload everything (including the `assets` folder and its `weather`
subfolder), commit, and Vercel auto-redeploys from the existing
import — no new project needed, no Root Directory change needed.

## File structure
```
index.html
style.css
script.js
manifest.json
sw.js
vercel.json
assets/
  background.jpg
  logo.jpg
  favicon.png
  icon-192.png
  icon-512.png
  weather/
    README.md   ← naming convention for your future weather photos
```
