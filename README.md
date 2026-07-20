# Atmos — a frontend-only weather dashboard

No backend, no build step, no API key. Just static files.

## What it does
- **Search any city** — Open-Meteo's free geocoding API, live suggestions as you type
- **Current conditions** — temperature, "feels like," humidity, wind, UV index, precipitation chance
- **Sunrise / sunset**
- **Air quality (US AQI)**
- **Hourly strip** for the selected day
- **7-day forecast** with tabs — tap a day to see its hero condition, description, and hours
- **Use my location** (`navigator.geolocation` + free reverse geocoding, no key)
- **°C / °F + km/h / mph toggle**
- **Saved cities** — add/remove favourites, each shows a live temperature; stored in `localStorage`
- **Last city and unit remembered** between visits (`localStorage`, nothing leaves your browser except the direct calls to Open-Meteo)
- Background tint subtly shifts with the current condition (clear / cloudy / rain / storm / snow / fog)
- Loading screen, responsive down to mobile, reduced-motion respected

## Data sources (all free, no key required)
- `geocoding-api.open-meteo.com` — city search
- `api.open-meteo.com` — forecast (current + hourly + daily)
- `air-quality-api.open-meteo.com` — AQI
- `api.bigdatacloud.net` (reverse-geocode-client) — turns your coordinates into a city name after "Use my location"

## Run locally
No build tools needed — it's plain HTML/CSS/JS.
```bash
npx serve .
# or
python3 -m http.server 8000
```
Then open the printed URL.

## Deploy to Vercel
**Option A — CLI**
```bash
npm i -g vercel
vercel
```
Accept the defaults — Vercel auto-detects a static site (no framework, no build command needed).

**Option B — Dashboard**
1. Push this folder to a GitHub repo (or drag-and-drop the folder at vercel.com/new).
2. Import the repo in Vercel.
3. Framework preset: **Other** / **Static**. Leave build command empty, output directory `.`.
4. Deploy.

That's it — every API call happens from the visitor's browser, so there's nothing to configure, no environment variables, no server to keep running.

## File structure
```
atmos/
├── index.html
├── style.css
├── script.js
├── vercel.json
└── assets/
    ├── background.jpg   (your mountain/meadow photo)
    ├── logo.jpg          (your Atmos wordmark)
    └── favicon.png
```
