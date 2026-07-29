# Atmos Weather v3 — Real-Time Forecasts, AI Insights & Glassmorphic Dashboard

**Atmos Weather by Devron Group** is a next-generation, interactive web application delivering high-precision weather forecasts, live precipitation radar maps, outdoor activity indices, Gemini AI recommendations, and seamless account persistence—wrapped in a high-contrast glassmorphic design.

---

## 🌟 What's New in Version 3.0

### 🔐 Persistent User Session & Profile Management
- **Automatic Login Persistence**: Uses local state caching alongside Firebase Auth to maintain user sessions across browser reloads. You stay logged in automatically without repetitive auth prompts.
- **Topbar User Profile Widget**: Real-time display of user display name and custom avatar in the main navigation bar.
- **Account Profile Modal**: Detailed account drawer showing Google OAuth details, sign-in method, email address, active session status, and a one-click **Sign Out & Clear Session** trigger.

### 🖼️ Landscape Intro & Authentication Flow
- **Landscape Get Started Hero**: Re-architected intro card featuring a clean, dual-column landscape glass layout (`max-width: 680px`) designed to showcase rich dynamic background wallpapers without screen obstruction.
- **Sleek Login View**: Cleaned authentication modal eliminating clutter and non-functional navigation elements.
- **Automatic Welcome Dispatch**: Integrated serverless API route (`/api/send-welcome-email`) to dispatch personalized confirmation messages upon sign in.

### ✨ Atmospheric Loading & Smooth Transitions
- **Glassmorphic Calibration Screen**: High-blur centered glass card (`backdrop-filter: blur(32px) saturate(180%)`) displaying real-time progress fills, satellite connectivity status, and system calibration steps.
- **Silky Smooth Homepage Reveal**: The active weather canvas seamlessly unblurs and fades in under the glass loader when calibration completes.

### 🗺️ Dynamic Radar & Weather Visuals
- **Interactive RainViewer Radar**: Embedded Leaflet.js interactive precipitation radar with live tile caching and zoom controls.
- **Canvas Weather Particles**: Real-time canvas particle overlay rendering rain, snow, night-time starfields, and storm lightning flashes (with toggle in Settings and reduced-motion respect).
- **Time-of-Day Adaptive Themes**: Crossfading atmospheric canvas matching weather condition (clear, clouds, rain, snow, fog, thunderstorm) and local solar status (day, golden hour, night).

---

## 🚀 Key Features

- 🌤️ **Real-time Weather & Forecasts**: Hourly timeline (+1h, +3h, +6h, +12h, Tomorrow) and 7-day extended forecasts powered by Open-Meteo APIs.
- 🤖 **Gemini AI Weather Assistant**: Conversational AI recommendations for clothing, outdoor planning, cycling, running, and travel advice with voice input & text-to-speech support.
- 💨 **Air Quality Index (AQI) & Environmental Metrics**: In-depth monitoring for PM2.5, PM10, UV Index, humidity, barometric pressure, dew point, and wind vectors.
- 🏃 **Outdoor Activity Suitability**: Dynamic scoring for running, cycling, stargazing, photography, and drone flight based on wind, visibility, and precipitation.
- ⚡ **Severe Weather Banners**: Instant warnings for thunderstorms, gale-force winds, intense UV radiation, heatwaves, and dense fog.
- 📱 **Progressive Web App (PWA)**: Complete offline shell caching via `sw.js` and `manifest.json` for "Add to Home Screen" installation on iOS, Android, and Desktop.
- ⌨️ **Keyboard Accessibility**: Full shortcut support (`/` to search, `U` to switch units, `M` for radar map, `A` for AI assistant, `S` for settings, `?` for shortcuts list).

---

## 🛠️ Tech Stack & Integrations

| Layer | Technology / Source |
| :--- | :--- |
| **Frontend Framework** | Pure Modular ES6 JavaScript, HTML5, CSS3 Glassmorphism |
| **Auth & Database** | Firebase Authentication & Cloud Firestore (`ai-studio-atmosweather`) |
| **Serverless Email** | Vercel Node.js Function (`/api/send-welcome-email.js`) via Nodemailer |
| **Weather & Geocoding** | [Open-Meteo API](https://open-meteo.com/) & BigDataCloud Reverse Geocoding |
| **Radar & Maps** | [Leaflet.js](https://leafletjs.com/) + OpenStreetMap + [RainViewer Tile Cache](https://www.rainviewer.com/api.html) |
| **AI Assistant** | Google Gemini API / Natural Rule Engine with Web Speech API |

---

## 🎹 Keyboard Shortcuts

| Key | Action |
| :---: | :--- |
| `/` | Focus search bar to query a new city |
| `U` | Toggle temperature units (°C / °F) |
| `M` | Open live weather radar map modal |
| `A` | Launch Gemini AI Weather Assistant |
| `S` | Open Settings panel |
| `?` | Open Keyboard Shortcuts guide |
| `Esc` | Close any active modal or overlay |

---

## 📁 File Structure

```
/
├── index.html                  # Core HTML structure & modal definitions
├── style.css                   # Glassmorphism, landscape layouts & CSS variables
├── script.js                   # Application state, weather fetchers, auth & session persistence
├── sw.js                       # Service worker for PWA offline shell caching
├── manifest.json               # Progressive Web App metadata
├── vercel.json                 # Vercel serverless API routing config
├── metadata.json               # Applet configuration & metadata
├── firebase-applet-config.json # Provisioned Firebase credentials
├── api/
│   └── send-welcome-email.js   # Serverless email dispatch handler
└── assets/
    ├── atmos_logo.svg          # Official Atmos Weather vector logo
    ├── background.jpg          # High-resolution hero wallpaper
    ├── favicon.png             # Site favicon
    ├── icon-192.png            # PWA launcher icon (192x192)
    └── icon-512.png            # PWA launcher icon (512x512)
```

---

## 💻 Local Development & Deployment

### Run Locally
You can serve the static directory with any web server:

```bash
# Using Node.js npx serve
npx serve .

# Or using Python 3
python3 -m http.server 3000
```

Open `http://localhost:3000` in your web browser.

### Production Deployment
Atmos v3 is configured for zero-config static hosting or Vercel deployment. When deploying to Vercel or Cloud Run, environment variables (e.g., `GMAIL_USER`, `GMAIL_PASS`) can be added for live email dispatching.

---

## 📜 License & Credits

Developed by **Devron Group** • Built with Google AI Studio & Open Source APIs.
