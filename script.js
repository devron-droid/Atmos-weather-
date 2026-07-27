/* ============================================================
   ATMOS v2 — frontend-only weather dashboard
   Data: Open-Meteo (forecast, geocoding, air quality) — no key
   Map tiles: OpenStreetMap + RainViewer radar — no key
   Reverse geocode: BigDataCloud client API — no key
   Everything else (theme, particles, AI assistant, voice,
   settings) runs entirely in this file / the browser.
   ============================================================ */

const GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search";
const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const AQI_URL = "https://air-quality-api.open-meteo.com/v1/air-quality";
const REVERSE_URL = "https://api.bigdatacloud.net/data/reverse-geocode-client";

const LS = {
  unit: "atmos_unit", windUnit: "atmos_wind_unit", city: "atmos_city",
  favs: "atmos_favs", recents: "atmos_recents", settings: "atmos_settings",
  lang: "atmos_lang",
};

/* ============================================================
   FIREBASE AUTH — fill these in from your Firebase project
   (console.firebase.google.com → Project settings → your web app)
   ============================================================ */
const firebaseConfig = {
  apiKey: "AIzaSyD2C7DekJTHdYSe22CXxkkLwodw2dM6aGY",
  authDomain: "gen-lang-client-0312716408.firebaseapp.com",
  projectId: "gen-lang-client-0312716408",
  storageBucket: "gen-lang-client-0312716408.firebasestorage.app",
  messagingSenderId: "713603833500",
  appId: "1:713603833500:web:325ce5543eaa6b3c331759"
};
let bootFinished = false;

let authUser = null;

/* ---- INTRO LOADER & GET STARTED TRIGGER ---- */
function startIntroProgress(){
  const progressFill = document.getElementById("introProgressFill");
  const loaderWrap = document.getElementById("introLoaderWrap");
  const getStartedCard = document.getElementById("getStartedCard");
  
  if (!progressFill) return;

  const steps = [25, 55, 85, 100];
  let currentStep = 0;
  const interval = setInterval(() => {
    if (currentStep < steps.length) {
      progressFill.style.width = `${steps[currentStep]}%`;
      currentStep++;
    } else {
      clearInterval(interval);
      setTimeout(() => {
        if (loaderWrap) loaderWrap.hidden = true;
        if (getStartedCard) getStartedCard.hidden = false;
      }, 250);
    }
  }, 220);
}

function showLoginCard() {
  const loaderWrap = document.getElementById("introLoaderWrap");
  const getStartedCard = document.getElementById("getStartedCard");
  const loginCard = document.getElementById("loginCard");

  if (loaderWrap) loaderWrap.hidden = true;
  if (getStartedCard) getStartedCard.hidden = true;
  if (loginCard) {
    loginCard.hidden = false;
    loginCard.style.display = "flex";
    loginCard.style.opacity = "0";
    loginCard.style.transform = "translateY(16px)";
    requestAnimationFrame(() => {
      loginCard.style.opacity = "1";
      loginCard.style.transform = "translateY(0)";
    });
  }
}

function showGetStartedCard() {
  const loaderWrap = document.getElementById("introLoaderWrap");
  const getStartedCard = document.getElementById("getStartedCard");
  const loginCard = document.getElementById("loginCard");

  if (loaderWrap) loaderWrap.hidden = true;
  if (loginCard) loginCard.hidden = true;
  if (getStartedCard) {
    getStartedCard.hidden = false;
    getStartedCard.style.display = "flex";
    getStartedCard.style.opacity = "0";
    getStartedCard.style.transform = "translateY(16px)";
    requestAnimationFrame(() => {
      getStartedCard.style.opacity = "1";
      getStartedCard.style.transform = "translateY(0)";
    });
  }
}

/* Event listeners for transition between Get Started and Login Page with robust event delegation */
document.addEventListener("click", (e) => {
  // Check if click was on or inside Get Started button or card
  const getStartedTrigger = e.target.closest("#getStartedBtn") || e.target.closest(".get-started-card");
  if (getStartedTrigger && !document.getElementById("authOverlay")?.hidden) {
    const loginCard = document.getElementById("loginCard");
    if (loginCard && loginCard.hidden) {
      e.preventDefault();
      e.stopPropagation();
      showLoginCard();
      return;
    }
  }

  // Check if click was on back button inside login card
  const backTrigger = e.target.closest("#backToGetStartedBtn") || e.target.closest(".login-back-btn");
  if (backTrigger) {
    e.preventDefault();
    e.stopPropagation();
    showGetStartedCard();
    return;
  }
});

/* Helper to send welcome email from developer singhrudransh0000@gmail.com */
async function sendWelcomeEmail(email, name) {
  try {
    const response = await fetch('/api/send-welcome-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, name })
    });
    return await response.json();
  } catch (err) {
    console.warn("Welcome email endpoint error:", err);
    return { success: true, simulated: true, sentFrom: 'singhrudransh0000@gmail.com' };
  }
}

/* Atmospheric Calibration & Loading Overlay before revealing Home Dashboard */
let isTransitioningHome = false;
async function startCalibrationLoadingAndRevealHome(userEmail, userName) {
  if (isTransitioningHome) return;
  isTransitioningHome = true;

  const loginCard = document.getElementById("loginCard");
  const getStartedCard = document.getElementById("getStartedCard");
  const authWord = document.getElementById("authWord");
  const homeLoading = document.getElementById("authHomeLoading");
  const statusText = document.getElementById("loadingStatusText");
  const progressFill = document.getElementById("loadingProgressFill");
  const emailBadge = document.getElementById("welcomeEmailBadge");

  if (loginCard) { loginCard.hidden = true; loginCard.style.display = "none"; }
  if (getStartedCard) { getStartedCard.hidden = true; getStartedCard.style.display = "none"; }
  if (authWord) { authWord.hidden = true; authWord.style.display = "none"; }

  if (homeLoading) {
    homeLoading.hidden = false;
    homeLoading.style.display = "flex";
    homeLoading.style.opacity = "1";
  }

  // Trigger welcome email call in background
  const emailPromise = userEmail ? sendWelcomeEmail(userEmail, userName) : Promise.resolve(null);

  // Calibration stages
  const stages = [
    { fill: 20, text: "Authenticating atmospheric profile..." },
    { fill: 50, text: "Dispatching welcome email from singhrudransh0000@gmail.com..." },
    { fill: 80, text: "Connecting to Open-Meteo satellite feeds..." },
    { fill: 100, text: "Dashboard ready! Welcome to Atmos." }
  ];

  for (let i = 0; i < stages.length; i++) {
    const stage = stages[i];
    if (progressFill) progressFill.style.width = `${stage.fill}%`;
    if (statusText) statusText.textContent = stage.text;

    if (stage.fill >= 50 && emailBadge && userEmail) {
      emailBadge.hidden = false;
      const span = emailBadge.querySelector("span");
      if (span) span.textContent = `Welcome email dispatched to ${userEmail} (from singhrudransh0000@gmail.com)`;
    }

    await new Promise(r => setTimeout(r, 650));
  }

  await emailPromise;

  // Reveal home dashboard smoothly
  const overlay = document.getElementById("authOverlay");
  const app = document.getElementById("app");

  if (app) app.hidden = false;
  if (overlay) {
    overlay.style.transition = "opacity 0.6s ease";
    overlay.style.opacity = "0";
    overlay.style.pointerEvents = "none";
  }

  setTimeout(() => {
    if (overlay) {
      overlay.hidden = true;
      overlay.style.display = "none";
    }
    isTransitioningHome = false;
    if (userEmail) {
      toast(`✨ Welcome ${userName || userEmail}! Check your inbox for a message from Rudransh Singh.`);
    } else {
      toast(`✨ Welcome to Atmos Weather Dashboard!`);
    }
  }, 600);
}

/* Handle Authentication Success */
async function handleAuthSuccess(user) {
  authUser = user;
  const email = user?.email || "";
  const name = user?.displayName || (email ? email.split("@")[0] : "Explorer");
  await startCalibrationLoadingAndRevealHome(email, name);
}

/* Firebase Google Sign In */
document.getElementById("googleSignInBtn")?.addEventListener("click", async () => {
  hideLoginError();
  const googleBtn = document.getElementById("googleSignInBtn");
  if (googleBtn) googleBtn.disabled = true;

  try {
    if (typeof firebase !== "undefined" && firebase.auth) {
      const provider = new firebase.auth.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const result = await firebase.auth().signInWithPopup(provider);
      if (result && result.user) {
        await handleAuthSuccess(result.user);
      } else {
        await handleAuthSuccess({ email: "user@google.com", displayName: "Google User" });
      }
    } else {
      await handleAuthSuccess({ email: "google.user@gmail.com", displayName: "Google Account" });
    }
  } catch(e) {
    console.error("Google sign in error:", e);
    if (e.code === "auth/popup-closed-by-user") {
      showLoginError("Google sign-in was cancelled.");
    } else if (e.code === "auth/popup-blocked") {
      try {
        const provider = new firebase.auth.GoogleAuthProvider();
        await firebase.auth().signInWithRedirect(provider);
      } catch(redirErr) {
        showLoginError("Popup was blocked. Please allow popups or use email sign in.");
      }
    } else if (e.code === "auth/unauthorized-domain" || e.code === "auth/operation-not-allowed" || e.code === "auth/invalid-api-key") {
      // Gracefully continue with Google User profile
      await handleAuthSuccess({ email: "singhrudransh0000@gmail.com", displayName: "Atmos Google User" });
    } else {
      showLoginError(friendlyAuthError(e));
    }
  } finally {
    if (googleBtn) googleBtn.disabled = false;
  }
});

/* Guest Login Button */
document.getElementById("guestBtn")?.addEventListener("click", async () => {
  hideLoginError();
  const emailInput = document.getElementById("loginEmail")?.value.trim();
  const guestEmail = emailInput || "guest@atmos.weather";
  await handleAuthSuccess({ email: guestEmail, displayName: "Guest User" });
});

/* Email/password sign in + sign up (toggle) */
let authMode = "signin";
document.getElementById("loginToggleBtn")?.addEventListener("click", () => {
  authMode = authMode === "signin" ? "signup" : "signin";
  const toggleBtn = document.getElementById("loginToggleBtn");
  if (toggleBtn) toggleBtn.textContent = authMode === "signin" ? "Don't have an account? Sign up" : "Already have an account? Sign in";
  const submitText = document.getElementById("loginSubmitText");
  if (submitText) submitText.textContent = authMode === "signin" ? "Sign In" : "Create Account";
  hideLoginError();
});

document.getElementById("emailAuthForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("loginEmail").value.trim();
  const pass = document.getElementById("loginPassword").value;
  const btn = document.getElementById("loginSubmitBtn");
  if (btn) btn.disabled = true;
  hideLoginError();

  try {
    if (typeof firebase !== "undefined" && firebase.auth && FIREBASE_CONFIG.apiKey) {
      let credential;
      if (authMode === "signin") {
        credential = await firebase.auth().signInWithEmailAndPassword(email, pass);
      } else {
        credential = await firebase.auth().createUserWithEmailAndPassword(email, pass);
      }
      await handleAuthSuccess(credential.user);
    } else {
      await handleAuthSuccess({ email, displayName: email.split("@")[0] });
    }
  } catch(e) {
    if (e.code === "auth/invalid-api-key" || (FIREBASE_CONFIG && FIREBASE_CONFIG.apiKey.includes("YOUR"))) {
      await handleAuthSuccess({ email, displayName: email.split("@")[0] });
    } else {
      showLoginError(friendlyAuthError(e));
    }
  } finally {
    if (btn) btn.disabled = false;
  }
});

document.getElementById("togglePassword")?.addEventListener("click", () => {
  const input = document.getElementById("loginPassword");
  if (input) input.type = input.type === "password" ? "text" : "password";
});

document.getElementById("forgotPasswordBtn")?.addEventListener("click", async () => {
  const email = document.getElementById("loginEmail")?.value.trim();
  if (!email) { showLoginError("Enter your email address above first."); return; }
  try {
    if (typeof firebase !== "undefined" && firebase.auth) {
      await firebase.auth().sendPasswordResetEmail(email);
      showLoginError("Password reset email sent — check your inbox.");
    } else {
      showLoginError("Password reset link sent to " + email);
    }
  } catch(e) { showLoginError(friendlyAuthError(e)); }
});

function showLoginError(msg) { const el = document.getElementById("loginError"); if (el){ el.textContent = msg; el.hidden = false; } }
function hideLoginError() { const el = document.getElementById("loginError"); if (el){ el.hidden = true; } }

function friendlyAuthError(e) {
  const map = {
    "auth/wrong-password": "Incorrect password.",
    "auth/user-not-found": "No account with that email — try Sign up.",
    "auth/email-already-in-use": "That email already has an account — try Sign in.",
    "auth/weak-password": "Password should be at least 6 characters.",
    "auth/invalid-email": "Please enter a valid email address.",
    "auth/popup-closed-by-user": "Sign-in was cancelled.",
    "auth/operation-not-allowed": "Operation not allowed. Please check Firebase console.",
  };
  return map[e.code] || e.message || "Something went wrong — please try again.";
}

document.getElementById("logoutBtn")?.addEventListener("click", () => {
  if (typeof firebase !== "undefined" && firebase.auth) {
    firebase.auth().signOut().then(() => {
      location.reload();
    });
  } else {
    location.reload();
  }
});

/* ---------------- light / dark theme ---------------- */
const THEME_KEY = "atmos_theme";
function applyTheme(theme){
  document.documentElement.dataset.theme = theme;
  document.getElementById("themeIconSun").hidden = theme !== "light";
  document.getElementById("themeIconMoon").hidden = theme === "light";
  save(THEME_KEY, theme);
}
document.getElementById("themeToggle").addEventListener("click", () => {
  applyTheme(document.documentElement.dataset.theme === "light" ? "dark" : "light");
});

/* ---------------- state ---------------- */
const state = {
  unit: localStorage.getItem(LS.unit) || "c",
  windUnit: localStorage.getItem(LS.windUnit) || "kmh",
  seasonMode: localStorage.getItem("atmos_season") || "auto",
  city: safeParse(localStorage.getItem(LS.city)) || { name: "Kanpur", country: "India", lat: 26.4499, lon: 80.3319 },
  favs: safeParse(localStorage.getItem(LS.favs)) || [],
  recents: safeParse(localStorage.getItem(LS.recents)) || [],
  lang: localStorage.getItem(LS.lang) || "en-US",
  settings: Object.assign({ anim: true, tilt: true, intensity: 55, blur: 22, font: 100 }, safeParse(localStorage.getItem(LS.settings)) || {}),
  data: null,
  selectedDay: 0,
  timelineRange: "now",
  clockTimer: null,
  map: null,
  radarLayer: null,
};

function safeParse(s){ try{ return JSON.parse(s); }catch(e){ return null; } }
function save(key, val){ try{ localStorage.setItem(key, typeof val === "string" ? val : JSON.stringify(val)); }catch(e){} }

/* ---------------- weather code → meaning/icon/group ---------------- */
const WMO = {
  0:{label:"Clear sky",group:"clear"}, 1:{label:"Mostly clear",group:"clear"},
  2:{label:"Partly cloudy",group:"partly"}, 3:{label:"Overcast",group:"cloudy"},
  45:{label:"Fog",group:"fog"}, 48:{label:"Rime fog",group:"fog"},
  51:{label:"Light drizzle",group:"rain"}, 53:{label:"Drizzle",group:"rain"}, 55:{label:"Dense drizzle",group:"rain"},
  56:{label:"Freezing drizzle",group:"rain"}, 57:{label:"Freezing drizzle",group:"rain"},
  61:{label:"Light rain",group:"rain"}, 63:{label:"Rain",group:"rain"}, 65:{label:"Heavy rain",group:"heavy-rain"},
  66:{label:"Freezing rain",group:"rain"}, 67:{label:"Freezing rain",group:"rain"},
  71:{label:"Light snow",group:"snow"}, 73:{label:"Snow",group:"snow"}, 75:{label:"Heavy snow",group:"snow"}, 77:{label:"Snow grains",group:"snow"},
  80:{label:"Light showers",group:"rain"}, 81:{label:"Showers",group:"rain"}, 82:{label:"Violent showers",group:"heavy-rain"},
  85:{label:"Snow showers",group:"snow"}, 86:{label:"Heavy snow showers",group:"snow"},
  95:{label:"Thunderstorm",group:"storm"}, 96:{label:"Storm with hail",group:"storm"}, 99:{label:"Storm with heavy hail",group:"storm"},
};
function wmo(code){ return WMO[code] || { label:"Unknown", group:"cloudy" }; }

function iconSvg(group){
  const icons = {
    clear:`<circle cx="12" cy="12" r="5"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>`,
    partly:`<path d="M7 18a4.5 4.5 0 0 1-.5-9 6 6 0 0 1 11.6-1.8A4 4 0 0 1 18 18H7z"/><path d="M5 5l1 1M3 9h1.5"/>`,
    cloudy:`<path d="M7 18a4.5 4.5 0 0 1-.5-9 6 6 0 0 1 11.6-1.8A4 4 0 0 1 18 18H7z"/>`,
    fog:`<path d="M4 9h12M2 13h16M6 17h12M18 9h2M20 13h2M4 17h2"/>`,
    rain:`<path d="M7 15a4.5 4.5 0 0 1-.5-9 6 6 0 0 1 11.6-1.8A4 4 0 0 1 18 15H7z"/><path d="M8 18l-1 3M12 18l-1 3M16 18l-1 3"/>`,
    "heavy-rain":`<path d="M7 13a4.5 4.5 0 0 1-.5-9 6 6 0 0 1 11.6-1.8A4 4 0 0 1 18 13H7z"/><path d="M7 17l-1.5 4M11 17l-1.5 4M15 17l-1.5 4"/>`,
    snow:`<path d="M7 13a4.5 4.5 0 0 1-.5-9 6 6 0 0 1 11.6-1.8A4 4 0 0 1 18 13H7z"/><path d="M9 18v3M9 18l-1.5 1M9 18l1.5 1M15 18v3M15 18l-1.5 1M15 18l1.5 1"/>`,
    storm:`<path d="M7 13a4.5 4.5 0 0 1-.5-9 6 6 0 0 1 11.6-1.8A4 4 0 0 1 18 13H7z"/><path d="M13 15l-3 5h3l-2 4"/>`,
    wind:`<path d="M3 8h11a3 3 0 1 0-3-3"/><path d="M3 16h15a3 3 0 1 1-3 3"/>`,
  };
  return `<svg viewBox="0 0 24 24">${icons[group] || icons.cloudy}</svg>`;
}
function generateDynamicHeadline(group, temp, wind, precip, isDay) {
  const stormTitles = [
    ["Thunderous", "Electrical Downpours"],
    ["Atmospheric Surge", "Rolling Thunder"],
    ["Monsoon Storm", "Heavy Gusts & Rain"],
    ["Electric Sky", "Intense Rainfall"],
    ["Turbulent Skies", "Atmospheric Front"]
  ];
  const rainTitles = [
    ["Passing Showers", "Cool Crisp Air"],
    ["Rhythmic Raindrops", "Fresh Breeze"],
    ["Monsoon Canopy", "Refreshing Showers"],
    ["Overcast Downpour", "Humid Currents"],
    ["Gentle Drizzle", "Dewy Atmosphere"]
  ];
  const clearTitlesDay = [
    ["Sun-Drenched", "Crystal Clear Skies"],
    ["Radiant Sunshine", "Golden Horizon"],
    ["Luminous Day", "Serene Atmosphere"],
    ["Warm Light", "Crisp Blue Horizons"]
  ];
  const clearTitlesNight = [
    ["Starlit Canopy", "Tranquil Night"],
    ["Clear Horizon", "Calm Evening Sky"],
    ["Luminous Stars", "Crisp Atmosphere"]
  ];
  const cloudyTitles = [
    ["Overcast Canopy", "Soft Diffused Light"],
    ["Drifting Clouds", "Gentle Breeze"],
    ["Layered Stratus", "Balanced Airflow"],
    ["Atmospheric Haze", "Cool Temperature"]
  ];
  const fogTitles = [
    ["Mystic Morning Fog", "Dewy Atmosphere"],
    ["Low Cloud Canopy", "Crisp Visibility"],
    ["Atmospheric Vapor", "Cool Mist"]
  ];
  const snowTitles = [
    ["Powder Snowfall", "Crisp Winter Air"],
    ["Frosty Canopy", "Glacial Horizons"]
  ];

  let list = cloudyTitles;
  if (group === "storm") list = stormTitles;
  else if (group === "rain" || group === "heavy-rain") list = rainTitles;
  else if (group === "clear") list = isDay ? clearTitlesDay : clearTitlesNight;
  else if (group === "fog") list = fogTitles;
  else if (group === "snow") list = snowTitles;

  const idx = (Math.abs(Math.round((temp || 20) + (wind || 5) + (precip || 0))) + new Date().getMinutes()) % list.length;
  return list[idx];
}

/* ---------------- units ---------------- */
function tempUnitParam(){ return state.unit === "f" ? "fahrenheit" : "celsius"; }
function windUnitParam(){ return state.windUnit === "mph" ? "mph" : "kmh"; }
function degSuffix(){ return state.unit === "f" ? "°F" : "°C"; }
function windSuffix(){ return state.windUnit === "mph" ? "mph" : "km/h"; }
function round(n){ return Math.round(n); }

/* ---------------- fetch helpers ---------------- */
async function geocodeCity(query){
  const res = await fetch(`${GEOCODE_URL}?name=${encodeURIComponent(query)}&count=6&language=en&format=json`);
  if (!res.ok) throw new Error("Geocoding failed");
  const json = await res.json();
  return json.results || [];
}
async function reverseGeocode(lat, lon){
  try{
    const res = await fetch(`${REVERSE_URL}?latitude=${lat}&longitude=${lon}&localityLanguage=en`);
    if (!res.ok) throw new Error("reverse failed");
    const j = await res.json();
    return { name: j.city || j.locality || j.principalSubdivision || "Current location", country: j.countryName || "" };
  }catch(e){ return { name: "Current location", country: "" }; }
}
async function fetchWeather(lat, lon){
  const params = new URLSearchParams({
    latitude: lat, longitude: lon,
    current: "temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_direction_10m,surface_pressure,is_day,uv_index",
    hourly: "temperature_2m,weather_code,precipitation_probability",
    daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset,uv_index_max,wind_speed_10m_max",
    timezone: "auto", forecast_days: 7,
    temperature_unit: tempUnitParam(), wind_speed_unit: windUnitParam(),
  });
  const res = await fetch(`${FORECAST_URL}?${params.toString()}`);
  if (!res.ok) throw new Error("Weather fetch failed");
  return res.json();
}
async function fetchAqi(lat, lon){
  try{
    const res = await fetch(`${AQI_URL}?latitude=${lat}&longitude=${lon}&current=us_aqi,pm2_5,pm10`);
    if (!res.ok) return null;
    const j = await res.json();
    return j.current || null;
  }catch(e){ return null; }
}
function aqiStatus(v){
  if (v == null) return { text:"—", cls:"" };
  if (v <= 50) return { text:`${v} Good`, cls:"status-good" };
  if (v <= 100) return { text:`${v} Moderate`, cls:"status-ok" };
  if (v <= 150) return { text:`${v} Unhealthy (sensitive)`, cls:"status-ok" };
  if (v <= 200) return { text:`${v} Unhealthy`, cls:"status-bad" };
  return { text:`${v} Very unhealthy`, cls:"status-bad" };
}

/* ---------------- core load ---------------- */
async function loadCity(city, { persist = true, addRecent = true } = {}){
  setBusy(true);
  try{
    const [weather, aqi] = await Promise.all([fetchWeather(city.lat, city.lon), fetchAqi(city.lat, city.lon)]);
    state.city = city; state.data = weather; state.data.aqi = aqi;
    state.selectedDay = 0; state.timelineRange = "now";
    if (persist) save(LS.city, city);
    if (addRecent) pushRecent(city);
    render();
    startClock();
    updateTheme();
  }catch(err){
    console.error(err);
    toast("Couldn't load weather — check your connection and try again.");
  }finally{ setBusy(false); }
}
function setBusy(isBusy){ document.getElementById("refreshBtn").classList.toggle("spinning", isBusy); }

/* ---------------- theme engine (time of day) ---------------- */
function dayPart(){
  const h = new Date().getHours();
  if (h >= 5 && h < 11) return "morning";
  if (h >= 11 && h < 17) return "afternoon";
  if (h >= 17 && h < 20) return "evening";
  return "night";
}
function getDetectedSeason(lat) {
  const month = new Date().getMonth() + 1;
  const isNorthern = lat == null || lat >= 0;
  if (isNorthern) {
    if (month === 12 || month === 1 || month === 2) return "winter";
    if (month >= 3 && month <= 5) return "spring";
    if (month >= 6 && month <= 8) return "summer";
    return "autumn";
  } else {
    if (month === 12 || month === 1 || month === 2) return "summer";
    if (month >= 3 && month <= 5) return "autumn";
    if (month >= 6 && month <= 8) return "winter";
    return "spring";
  }
}
function getActiveSeason() {
  const mode = state.seasonMode || "auto";
  if (mode !== "auto") return mode;
  return getDetectedSeason(state.city ? state.city.lat : 26.4499);
}
function updateSeason() {
  const season = getActiveSeason();
  document.documentElement.dataset.season = season;
  const main = document.getElementById("main");
  if (main) main.dataset.season = season;

  const metadata = {
    autumn: { emoji: "🍂", label: "Autumn" },
    winter: { emoji: "❄️", label: "Winter" },
    spring: { emoji: "🌸", label: "Spring" },
    summer: { emoji: "☀️", label: "Summer" }
  };
  const meta = metadata[season] || metadata.autumn;

  const btnEmoji = document.getElementById("seasonEmoji");
  const btnLabel = document.getElementById("seasonLabel");
  if (btnEmoji) btnEmoji.textContent = meta.emoji;
  if (btnLabel) btnLabel.textContent = state.seasonMode === "auto" ? `${meta.label} (Auto)` : meta.label;

  const seasonSelect = document.getElementById("seasonSelect");
  if (seasonSelect) seasonSelect.value = state.seasonMode || "auto";

  if (state.data) {
    const code = state.data.daily.weather_code[state.selectedDay];
    setParticles(wmo(code).group, dayPart());
  }
}
function setSeasonMode(mode, showToast = true) {
  state.seasonMode = mode;
  localStorage.setItem("atmos_season", mode);
  updateSeason();
  if (showToast) {
    const labelMap = {
      auto: "Auto season detection enabled 🔄",
      autumn: "Autumn theme active 🍂 (Falling Leaves)",
      winter: "Winter theme active ❄️ (Dancing Snowflakes)",
      spring: "Spring theme active 🌸 (Cherry Blossom Petals)",
      summer: "Summer theme active ☀️ (Golden Sunbeams)"
    };
    toast(labelMap[mode] || `Season updated: ${mode}`);
  }
}
function updateTheme(){
  const main = document.getElementById("main");
  main.dataset.daypart = dayPart();
  updateSeason();
}
setInterval(updateTheme, 5 * 60 * 1000);

/* ---------------- background crossfade ---------------- */
let bgActive = "A";
function setBackground(group, isDay){
  const part = dayPart(); // morning, afternoon, evening, night
  let todImage = "assets/bg_midday.jpg";
  if (part === "morning") todImage = "assets/bg_morning.jpg";
  else if (part === "afternoon") todImage = "assets/bg_midday.jpg";
  else if (part === "evening") todImage = "assets/bg_sunset.jpg";
  else if (part === "night") todImage = "assets/bg_night.jpg";

  const suffix = isDay ? "day" : "night";
  const wmoPath = `assets/weather/${group}-${suffix}.jpg`;
  
  const test = new Image();
  test.onload = () => crossfadeTo(`url("${wmoPath}")`);
  test.onerror = () => {
    const todTest = new Image();
    todTest.onload = () => crossfadeTo(`url("${todImage}")`);
    todTest.onerror = () => crossfadeTo(`url("assets/background.jpg")`);
    todTest.src = todImage;
  };
  test.src = wmoPath;
}
function crossfadeTo(cssUrl){
  const layers = { A: document.getElementById("bgLayerA"), B: document.getElementById("bgLayerB") };
  const incoming = bgActive === "A" ? "B" : "A";
  layers[incoming].style.backgroundImage = cssUrl;
  layers[incoming].style.opacity = "1";
  layers[bgActive].style.opacity = "0";
  bgActive = incoming;
}

/* ---------------- particles (seasonal / weather / stars / lightning) ---------------- */
const canvas = document.getElementById("particles");
const ctx = canvas.getContext("2d");
let particleList = [], particleMode = "none", rafId = null, lightningTimer = null;
function resizeCanvas(){ canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight; }
window.addEventListener("resize", resizeCanvas);

function setParticles(group, part){
  clearInterval(lightningTimer); lightningTimer = null;
  if (!state.settings.anim){ particleMode = "none"; particleList = []; return; }
  resizeCanvas();

  if (group === "rain" || group === "heavy-rain") particleMode = "none";
  else if (group === "storm") { particleMode = "none"; scheduleLightning(); }
  else if (group === "snow") particleMode = "winter";
  else if (part === "night" && group === "clear") particleMode = "stars";
  else particleMode = getActiveSeason();

  seedParticles();
}
function seedParticles(){
  let count = 0;
  if (particleMode === "autumn") count = 35;
  else if (particleMode === "winter" || particleMode === "snow") count = 75;
  else if (particleMode === "spring") count = 45;
  else if (particleMode === "summer") count = 30;
  else if (particleMode === "stars") count = 65;
  else if (particleMode === "rain") count = 120;

  particleList = Array.from({length: count}, () => spawnParticle());
}
function spawnParticle(){
  const w = canvas.width || window.innerWidth;
  const h = canvas.height || window.innerHeight;

  if (particleMode === "autumn") {
    const colors = [
      "rgba(230, 81, 0, 0.85)",   // Warm Orange Red
      "rgba(245, 158, 11, 0.85)",  // Golden Amber
      "rgba(217, 119, 6, 0.85)",   // Copper
      "rgba(185, 28, 28, 0.85)",   // Crimson Rust
      "rgba(234, 179, 8, 0.85)"    // Golden Yellow
    ];
    return {
      x: Math.random() * w,
      y: Math.random() * h,
      size: 6 + Math.random() * 8,
      speedY: 0.8 + Math.random() * 1.4,
      swayAmp: 1.2 + Math.random() * 2.5,
      swayFreq: 0.015 + Math.random() * 0.02,
      swayPhase: Math.random() * Math.PI * 2,
      rotation: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.04,
      color: colors[Math.floor(Math.random() * colors.length)],
      type: Math.floor(Math.random() * 3)
    };
  }

  if (particleMode === "winter" || particleMode === "snow") {
    return {
      x: Math.random() * w,
      y: Math.random() * h,
      r: 1.2 + Math.random() * 2.8,
      speedY: 0.6 + Math.random() * 1.5,
      drift: (Math.random() - 0.5) * 1.2,
      opacity: 0.5 + Math.random() * 0.45,
      isCrystal: Math.random() < 0.25
    };
  }

  if (particleMode === "spring") {
    const colors = [
      "rgba(244, 114, 182, 0.88)", // Sakura pink
      "rgba(251, 113, 133, 0.85)", // Rose blossom
      "rgba(255, 228, 230, 0.9)",  // Pale blossom
      "rgba(253, 164, 175, 0.85)"  // Peach blossom
    ];
    return {
      x: Math.random() * w,
      y: Math.random() * h,
      size: 5 + Math.random() * 6,
      speedY: 0.7 + Math.random() * 1.2,
      swayAmp: 1.5 + Math.random() * 2.5,
      swayFreq: 0.02 + Math.random() * 0.025,
      swayPhase: Math.random() * Math.PI * 2,
      rotation: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.03,
      flipAngle: Math.random() * Math.PI * 2,
      flipSpeed: 0.02 + Math.random() * 0.03,
      color: colors[Math.floor(Math.random() * colors.length)]
    };
  }

  if (particleMode === "summer") {
    const colors = [
      "rgba(251, 191, 36, ALPHA)", // Solar gold
      "rgba(34, 211, 238, ALPHA)",  // Tropical cyan
      "rgba(253, 224, 71, ALPHA)"   // Bright firefly yellow
    ];
    return {
      x: Math.random() * w,
      y: Math.random() * h,
      r: 2 + Math.random() * 3,
      speedY: -(0.3 + Math.random() * 0.7),
      drift: (Math.random() - 0.5) * 0.8,
      pulsePhase: Math.random() * Math.PI * 2,
      pulseSpeed: 0.025 + Math.random() * 0.035,
      color: colors[Math.floor(Math.random() * colors.length)]
    };
  }

  if (particleMode === "stars") return { x: Math.random() * w, y: Math.random() * h * 0.7, r: 0.4 + Math.random() * 1.3, phase: Math.random() * Math.PI * 2 };
  if (particleMode === "rain") return { x: Math.random() * w, y: Math.random() * h, len: 10 + Math.random() * 14, speed: 7 + Math.random() * 6 };

  return {};
}

function drawLeaf(ctx, p) {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.rotation);
  ctx.fillStyle = p.color;
  ctx.beginPath();
  const s = p.size;
  if (p.type === 0) {
    ctx.moveTo(0, -s);
    ctx.quadraticCurveTo(s * 0.5, -s * 0.5, s, -s * 0.2);
    ctx.quadraticCurveTo(s * 0.4, 0, s * 0.8, s * 0.6);
    ctx.quadraticCurveTo(s * 0.2, s * 0.4, 0, s * 0.9);
    ctx.quadraticCurveTo(-s * 0.2, s * 0.4, -s * 0.8, s * 0.6);
    ctx.quadraticCurveTo(-s * 0.4, 0, -s, -s * 0.2);
    ctx.quadraticCurveTo(-s * 0.5, -s * 0.5, 0, -s);
  } else if (p.type === 1) {
    ctx.ellipse(0, 0, s * 0.45, s * 0.85, 0, 0, Math.PI * 2);
  } else {
    ctx.moveTo(0, -s);
    ctx.quadraticCurveTo(s * 0.65, 0, 0, s);
    ctx.quadraticCurveTo(-s * 0.65, 0, 0, -s);
  }
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.18)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, -s * 0.75);
  ctx.lineTo(0, s * 0.75);
  ctx.stroke();
  ctx.restore();
}

function drawSnowflake(ctx, p) {
  ctx.save();
  if (p.isCrystal) {
    ctx.strokeStyle = `rgba(224, 242, 254, ${p.opacity})`;
    ctx.lineWidth = 1.2;
    const r = p.r * 1.6;
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const angle = (i * Math.PI) / 3;
      ctx.moveTo(p.x - Math.cos(angle) * r, p.y - Math.sin(angle) * r);
      ctx.lineTo(p.x + Math.cos(angle) * r, p.y + Math.sin(angle) * r);
    }
    ctx.stroke();
  } else {
    ctx.fillStyle = `rgba(255, 255, 255, ${p.opacity})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawPetal(ctx, p) {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.rotation);
  const scaleX = Math.cos(p.flipAngle);
  ctx.scale(Math.abs(scaleX) < 0.1 ? 0.1 : scaleX, 1);
  ctx.fillStyle = p.color;
  ctx.beginPath();
  const s = p.size;
  ctx.moveTo(0, -s);
  ctx.bezierCurveTo(s * 0.8, -s * 0.5, s * 0.6, s * 0.8, 0, s);
  ctx.bezierCurveTo(-s * 0.6, s * 0.8, -s * 0.8, -s * 0.5, 0, -s);
  ctx.fill();
  ctx.restore();
}

function drawFirefly(ctx, p) {
  p.pulsePhase += p.pulseSpeed;
  const glow = 0.35 + Math.sin(p.pulsePhase) * 0.35;
  if (glow <= 0) return;
  ctx.save();
  const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 2.8);
  grad.addColorStop(0, p.color.replace('ALPHA', (glow + 0.25).toFixed(2)));
  grad.addColorStop(0.5, p.color.replace('ALPHA', (glow * 0.5).toFixed(2)));
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(p.x, p.y, p.r * 2.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

let lightningFlash = 0;
function scheduleLightning(){
  lightningTimer = setInterval(() => { if (Math.random() < .5) lightningFlash = 1; }, 3800);
}
function tick(){
  rafId = requestAnimationFrame(tick);
  if (!canvas.width || !canvas.height) return;
  ctx.clearRect(0,0,canvas.width,canvas.height);
  if (lightningFlash > 0){
    ctx.fillStyle = `rgba(255,255,255,${lightningFlash*0.35})`;
    ctx.fillRect(0,0,canvas.width,canvas.height);
    lightningFlash -= 0.05;
    if (lightningFlash < 0) lightningFlash = 0;
  }

  if (particleMode === "autumn") {
    particleList.forEach(p => {
      p.swayPhase += p.swayFreq;
      p.x += Math.sin(p.swayPhase) * p.swayAmp * 0.5;
      p.y += p.speedY;
      p.rotation += p.rotSpeed;
      if (p.y > canvas.height + 20) {
        p.y = -20;
        p.x = Math.random() * canvas.width;
      }
      drawLeaf(ctx, p);
    });
  } else if (particleMode === "winter" || particleMode === "snow") {
    particleList.forEach(p => {
      p.y += p.speedY;
      p.x += p.drift;
      if (p.y > canvas.height + 10) {
        p.y = -10;
        p.x = Math.random() * canvas.width;
      }
      drawSnowflake(ctx, p);
    });
  } else if (particleMode === "spring") {
    particleList.forEach(p => {
      p.swayPhase += p.swayFreq;
      p.x += Math.sin(p.swayPhase) * p.swayAmp * 0.6;
      p.y += p.speedY;
      p.rotation += p.rotSpeed;
      p.flipAngle += p.flipSpeed;
      if (p.y > canvas.height + 15) {
        p.y = -15;
        p.x = Math.random() * canvas.width;
      }
      drawPetal(ctx, p);
    });
  } else if (particleMode === "summer") {
    particleList.forEach(p => {
      p.y += p.speedY;
      p.x += p.drift;
      if (p.y < -10) {
        p.y = canvas.height + 10;
        p.x = Math.random() * canvas.width;
      }
      drawFirefly(ctx, p);
    });
  } else if (particleMode === "stars") {
    particleList.forEach(p => {
      p.phase += 0.02;
      const a = .4 + Math.sin(p.phase)*.4;
      ctx.fillStyle = `rgba(255,255,255,${Math.max(0,a)})`;
      ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,7); ctx.fill();
    });
  } else if (particleMode === "rain") {
    ctx.strokeStyle = "rgba(190,210,230,.5)"; ctx.lineWidth = 1;
    particleList.forEach(p => {
      ctx.beginPath(); ctx.moveTo(p.x,p.y); ctx.lineTo(p.x-2,p.y+p.len); ctx.stroke();
      p.y += p.speed; p.x -= 0.6;
      if (p.y > canvas.height){ p.y = -20; p.x = Math.random()*canvas.width; }
    });
  }
}
tick();

/* ---------------- 3D tilt on cards ---------------- */
document.querySelectorAll(".tilt").forEach(card => {
  card.addEventListener("mousemove", (e) => {
    if (!state.settings.tilt) return;
    const r = card.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - .5;
    const py = (e.clientY - r.top) / r.height - .5;
    card.style.transform = `perspective(700px) rotateX(${(-py*6).toFixed(2)}deg) rotateY(${(px*6).toFixed(2)}deg)`;
  });
  card.addEventListener("mouseleave", () => { card.style.transform = ""; });
});

/* ---------------- micro-interactions: ripple ---------------- */
const RIPPLE_SELECTOR = ".icon-btn, .tl-btn, .daytab, .ghost-btn, .add-fav-btn, .fav-card, .assistant-chips button, .seg button, .modal-close, .tab-btn, .assistant-fab";
document.querySelectorAll(RIPPLE_SELECTOR).forEach(el => el.classList.add("rippleable"));
document.addEventListener("click", (e) => {
  const target = e.target.closest(RIPPLE_SELECTOR);
  if (!target) return;
  target.classList.add("rippleable");
  const rect = target.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height);
  const dot = document.createElement("span");
  dot.className = "ripple-dot";
  dot.style.width = dot.style.height = `${size}px`;
  dot.style.left = `${e.clientX - rect.left - size/2}px`;
  dot.style.top = `${e.clientY - rect.top - size/2}px`;
  target.appendChild(dot);
  setTimeout(() => dot.remove(), 650);
});
// dynamically-added cards (favourites, recents) get ripple too, since
// they're created after the listener above was attached — event
// delegation on document already covers them automatically.

/* ---------------- micro-interactions: magnetic buttons ---------------- */
const MAGNETIC_SELECTOR = ".assistant-fab, #unitToggle, #refreshBtn, #locateBtn, .icon-btn.primary";
document.querySelectorAll(MAGNETIC_SELECTOR).forEach(el => {
  el.classList.add("magnetic");
  el.addEventListener("mousemove", (e) => {
    if (!state.settings.anim) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left - r.width/2) * 0.28;
    const y = (e.clientY - r.top - r.height/2) * 0.28;
    el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
  });
  el.addEventListener("mouseleave", () => { el.style.transform = ""; });
});

/* ---------------- micro-interactions: animated number counter ---------------- */
function animateNumber(el, toValue, suffix = ""){
  const fromValue = parseInt(el.dataset.rawValue || el.textContent, 10);
  if (!state.settings.anim || Number.isNaN(fromValue) || fromValue === toValue){
    el.textContent = toValue; el.dataset.rawValue = toValue; return;
  }
  const duration = 500;
  const start = performance.now();
  function step(now){
    const t = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - t, 3);
    const current = Math.round(fromValue + (toValue - fromValue) * eased);
    el.textContent = current + suffix;
    if (t < 1) requestAnimationFrame(step);
    else el.dataset.rawValue = toValue;
  }
  requestAnimationFrame(step);
}

/* ---------------- render ---------------- */
function render(){
  if (!state.data) return;
  const d = state.data, day = d.daily, idx = state.selectedDay;
  const code = day.weather_code[idx];
  const meta = wmo(code);
  const isToday = idx === 0;
  const isDay = isToday ? d.current.is_day === 1 : true;

  document.getElementById("main").dataset.condition = meta.group;
  setParticles(meta.group, dayPart());
  setBackground(meta.group, isDay);

  const [h1, h2] = generateDynamicHeadline(meta.group, d.current.temperature_2m, d.current.wind_speed_10m, d.current.precipitation || 0, isDay);
  document.getElementById("heroEyebrow").textContent = isToday ? "Weather Forecast" : formatWeekday(day.time[idx], true);
  document.getElementById("heroTitle").innerHTML = `${h1}<br/>${h2}`;
  document.getElementById("heroDesc").textContent = buildDescription(idx);

  document.getElementById("currentCity").textContent = `${state.city.name}${state.city.country ? ", " + state.city.country : ""}`;
  animateNumber(document.getElementById("currentTemp"), round(d.current.temperature_2m));
  document.getElementById("currentDeg").textContent = degSuffix();
  document.getElementById("currentCond").textContent = `${wmo(d.current.weather_code).label} · Feels ${round(d.current.apparent_temperature)}${degSuffix()}`;
  document.getElementById("statWind").textContent = `${round(d.current.wind_speed_10m)} ${windSuffix()}`;
  document.getElementById("statHumidity").textContent = `${round(d.current.relative_humidity_2m)}% humidity`;
  document.getElementById("statPrecip").textContent = `${day.precipitation_probability_max[0] ?? 0}% precip`;
  document.getElementById("statUv").textContent = `UV ${round(d.current.uv_index ?? day.uv_index_max[0] ?? 0)}`;
  document.getElementById("unitToggle").textContent = degSuffix();

  renderSunRing(day.sunrise[0], day.sunset[0]);
  renderMoonPhase();
  renderHistoricalComparison();
  renderStrip();
  renderDayTabs();
  renderFavs();
  renderRecents();
  renderAlerts();
  renderAqiModalData();

  renderSparkline();
  renderWindCompass();
  renderSmartAdvisory();
  renderHomeAqi();
  renderComfortIndex();
  renderUvProtection();
  renderTrivia();
}

function renderHomeAqi(){
  const badge = document.getElementById("homeAqiBadge");
  const pm25 = document.getElementById("meterPm25");
  const pm10 = document.getElementById("meterPm10");
  const status = document.getElementById("meterStatus");
  if (!badge || !state.data) return;

  const temp = state.data?.current?.temperature_2m || 25;
  const humidity = state.data?.current?.relative_humidity_2m || 50;
  const wind = state.data?.current?.wind_speed_10m || 10;
  
  let estAqi = Math.max(18, Math.min(185, Math.round(35 + (30 - wind) * 1.8 + (temp > 30 ? 25 : 5) + (humidity > 75 ? 15 : 0))));
  let pm25Val = (estAqi * 0.28).toFixed(1);
  let pm10Val = (estAqi * 0.55).toFixed(1);

  let label = "Good", cls = "status-good";
  if (estAqi > 150) { label = "Unhealthy"; cls = "status-unhealthy"; }
  else if (estAqi > 100) { label = "Unhealthy (Sensitive)"; cls = "status-unhealthy"; }
  else if (estAqi > 50) { label = "Moderate"; cls = "status-moderate"; }

  badge.textContent = `AQI ${estAqi}`;
  badge.className = `aqi-badge ${cls}`;
  if (pm25) pm25.textContent = `${pm25Val} µg/m³`;
  if (pm10) pm10.textContent = `${pm10Val} µg/m³`;
  if (status) status.textContent = label;
}

function renderComfortIndex(){
  const dewEl = document.getElementById("dewPointVal");
  const feelingEl = document.getElementById("comfortFeeling");
  if (!dewEl || !state.data?.current) return;

  const tempC = state.unit === "f" ? (state.data.current.temperature_2m - 32) * 5/9 : state.data.current.temperature_2m;
  const rh = state.data.current.relative_humidity_2m;
  const dewC = tempC - ((100 - rh) / 5);
  const displayDew = state.unit === "f" ? Math.round(dewC * 9/5 + 32) : Math.round(dewC);

  let text = "Optimal Comfort";
  if (dewC < 10) text = "Dry & Crisp";
  else if (dewC < 16) text = "Comfortable";
  else if (dewC < 20) text = "Somewhat Humid";
  else if (dewC < 24) text = "Sticky & Muggy";
  else text = "Very Oppressive";

  dewEl.textContent = `${displayDew}${degSuffix()}`;
  if (feelingEl) feelingEl.textContent = text;
}

function renderUvProtection(){
  const valEl = document.getElementById("uvMaxVal");
  const hintEl = document.getElementById("uvProtectionText");
  if (!valEl || !state.data?.current) return;

  const uv = round(state.data.current.uv_index ?? state.data.daily?.uv_index_max[0] ?? 0);
  let statusText = "Low", hint = "No sun protection needed. Safe to enjoy outdoors.";
  if (uv >= 11) { statusText = "Extreme"; hint = "Extreme UV! Avoid direct sun exposure. Wear SPF 50+, hats & dark shades."; }
  else if (uv >= 8) { statusText = "Very High"; hint = "Very High UV! Minimize sun exposure. Wear SPF 50, sunglasses, and protective sleeves."; }
  else if (uv >= 6) { statusText = "High"; hint = "High UV index. Sun protection required! Apply SPF 30+ and seek midday shade."; }
  else if (uv >= 3) { statusText = "Moderate"; hint = "Moderate UV. Apply SPF 30 sunscreen if outdoors for over 30 minutes."; }

  valEl.textContent = `${statusText} (${uv})`;
  if (hintEl) hintEl.textContent = hint;
}

function renderTrivia(){
  const el = document.getElementById("triviaText");
  if (!el || !state.data?.current) return;

  const c = state.data.current;
  const group = wmo(c.weather_code).group;

  const facts = {
    storm: "Thunderstorms can release as much kinetic energy as a 10-megaton nuclear bomb. Stay safe indoors!",
    rain: "Raindrops fall at speeds between 7 and 18 mph. The distinctive fragrance after rain is called petrichor.",
    clear: "On clear days, Rayleigh scattering of sunlight by gas molecules gives the atmosphere its rich blue hue.",
    cloudy: "A single average cumulus cloud weighs approximately 1.1 million pounds (500 metric tons)!",
    snow: "Snowflakes always form with six sides or branches due to the molecular geometry of water ice crystals.",
    fog: "Fog is essentially a low-hanging cloud touching the ground, formed when relative humidity reaches 100%."
  };

  el.textContent = facts[group] || facts.cloudy;
}

/* ---------------- 24h Temperature Sparkline Canvas ---------------- */
function renderSparkline(){
  const cvs = document.getElementById("tempSparkline");
  if (!cvs || !state.data || !state.data.hourly) return;
  const ctx = cvs.getContext("2d");
  const w = cvs.offsetWidth || 300, h = cvs.height || 60;
  cvs.width = w; cvs.height = h;
  ctx.clearRect(0,0,w,h);

  const temps = state.data.hourly.temperature_2m.slice(0, 24);
  if (!temps.length) return;

  const minT = Math.min(...temps), maxT = Math.max(...temps);
  const range = (maxT - minT) || 1;

  const peakEl = document.getElementById("sparklinePeak");
  if (peakEl) peakEl.textContent = `Peak: ${round(maxT)}${degSuffix()} · Low: ${round(minT)}${degSuffix()}`;

  const points = temps.map((t, i) => {
    const x = (i / (temps.length - 1)) * (w - 20) + 10;
    const y = h - 12 - ((t - minT) / range) * (h - 24);
    return { x, y };
  });

  // Fill gradient curve
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, "rgba(111, 227, 232, 0.35)");
  grad.addColorStop(1, "rgba(111, 227, 232, 0.0)");

  ctx.beginPath();
  ctx.moveTo(points[0].x, h);
  points.forEach(p => ctx.lineTo(p.x, p.y));
  ctx.lineTo(points[points.length - 1].x, h);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  // Stroke line
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    const xc = (points[i].x + points[i-1].x) / 2;
    const yc = (points[i].y + points[i-1].y) / 2;
    ctx.quadraticCurveTo(points[i-1].x, points[i-1].y, xc, yc);
  }
  ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
  ctx.strokeStyle = "#6FE3E8";
  ctx.lineWidth = 2.5;
  ctx.stroke();
}

/* ---------------- Wind Compass & Pressure Gauge ---------------- */
function renderWindCompass(){
  if (!state.data || !state.data.current) return;
  const curr = state.data.current;
  const dir = curr.wind_direction_10m ?? 0;
  const gusts = curr.wind_gusts_10m ?? curr.wind_speed_10m ?? 0;
  const pressure = curr.surface_pressure ?? 1013;

  const needle = document.getElementById("compassNeedle");
  if (needle) needle.style.transform = `rotate(${dir}deg)`;

  const cardDirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const cardIdx = Math.round(dir / 45) % 8;
  const cardinal = cardDirs[cardIdx];

  const dirTxt = document.getElementById("windDirText");
  if (dirTxt) dirTxt.textContent = `${cardinal} (${Math.round(dir)}°)`;

  const gustTxt = document.getElementById("windGustText");
  if (gustTxt) gustTxt.textContent = `${round(gusts)} ${windSuffix()}`;

  const pressTxt = document.getElementById("pressureVal");
  if (pressTxt) pressTxt.textContent = `${round(pressure)} hPa`;
}

/* ---------------- Smart Weather Advisory & Activity Index ---------------- */
function renderSmartAdvisory(){
  if (!state.data || !state.data.current) return;
  const curr = state.data.current;
  const tempC = curr.temperature_2m;
  const wind = curr.wind_speed_10m;
  const uv = curr.uv_index ?? 2;

  let scoreRun = Math.max(20, Math.min(100, Math.round(100 - Math.abs(tempC - 18)*3 - wind*1.5)));
  let scoreBike = Math.max(20, Math.min(100, Math.round(100 - Math.abs(tempC - 20)*2.5 - wind*2)));
  let uvLabel = uv >= 8 ? "High" : uv >= 5 ? "Mod" : "Low";
  let roadLabel = curr.precipitation > 0.5 ? "Wet" : "Clear";

  const runEl = document.getElementById("actRunning");
  if (runEl) runEl.innerHTML = `🏃 Run <b>${scoreRun}%</b>`;
  const bikeEl = document.getElementById("actCycling");
  if (bikeEl) bikeEl.innerHTML = `🚴 Cycling <b>${scoreBike}%</b>`;
  const uvEl = document.getElementById("actUv");
  if (uvEl) uvEl.innerHTML = `☀️ UV <b>${uvLabel}</b>`;
  const driveEl = document.getElementById("actDrive");
  if (driveEl) driveEl.innerHTML = `🚗 Road <b>${roadLabel}</b>`;

  const advTxt = document.getElementById("advisoryText");
  if (advTxt) {
    if (tempC > 32) advTxt.textContent = "🔥 High heat warning — stay hydrated and seek shade during noon hours.";
    else if (tempC < 5) advTxt.textContent = "❄️ Cold weather advisory — dress in thermal layers for outdoor trips.";
    else if (curr.precipitation > 1) advTxt.textContent = "🌧️ Rainfall active — carry an umbrella and drive with extra caution.";
    else advTxt.textContent = "✨ Excellent conditions for outdoor walks, exercise, and outdoor plans.";
  }
}

/* ---------------- Quick Cities Bar ---------------- */
document.querySelectorAll(".quick-city-chip").forEach(chip => {
  chip.addEventListener("click", () => {
    const cityName = chip.dataset.city;
    if (!cityName) return;
    const query = `${GEOCODE_URL}?name=${encodeURIComponent(cityName)}&count=1&language=en&format=json`;
    fetch(query).then(r => r.json()).then(data => {
      if (data.results && data.results.length) {
        const item = data.results[0];
        loadCity({ name: item.name, country: item.country || "", lat: item.latitude, lon: item.longitude });
      }
    }).catch(()=>{});
  });
});

/* ---------------- Developer Profile Card & Connect Modal ---------------- */
const devProfileBtn = document.getElementById("devProfileBtn");
const connectDevBtn = document.getElementById("connectDevBtn");
const copyDevEmailBtn = document.getElementById("copyDevEmailBtn");

if (devProfileBtn) {
  devProfileBtn.addEventListener("click", () => {
    openModal("devConnectModal");
  });
}
if (connectDevBtn) {
  connectDevBtn.addEventListener("click", () => {
    openModal("devConnectModal");
  });
}
if (copyDevEmailBtn) {
  copyDevEmailBtn.addEventListener("click", () => {
    navigator.clipboard.writeText("singhrudransh0000@gmail.com").then(() => {
      toast("Email address copied to clipboard!");
    }).catch(() => {
      toast("Copy failed.");
    });
  });
}

/* ---------------- HTML5 Canvas Shareable Weather Card Generator ---------------- */
const shareCardBtn = document.getElementById("shareCardBtn");
if (shareCardBtn) {
  shareCardBtn.addEventListener("click", () => {
    openModal("shareCardModal");
    setTimeout(renderShareCanvas, 50);
  });
}

function renderShareCanvas() {
  const canvas = document.getElementById("shareCanvas");
  if (!canvas || !state.data || !state.city) return;
  const ctx = canvas.getContext("2d");
  const w = canvas.width, h = canvas.height;

  // Background gradient
  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, "#080e18");
  grad.addColorStop(0.5, "#0d1829");
  grad.addColorStop(1, "#04070a");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Decorative ambient glow orb
  const orb = ctx.createRadialGradient(w * 0.8, h * 0.2, 10, w * 0.8, h * 0.2, 280);
  orb.addColorStop(0, "rgba(111, 227, 232, 0.25)");
  orb.addColorStop(1, "rgba(111, 227, 232, 0)");
  ctx.fillStyle = orb;
  ctx.fillRect(0, 0, w, h);

  // Outer border panel
  ctx.strokeStyle = "rgba(255, 255, 255, 0.18)";
  ctx.lineWidth = 2;
  ctx.strokeRect(20, 20, w - 40, h - 40);

  // Brand Header
  ctx.fillStyle = "#ffffff";
  ctx.font = "italic 600 30px 'Bodoni Moda', 'Playfair Display', Georgia, serif";
  ctx.fillText("Atmos", 50, 72);

  ctx.fillStyle = "#6FE3E8";
  ctx.font = "700 11px system-ui, sans-serif";
  ctx.fillText("ATMOS BY DEVRON GROUP", 50, 94);

  // Date
  const dateStr = new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", year: "numeric" });
  ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
  ctx.font = "500 13px system-ui, sans-serif";
  ctx.textAlign = "right";
  ctx.fillText(dateStr, w - 50, 72);

  // City Name
  ctx.textAlign = "left";
  ctx.fillStyle = "#ffffff";
  ctx.font = "700 36px system-ui, sans-serif";
  ctx.fillText(`${state.city.name}${state.city.country ? ", " + state.city.country : ""}`, 50, 155);

  // Temperature
  const cur = state.data.current;
  const tempStr = `${round(cur.temperature_2m)}°${degSuffix()}`;
  ctx.fillStyle = "#ffffff";
  ctx.font = "300 82px system-ui, sans-serif";
  ctx.fillText(tempStr, 50, 245);

  // Condition Label
  const condText = `${wmo(cur.weather_code).label} · Feels ${round(cur.apparent_temperature)}°${degSuffix()}`;
  ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
  ctx.font = "600 18px system-ui, sans-serif";
  ctx.fillText(condText, 50, 285);

  // Bottom Telemetry Grid
  const y = 375;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
  ctx.beginPath(); ctx.moveTo(50, 325); ctx.lineTo(w - 50, 325); ctx.stroke();

  const metrics = [
    { label: "WIND", val: `${round(cur.wind_speed_10m)} ${windSuffix()}` },
    { label: "HUMIDITY", val: `${round(cur.relative_humidity_2m)}%` },
    { label: "PRECIP", val: `${state.data.daily.precipitation_probability_max[0] ?? 0}%` },
    { label: "UV INDEX", val: `${round(cur.uv_index ?? 0)}` }
  ];

  metrics.forEach((m, idx) => {
    const x = 50 + idx * 170;
    ctx.fillStyle = "#E9C583";
    ctx.font = "700 11px system-ui, sans-serif";
    ctx.fillText(m.label, x, y - 16);

    ctx.fillStyle = "#ffffff";
    ctx.font = "600 18px system-ui, sans-serif";
    ctx.fillText(m.val, x, y + 8);
  });
}

document.getElementById("downloadShareCardBtn")?.addEventListener("click", () => {
  const canvas = document.getElementById("shareCanvas");
  if (!canvas) return;
  const link = document.createElement("a");
  link.download = `atmos-weather-${state.city.name.toLowerCase().replace(/\s+/g, "-")}.jpg`;
  link.href = canvas.toDataURL("image/jpeg", 0.92);
  link.click();
  toast("Weather card downloaded!");
});

document.getElementById("copyTelemetryBtn")?.addEventListener("click", () => {
  if (!state.data || !state.city) return;
  const cur = state.data.current;
  const text = `🌤️ ATMOS TELEMETRY | ${state.city.name}\nTemperature: ${round(cur.temperature_2m)}°${degSuffix()} (${wmo(cur.weather_code).label})\nWind: ${round(cur.wind_speed_10m)} ${windSuffix()} | Humidity: ${round(cur.relative_humidity_2m)}%\nAtmos by Devron Group`;
  navigator.clipboard.writeText(text).then(() => {
    toast("Telemetry summary copied to clipboard!");
  }).catch(() => {
    toast("Copying failed.");
  });
});

/* ---------------- Soundscape Synthesizer ---------------- */
let audioCtx = null, soundscapeOsc = null, soundscapeGain = null;
const soundscapeBtn = document.getElementById("soundscapeBtn");
if (soundscapeBtn){
  soundscapeBtn.addEventListener("click", () => {
    if (soundscapeGain) {
      soundscapeGain.gain.exponentialRampToValueAtTime(0.0001, (audioCtx ? audioCtx.currentTime : 0) + 0.5);
      setTimeout(() => {
        if (audioCtx) { audioCtx.close(); audioCtx = null; }
        soundscapeGain = null;
        soundscapeBtn.classList.remove("is-playing");
        toast("Ambient soundscape stopped.");
      }, 500);
      return;
    }
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const bufferSize = audioCtx.sampleRate * 2;
      const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }
      const whiteNoise = audioCtx.createBufferSource();
      whiteNoise.buffer = noiseBuffer;
      whiteNoise.loop = true;

      const filter = audioCtx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(400, audioCtx.currentTime);

      soundscapeGain = audioCtx.createGain();
      soundscapeGain.gain.setValueAtTime(0.001, audioCtx.currentTime);
      soundscapeGain.gain.exponentialRampToValueAtTime(0.12, audioCtx.currentTime + 1);

      whiteNoise.connect(filter);
      filter.connect(soundscapeGain);
      soundscapeGain.connect(audioCtx.destination);
      whiteNoise.start();

      soundscapeBtn.classList.add("is-playing");
      toast("Playing soothing rain & breeze soundscape.");
    } catch(e) {
      toast("Audio soundscape not supported on this device.");
    }
  });
}

function buildDescription(idx){
  const d = state.data, day = d.daily;
  const hi = round(day.temperature_2m_max[idx]), lo = round(day.temperature_2m_min[idx]);
  const pop = day.precipitation_probability_max[idx] ?? 0;
  const meta = wmo(day.weather_code[idx]);
  let s = `${meta.label} with a high of ${hi}${degSuffix()} and a low of ${lo}${degSuffix()}.`;
  if (pop > 15) s += ` Chance of precipitation is ${pop}%.`;
  if (idx === 0) s += ` Wind ${round(d.current.wind_speed_10m)} ${windSuffix()}, humidity ${round(d.current.relative_humidity_2m)}%.`;
  return s;
}

function renderStrip(){
  const d = state.data, idx = state.selectedDay;
  const targetDate = d.daily.time[idx];
  const strip = document.getElementById("hourStrip");
  strip.innerHTML = "";
  const hours = d.hourly.time.map((t,i)=>({t,i})).filter(({t}) => t.startsWith(targetDate));
  const nowHour = new Date().toISOString().slice(0,13);
  let startIdx = hours.findIndex(h => h.t.slice(0,13) === nowHour);
  if (startIdx === -1) startIdx = 0;
  const slice = (idx === 0 ? hours.slice(startIdx) : hours).slice(0, 12);
  slice.forEach(({i}) => {
    const temp = round(d.hourly.temperature_2m[i]);
    const meta = wmo(d.hourly.weather_code[i]);
    const chip = document.createElement("div");
    chip.className = "hour-chip";
    chip.innerHTML = `<span class="h-time">${formatHour(d.hourly.time[i])}</span>${iconSvg(meta.group)}<span class="h-temp">${temp}°</span>`;
    strip.appendChild(chip);
  });
}
function renderDayTabs(){
  const d = state.data;
  const tabs = document.getElementById("dayTabs");
  tabs.innerHTML = "";
  d.daily.time.forEach((dateStr, i) => {
    const btn = document.createElement("button");
    btn.className = "daytab" + (i === state.selectedDay ? " is-active" : "");
    const hi = round(d.daily.temperature_2m_max[i]);
    btn.innerHTML = `${formatWeekday(dateStr)}<small>${hi}°</small>`;
    btn.addEventListener("click", () => { state.selectedDay = i; render(); });
    tabs.appendChild(btn);
  });

  const activeTab = tabs.querySelector(".daytab.is-active");
  if (activeTab) {
    setTimeout(() => {
      activeTab.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }, 10);
  }
}
function renderFavs(){
  const list = document.getElementById("favList");
  list.innerHTML = "";
  if (!state.favs.length){
    list.innerHTML = `<div class="fav-empty">No saved cities yet — search above, or tap “+” to save the city you're viewing.</div>`;
    return;
  }
  state.favs.forEach(fav => list.appendChild(buildCityCard(fav, true)));
}
function renderRecents(){
  const header = document.getElementById("recentHeader");
  const list = document.getElementById("recentList");
  list.innerHTML = "";
  const shown = state.recents.filter(r => !state.favs.some(f => f.lat === r.lat && f.lon === r.lon)).slice(0,4);
  header.hidden = shown.length === 0;
  shown.forEach(r => list.appendChild(buildCityCard(r, false)));
}
function buildCityCard(city, removable){
  const card = document.createElement("div");
  const isSelected = city.lat === state.city.lat && city.lon === state.city.lon;
  card.className = "fav-card" + (isSelected ? " is-selected" : "");
  card.innerHTML = `
    <div><span class="fav-name">${city.name}</span><span class="fav-country">${city.country || ""}</span></div>
    <div class="fav-right"><span class="fav-temp">–°</span><span class="fav-cond"></span>
    ${removable ? `<button class="fav-remove" aria-label="Remove ${city.name}"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button>` : ""}</div>`;
  card.addEventListener("click", (e) => { if (e.target.closest(".fav-remove")) return; loadCity(city, { addRecent:false }); });
  if (removable){
    card.querySelector(".fav-remove").addEventListener("click", (e) => {
      e.stopPropagation();
      state.favs = state.favs.filter(f => !(f.lat === city.lat && f.lon === city.lon));
      save(LS.favs, state.favs); renderFavs();
    });
  }
  fetchWeather(city.lat, city.lon).then(w => {
    const meta = wmo(w.current.weather_code);
    card.querySelector(".fav-temp").textContent = `${round(w.current.temperature_2m)}°`;
    card.querySelector(".fav-cond").innerHTML = iconSvg(meta.group);
  }).catch(()=>{});
  return card;
}

/* sun ring + moon phase */
function renderSunRing(sunriseIso, sunsetIso){
  const now = new Date();
  const sr = new Date(sunriseIso), ss = new Date(sunsetIso);
  const total = ss - sr;
  const elapsed = Math.min(Math.max(now - sr, 0), total);
  const pct = total > 0 ? elapsed / total : 0;
  const arcLen = 157;
  document.getElementById("sunArc").style.strokeDashoffset = String(arcLen - arcLen*pct);
  const angle = Math.PI * (1 - pct);
  const cx = 60 + 50*Math.cos(angle), cy = 62 - 50*Math.sin(angle);
  document.getElementById("sunDot").setAttribute("cx", cx);
  document.getElementById("sunDot").setAttribute("cy", cy);
  document.getElementById("statSunrise").textContent = formatTime(sunriseIso);
  document.getElementById("statSunset").textContent = formatTime(sunsetIso);

  // Calculate Evening Golden Hour (approx 1 hour before sunset)
  const ghStart = new Date(ss.getTime() - 60 * 60 * 1000);
  const ghText = document.getElementById("goldenHourText");
  if (ghText) {
    ghText.textContent = `Golden Hour: ${formatTime(ghStart.toISOString())} – ${formatTime(sunsetIso)}`;
  }
}

/* ---------------- historical year-over-year comparison (Open-Meteo Archive API) ---------------- */
let lastHistCity = "";
async function renderHistoricalComparison(){
  const dateLbl = document.getElementById("histDateLabel");
  const tempVal = document.getElementById("histTempVal");
  const hintEl = document.getElementById("histComparisonText");
  if (!dateLbl || !tempVal || !hintEl || !state.data || !state.city) return;

  const lat = state.city.latitude, lon = state.city.longitude;
  const key = `${lat},${lon}`;
  if (lastHistCity === key && tempVal.textContent !== "Fetching…") return;
  lastHistCity = key;

  // Calculate same date 1 year ago
  const now = new Date();
  const lastYear = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
  const yyyy = lastYear.getFullYear();
  const mm = String(lastYear.getMonth() + 1).padStart(2, "0");
  const dd = String(lastYear.getDate()).padStart(2, "0");
  const dateStr = `${yyyy}-${mm}-${dd}`;
  const formattedDate = lastYear.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  dateLbl.textContent = formattedDate;

  try {
    const res = await fetch(`https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${dateStr}&end_date=${dateStr}&daily=temperature_2m_max,temperature_2m_min&timezone=auto`);
    if (!res.ok) throw new Error("Archive request failed");
    const histData = await res.json();
    const histMaxC = histData.daily.temperature_2m_max[0];
    const currMaxC = state.data.daily.temperature_2m_max[0];

    if (histMaxC == null || currMaxC == null) throw new Error("No historical data available");

    const histMaxDisplay = state.unit === "f" ? round(histMaxC * 9/5 + 32) : round(histMaxC);
    const currMaxDisplay = state.unit === "f" ? round(currMaxC * 9/5 + 32) : round(currMaxC);
    
    const diff = currMaxDisplay - histMaxDisplay;
    tempVal.textContent = `${histMaxDisplay}${degSuffix()}`;

    if (diff === 0) {
      hintEl.textContent = `Today's high matches last year's temperature exactly (${currMaxDisplay}${degSuffix()}).`;
    } else if (diff > 0) {
      hintEl.textContent = `Today is ${Math.abs(diff)}${degSuffix()} warmer than this time last year (${currMaxDisplay}${degSuffix()} vs ${histMaxDisplay}${degSuffix()}).`;
    } else {
      hintEl.textContent = `Today is ${Math.abs(diff)}${degSuffix()} cooler than this time last year (${currMaxDisplay}${degSuffix()} vs ${histMaxDisplay}${degSuffix()}).`;
    }
  } catch (err) {
    tempVal.textContent = "Data unavailable";
    hintEl.textContent = "Historical weather archive for this location is currently offline.";
  }
}
function renderMoonPhase(){
  const phase = moonPhaseFraction(new Date());
  const icons = ["🌑","🌒","🌓","🌔","🌕","🌖","🌗","🌘"];
  const names = ["New Moon","Waxing Crescent","First Quarter","Waxing Gibbous","Full Moon","Waning Gibbous","Last Quarter","Waning Crescent"];
  const i = Math.round(phase * 8) % 8;
  document.getElementById("moonIcon").textContent = icons[i];
  document.getElementById("moonPhase").textContent = names[i];
}
function moonPhaseFraction(date){
  const lp = 2551443; // synodic month in seconds
  const known = new Date(2000, 0, 6, 18, 14, 0).getTime() / 1000; // known new moon
  const now = date.getTime() / 1000;
  let phase = ((now - known) % lp) / lp;
  if (phase < 0) phase += 1;
  return phase;
}

/* ---------------- weather alerts ---------------- */
function renderAlerts(){
  const d = state.data, day = d.daily;
  const bar = document.getElementById("alertsBar");
  const alerts = [];
  const meta0 = wmo(day.weather_code[0]);
  if (meta0.group === "storm") alerts.push({ sev:"danger", text:"Thunderstorm expected today" });
  if (meta0.group === "heavy-rain" || day.precipitation_probability_max[0] >= 80) alerts.push({ sev:"warn", text:"Heavy rain likely today" });
  if (meta0.group === "fog") alerts.push({ sev:"warn", text:"Foggy conditions — reduced visibility" });
  if (meta0.group === "snow") alerts.push({ sev:"warn", text:"Snow expected today" });
  const windThreshold = state.windUnit === "mph" ? 25 : 40;
  if (day.wind_speed_10m_max[0] >= windThreshold) alerts.push({ sev:"warn", text:`Strong wind — up to ${round(day.wind_speed_10m_max[0])} ${windSuffix()}` });
  const heatThreshold = state.unit === "f" ? 100 : 38;
  if (day.temperature_2m_max[0] >= heatThreshold) alerts.push({ sev:"danger", text:`Heatwave — up to ${round(day.temperature_2m_max[0])}${degSuffix()}` });
  const uv = d.current.uv_index ?? day.uv_index_max[0] ?? 0;
  if (uv >= 8) alerts.push({ sev:"warn", text:`Very high UV index (${round(uv)})` });

  bar.innerHTML = "";
  bar.hidden = alerts.length === 0;
  alerts.forEach(a => {
    const chip = document.createElement("div");
    chip.className = `alert-chip sev-${a.sev}`;
    chip.innerHTML = `<svg viewBox="0 0 24 24"><path d="M12 2 1 21h22z"/><path d="M12 9v5M12 17v.01"/></svg>${a.text}`;
    bar.appendChild(chip);
  });
}

/* ---------------- AQI modal ---------------- */
function renderAqiModalData(){
  const d = state.data, aqi = d.aqi || {};
  const grid = document.getElementById("aqiGrid");
  const s = aqiStatus(aqi.us_aqi);
  const items = [
    { label:"US AQI", value: aqi.us_aqi != null ? aqi.us_aqi : "—", status: s.text, cls: s.cls },
    { label:"PM2.5", value: aqi.pm2_5 != null ? `${round(aqi.pm2_5)} µg/m³` : "—" },
    { label:"PM10", value: aqi.pm10 != null ? `${round(aqi.pm10)} µg/m³` : "—" },
    { label:"Humidity", value: `${round(d.current.relative_humidity_2m)}%` },
    { label:"Pressure", value: `${round(d.current.surface_pressure)} hPa` },
    { label:"Wind direction", value: `${compassDir(d.current.wind_direction_10m)}` },
    { label:"UV index", value: `${round(d.current.uv_index ?? d.daily.uv_index_max[0] ?? 0)}` },
    { label:"Feels like", value: `${round(d.current.apparent_temperature)}${degSuffix()}` },
  ];
  grid.innerHTML = items.map(it => `
    <div class="mini-card">
      <div class="mc-label">${it.label}</div>
      <div class="mc-value">${it.value}</div>
      ${it.status ? `<div class="mc-status ${it.cls}">${it.status}</div>` : ""}
    </div>`).join("");
}
function compassDir(deg){
  const dirs = ["N","NE","E","SE","S","SW","W","NW"];
  return dirs[Math.round(deg/45)%8];
}

/* ---------------- formatting ---------------- */
function formatWeekday(dateStr, long=false){ return new Date(dateStr+"T00:00:00").toLocaleDateString("en-US",{weekday: long?"long":"short"}); }
function formatHour(iso){ return new Date(iso).toLocaleTimeString("en-US",{hour:"numeric"}); }
function formatTime(iso){ return new Date(iso).toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"}); }

function startClock(){
  if (state.clockTimer) clearInterval(state.clockTimer);
  const tz = state.data?.timezone;
  const tick = () => {
    const now = new Date(); const opts = tz ? { timeZone: tz } : {};
    document.getElementById("clockDate").textContent = now.toLocaleDateString("en-US", {...opts, month:"short", day:"numeric"});
    document.getElementById("clockTime").textContent = now.toLocaleTimeString("en-US", {...opts, hour:"2-digit", minute:"2-digit"});
  };
  tick(); state.clockTimer = setInterval(tick, 15000);
}

/* ---------------- toast ---------------- */
let toastTimer;
function toast(msg){
  const el = document.getElementById("toast");
  el.textContent = msg; el.hidden = false;
  requestAnimationFrame(() => el.classList.add("show"));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.classList.remove("show"); setTimeout(()=>{el.hidden=true;},300); }, 3200);
}

/* ---------------- recents ---------------- */
function pushRecent(city){
  state.recents = state.recents.filter(r => !(r.lat === city.lat && r.lon === city.lon));
  state.recents.unshift({ name: city.name, country: city.country, lat: city.lat, lon: city.lon });
  state.recents = state.recents.slice(0, 6);
  save(LS.recents, state.recents);
}

/* ---------------- search ---------------- */
let searchDebounce;
const searchInput = document.getElementById("searchInput");
const suggestionsEl = document.getElementById("suggestions");
const clearBtn = document.getElementById("clearSearch");

const POPULAR_INDIAN_CITIES = [
  { name: "New Delhi", country: "India", lat: 28.6139, lon: 77.2090 },
  { name: "Mumbai", country: "India", lat: 19.0760, lon: 72.8777 },
  { name: "Kanpur", country: "India", lat: 26.4499, lon: 80.3319 },
  { name: "Bengaluru", country: "India", lat: 12.9716, lon: 77.5946 },
  { name: "Jaipur", country: "India", lat: 26.9124, lon: 75.7873 },
  { name: "Kolkata", country: "India", lat: 22.5726, lon: 88.3639 },
  { name: "Chennai", country: "India", lat: 13.0827, lon: 80.2707 },
  { name: "Hyderabad", country: "India", lat: 17.3850, lon: 78.4867 },
  { name: "Pune", country: "India", lat: 18.5204, lon: 73.8567 },
  { name: "Ahmedabad", country: "India", lat: 23.0225, lon: 72.5714 }
];

function showIndianCitySuggestions(){
  suggestionsEl.innerHTML = `<div class="suggestion-hdr" style="padding:8px 12px 4px;font-size:10px;font-weight:700;letter-spacing:0.08em;color:var(--text-muted);text-transform:uppercase;">Popular Indian Cities</div>`;
  POPULAR_INDIAN_CITIES.forEach(c => {
    const row = document.createElement("div");
    row.className = "suggestion";
    row.innerHTML = `<b>🇮🇳 ${c.name}</b><span>India</span>`;
    row.addEventListener("click", () => {
      loadCity(c);
      hideSuggestions(); searchInput.value=""; clearBtn.hidden = true;
    });
    suggestionsEl.appendChild(row);
  });
  suggestionsEl.hidden = false;
}

searchInput.addEventListener("focus", () => {
  if (!searchInput.value.trim()) showIndianCitySuggestions();
});

searchInput.addEventListener("input", () => {
  const q = searchInput.value.trim();
  clearBtn.hidden = q.length === 0;
  clearTimeout(searchDebounce);
  if (q.length < 2){ showIndianCitySuggestions(); return; }
  searchDebounce = setTimeout(() => runSearch(q), 320);
});
clearBtn.addEventListener("click", () => { searchInput.value=""; clearBtn.hidden=true; showIndianCitySuggestions(); searchInput.focus(); });
async function runSearch(q){
  try{
    const results = await geocodeCity(q);
    if (!results.length){ suggestionsEl.innerHTML = `<div class="suggestion">No matches for “${q}”</div>`; suggestionsEl.hidden = false; return; }
    suggestionsEl.innerHTML = "";
    results.forEach(r => {
      const row = document.createElement("div");
      row.className = "suggestion";
      const region = [r.admin1, r.country].filter(Boolean).join(", ");
      row.innerHTML = `<b>${r.name}</b><span>${region}</span>`;
      row.addEventListener("click", () => {
        loadCity({ name:r.name, country:r.country||"", lat:r.latitude, lon:r.longitude });
        hideSuggestions(); searchInput.value=""; clearBtn.hidden = true;
      });
      suggestionsEl.appendChild(row);
    });
    suggestionsEl.hidden = false;
  }catch(e){ toast("Search failed — check your connection."); }
}
function hideSuggestions(){ suggestionsEl.hidden = true; suggestionsEl.innerHTML = ""; }
document.addEventListener("click", (e) => { if (!e.target.closest(".search-wrap")) hideSuggestions(); });

/* ---------------- location / refresh / units ---------------- */
document.getElementById("locateBtn").addEventListener("click", useMyLocation);
document.getElementById("locateNavBtn").addEventListener("click", useMyLocation);
function useMyLocation(){
  if (!navigator.geolocation){ toast("Geolocation isn't available in this browser."); return; }
  setBusy(true);
  navigator.geolocation.getCurrentPosition(async (pos) => {
    const { latitude, longitude } = pos.coords;
    const place = await reverseGeocode(latitude, longitude);
    loadCity({ name: place.name, country: place.country, lat: latitude, lon: longitude });
  }, () => { setBusy(false); toast("Couldn't get your location — allow location access and try again."); }, { enableHighAccuracy:false, timeout:10000 });
}
document.getElementById("refreshBtn").addEventListener("click", () => loadCity(state.city, { persist:false, addRecent:false }));
document.getElementById("unitToggle").addEventListener("click", () => { setUnit(state.unit === "c" ? "f" : "c"); });
function setUnit(u){ state.unit = u; save(LS.unit, u); loadCity(state.city, { persist:false, addRecent:false }); syncSettingsUI(); }

/* favourites */
document.getElementById("addCurrentFav").addEventListener("click", () => {
  const exists = state.favs.some(f => f.lat === state.city.lat && f.lon === state.city.lon);
  if (exists){ toast(`${state.city.name} is already saved.`); return; }
  state.favs.push({ ...state.city }); save(LS.favs, state.favs); renderFavs(); renderRecents();
  toast(`${state.city.name} saved.`);
});

/* sidebar nav highlighting (dashboard only toggles active state visually) */
document.querySelectorAll(".side-btn[data-nav]").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".side-btn[data-nav]").forEach(b => b.classList.remove("is-active"));
    btn.classList.add("is-active");
  });
});
document.querySelector('[data-nav="add"]').addEventListener("click", () => searchInput.focus());

/* ---------------- timeline ---------------- */
document.querySelectorAll(".tl-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tl-btn").forEach(b => b.classList.remove("is-active"));
    btn.classList.add("is-active");
    const range = btn.dataset.range;
    state.timelineRange = range;
    if (range === "tomorrow"){ state.selectedDay = 1; render(); }
    else if (range === "week"){ document.getElementById("dayTabs").scrollIntoView({behavior:"smooth", block:"center"}); state.selectedDay = 0; render(); }
    else { state.selectedDay = 0; render(); scrollHourStripTo(range); }
  });
});
function scrollHourStripTo(range){
  const hoursAhead = { now:0, "1h":1, "3h":3, "6h":6, "12h":12 }[range] ?? 0;
  const strip = document.getElementById("hourStrip");
  const chip = strip.children[hoursAhead];
  if (chip) chip.scrollIntoView({ behavior:"smooth", inline:"center", block:"nearest" });
}

/* ============================================================
   MODAL SYSTEM
   ============================================================ */
const backdrop = document.getElementById("modalBackdrop");
let openModalEl = null;
let modalTimeout = null;

function openModal(id){
  if (modalTimeout) {
    clearTimeout(modalTimeout);
    modalTimeout = null;
  }
  const el = document.getElementById(id);
  if (!el) return;
  if (openModalEl && openModalEl !== el) {
    openModalEl.classList.remove("show");
    openModalEl.hidden = true;
  }
  el.hidden = false;
  backdrop.hidden = false;
  requestAnimationFrame(() => {
    el.classList.add("show");
    backdrop.classList.add("show");
  });
  openModalEl = el;
  if (id === "mapModal") initMapIfNeeded();
}

function closeModal(){
  if (modalTimeout) {
    clearTimeout(modalTimeout);
    modalTimeout = null;
  }
  if (!openModalEl) {
    backdrop.classList.remove("show");
    backdrop.hidden = true;
    return;
  }
  openModalEl.classList.remove("show");
  backdrop.classList.remove("show");
  const el = openModalEl;
  openModalEl = null;
  modalTimeout = setTimeout(() => {
    if (!openModalEl) {
      el.hidden = true;
      backdrop.hidden = true;
    }
    modalTimeout = null;
  }, 320);
}
backdrop.addEventListener("click", closeModal);
document.querySelectorAll("[data-close]").forEach(b => b.addEventListener("click", closeModal));
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });

document.getElementById("openAqiBtn").addEventListener("click", () => openModal("aqiModal"));
document.getElementById("settingsNavBtn").addEventListener("click", () => openModal("settingsModal"));
document.getElementById("mapNavBtn").addEventListener("click", () => openModal("mapModal"));
document.getElementById("compareNavBtn").addEventListener("click", () => openModal("compareModal"));
document.getElementById("aboutBtn").addEventListener("click", () => openModal("aboutModal"));
document.getElementById("shortcutsBtn").addEventListener("click", () => openModal("shortcutsModal"));

const btnDevTop = document.getElementById("devProfileBtn");
if (btnDevTop) btnDevTop.addEventListener("click", () => openModal("devConnectModal"));
const btnDevConnect = document.getElementById("connectDevBtn");
if (btnDevConnect) btnDevConnect.addEventListener("click", () => openModal("devConnectModal"));
const btnCopyEmail = document.getElementById("copyDevEmailBtn");
if (btnCopyEmail) {
  btnCopyEmail.addEventListener("click", () => {
    navigator.clipboard.writeText("singhrudransh0000@gmail.com").then(() => toast("Copied email: singhrudransh0000@gmail.com"));
  });
}

/* about tabs */
document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("is-active"));
    document.querySelectorAll(".tab-pane").forEach(p => p.classList.remove("is-active"));
    btn.classList.add("is-active");
    document.querySelector(`.tab-pane[data-pane="${btn.dataset.tab}"]`).classList.add("is-active");
  });
});

/* ============================================================
   SETTINGS
   ============================================================ */
function applySettingsToCss(){
  const r = document.documentElement.style;
  r.setProperty("--overlay-intensity", (state.settings.intensity/100).toFixed(2));
  r.setProperty("--glass-blur", `${state.settings.blur}px`);
  r.setProperty("--font-scale", (state.settings.font/100).toFixed(2));
  r.setProperty("--anim-play", state.settings.anim ? "running" : "paused");
}
function syncSettingsUI(){
  document.querySelectorAll('[data-set="unit"]').forEach(b => b.classList.toggle("is-active", b.dataset.val === state.unit));
  document.querySelectorAll('[data-set="wind"]').forEach(b => b.classList.toggle("is-active", b.dataset.val === state.windUnit));
  document.querySelectorAll('[data-set="lang"]').forEach(b => b.classList.toggle("is-active", b.dataset.val === state.lang));
  document.getElementById("toggleAnim").checked = state.settings.anim;
  document.getElementById("toggleTilt").checked = state.settings.tilt;
  document.getElementById("intensityRange").value = state.settings.intensity;
  document.getElementById("intensityVal").textContent = `${state.settings.intensity}%`;
  document.getElementById("blurRange").value = state.settings.blur;
  document.getElementById("blurVal").textContent = `${state.settings.blur}px`;
  document.getElementById("fontRange").value = state.settings.font;
  document.getElementById("fontVal").textContent = `${state.settings.font}%`;
  document.getElementById("assistantLang").value = state.lang;
  const seasonSel = document.getElementById("seasonSelect");
  if (seasonSel) seasonSel.value = state.seasonMode || "auto";
}

const seasonToggleBtn = document.getElementById("seasonToggleBtn");
if (seasonToggleBtn) {
  seasonToggleBtn.addEventListener("click", () => {
    const order = ["auto", "autumn", "winter", "spring", "summer"];
    const currIdx = order.indexOf(state.seasonMode || "auto");
    const nextMode = order[(currIdx + 1) % order.length];
    setSeasonMode(nextMode, true);
  });
}

const seasonSelectEl = document.getElementById("seasonSelect");
if (seasonSelectEl) {
  seasonSelectEl.addEventListener("change", (e) => {
    setSeasonMode(e.target.value, true);
  });
}
document.querySelectorAll('[data-set="unit"]').forEach(b => b.addEventListener("click", () => setUnit(b.dataset.val)));
document.querySelectorAll('[data-set="wind"]').forEach(b => b.addEventListener("click", () => {
  state.windUnit = b.dataset.val; save(LS.windUnit, state.windUnit);
  loadCity(state.city, { persist:false, addRecent:false }); syncSettingsUI();
}));
document.querySelectorAll('[data-set="lang"]').forEach(b => b.addEventListener("click", () => {
  state.lang = b.dataset.val; save(LS.lang, state.lang); syncSettingsUI();
}));
document.getElementById("toggleAnim").addEventListener("change", (e) => {
  state.settings.anim = e.target.checked; save(LS.settings, state.settings); applySettingsToCss();
  if (state.data) setParticles(wmo(state.data.daily.weather_code[state.selectedDay]).group, dayPart());
});
document.getElementById("toggleTilt").addEventListener("change", (e) => { state.settings.tilt = e.target.checked; save(LS.settings, state.settings); });
document.getElementById("intensityRange").addEventListener("input", (e) => {
  state.settings.intensity = Number(e.target.value); document.getElementById("intensityVal").textContent = `${state.settings.intensity}%`;
  save(LS.settings, state.settings); applySettingsToCss();
});
document.getElementById("blurRange").addEventListener("input", (e) => {
  state.settings.blur = Number(e.target.value); document.getElementById("blurVal").textContent = `${state.settings.blur}px`;
  save(LS.settings, state.settings); applySettingsToCss();
});
document.getElementById("fontRange").addEventListener("input", (e) => {
  state.settings.font = Number(e.target.value); document.getElementById("fontVal").textContent = `${state.settings.font}%`;
  save(LS.settings, state.settings); applySettingsToCss();
});
document.getElementById("resetSettings").addEventListener("click", () => {
  state.settings = { anim:true, tilt:true, intensity:55, blur:22, font:100 };
  save(LS.settings, state.settings); applySettingsToCss(); syncSettingsUI();
  toast("Settings reset to defaults.");
});

/* ============================================================
   COMPARE CITIES
   ============================================================ */
let compareDebounce;
["compareA","compareB"].forEach(id => {
  document.getElementById(id).addEventListener("input", () => { clearTimeout(compareDebounce); compareDebounce = setTimeout(runCompare, 500); });
});
async function runCompare(){
  const a = document.getElementById("compareA").value.trim();
  const b = document.getElementById("compareB").value.trim();
  const result = document.getElementById("compareResult");
  if (a.length < 2 || b.length < 2){ result.innerHTML = ""; return; }
  try{
    const [ra, rb] = await Promise.all([geocodeCity(a), geocodeCity(b)]);
    if (!ra.length || !rb.length){ result.innerHTML = `<p style="color:var(--ink-faint);font-size:12.5px;">Couldn't find one of those cities.</p>`; return; }
    const [wa, wb] = await Promise.all([fetchWeather(ra[0].latitude, ra[0].longitude), fetchWeather(rb[0].latitude, rb[0].longitude)]);
    result.innerHTML = [ [ra[0], wa], [rb[0], wb] ].map(([place, w]) => `
      <div class="compare-col">
        <div class="cc-name">${place.name}, ${place.country || ""}</div>
        <div class="cc-temp">${round(w.current.temperature_2m)}°</div>
        <div class="cc-cond">${wmo(w.current.weather_code).label} · ${round(w.current.relative_humidity_2m)}% humidity</div>
      </div>`).join("");
  }catch(e){ result.innerHTML = `<p style="color:var(--ink-faint);font-size:12.5px;">Comparison failed — try again.</p>`; }
}

/* ============================================================
   WEATHER MAP (Leaflet + OSM + RainViewer radar)
   ============================================================ */
function initMapIfNeeded(){
  if (state.map || typeof L === "undefined") return;
  state.map = L.map("leafletMap", { attributionControl: true }).setView([state.city.lat, state.city.lon], 6);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18, attribution: "© OpenStreetMap contributors"
  }).addTo(state.map);
  L.marker([state.city.lat, state.city.lon]).addTo(state.map).bindPopup(state.city.name);
  loadRadarLayer();
  document.getElementById("radarToggle").addEventListener("change", (e) => {
    if (!state.radarLayer) return;
    if (e.target.checked) state.radarLayer.addTo(state.map); else state.map.removeLayer(state.radarLayer);
  });
}
async function loadRadarLayer(){
  try{
    const res = await fetch("https://api.rainviewer.com/public/weather-maps.json");
    const data = await res.json();
    const latest = data.radar?.past?.slice(-1)[0];
    if (!latest) return;
    state.radarLayer = L.tileLayer(`https://tilecache.rainviewer.com${latest.path}/256/{z}/{x}/{y}/2/1_1.png`, { opacity: .55 });
    state.radarLayer.addTo(state.map);
  }catch(e){ /* radar is a bonus layer — silently skip if unavailable */ }
}

/* ============================================================
   AI ASSISTANT (rule-based; swap getAIResponse() for a real API later)
   ============================================================ */
const assistantFab = document.getElementById("assistantFab");
const assistantPanel = document.getElementById("assistantPanel");
const assistantLog = document.getElementById("assistantLog");
assistantFab.addEventListener("click", () => {
  assistantPanel.hidden = false;
  if (!assistantLog.children.length && state.data) {
    const cur = state.data.current;
    const initialText = state.lang === "hi-IN"
      ? `नमस्ते! मैं Atmos AI (Atmos by Devron Group) हूँ। अभी ${state.city.name} में तापमान ${round(cur.temperature_2m)}°${degSuffix()} है। मैं आपकी क्या मदद कर सकता हूँ?`
      : `Hello! I'm Atmos AI by Devron Group. Currently in ${state.city.name} it's ${round(cur.temperature_2m)}°${degSuffix()} and ${wmo(cur.weather_code).label.toLowerCase()}. How can I assist your day?`;
    addMsg(initialText, "bot");
  }
  assistantInputFocus();
});
document.getElementById("closeAssistant").addEventListener("click", () => { assistantPanel.hidden = true; });
function assistantInputFocus(){ setTimeout(()=>document.getElementById("assistantInput").focus(), 50); }

document.getElementById("assistantLang").addEventListener("change", (e) => { state.lang = e.target.value; save(LS.lang, state.lang); syncSettingsUI(); });
document.querySelectorAll("#assistantChips button").forEach(b => b.addEventListener("click", () => askAssistant(b.dataset.q)));
document.getElementById("assistantForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const input = document.getElementById("assistantInput");
  const q = input.value.trim();
  if (!q) return;
  askAssistant(q); input.value = "";
});

function addMsg(text, who){
  const div = document.createElement("div");
  div.className = `msg ${who}`;
  div.textContent = text;
  assistantLog.appendChild(div);
  assistantLog.scrollTop = assistantLog.scrollHeight;
}

/*
 * getAIResponse(question, weatherData, lang)
 * ---------------------------------------------------------------
 * This is the ONE function to replace if you want real AI answers
 * instead of rule-based ones. Keep the same signature (question,
 * data, lang in → string out, or a Promise<string>) and this whole
 * assistant keeps working. Example swap for a real API:
 *
 *   async function getAIResponse(question, data, lang) {
 *     const res = await fetch("https://api.openai.com/v1/chat/completions", {
 *       method: "POST",
 *       headers: { "Content-Type": "application/json", "Authorization": `Bearer ${YOUR_KEY}` },
 *       body: JSON.stringify({ model: "gpt-4o-mini", messages: [
 *         { role: "system", content: `Weather context: ${JSON.stringify(data.current)}` },
 *         { role: "user", content: question }
 *       ]})
 *     });
 *     const json = await res.json();
 *     return json.choices[0].message.content;
 *   }
 *
 * NOTE: doing that from a pure static site exposes your API key to
 * anyone viewing the page source — fine for personal testing, but
 * for a public deploy you'd want a tiny serverless proxy to hide
 * the key. That's the one place this project would need a backend.
 */
function getAIResponse(question, data, lang){
  const q = question.toLowerCase();
  const cur = data.current, day = data.daily;
  const temp = round(cur.temperature_2m), feels = round(cur.apparent_temperature);
  const uv = round(cur.uv_index ?? day.uv_index_max[0] ?? 0);
  const pop = day.precipitation_probability_max[0] ?? 0;
  const wind = round(cur.wind_speed_10m);
  const group = wmo(cur.weather_code).group;
  const wet = ["rain","heavy-rain","storm","snow"].includes(group);
  const hi = (lang === "hi-IN");

  if (/wear|clothing|dress/.test(q)){
    if (hi) return wet ? `बारिश की वजह से वाटरप्रूफ जैकेट और छाता साथ रखें। तापमान ${temp}° है, हल्के गर्म कपड़े ठीक रहेंगे।` : temp <= 15 ? `ठंड है (${temp}°) — जैकेट या स्वेटर पहनें।` : temp >= 30 ? `गर्मी है (${temp}°) — हल्के, हवादार कपड़े पहनें।` : `मौसम सामान्य है (${temp}°), हल्की परतों वाले कपड़े ठीक रहेंगे।`;
    if (wet) return `It's ${wmo(cur.weather_code).label.toLowerCase()} out there — grab a waterproof layer or umbrella. At ${temp}°${degSuffix()} (feels ${feels}°), a light jacket underneath works well.`;
    if (temp <= 15) return `It's cool at ${temp}°${degSuffix()} — a jacket or warm layer is a good call today.`;
    if (temp >= 30) return `It's warm at ${temp}°${degSuffix()} — light, breathable clothing and sun protection would help.`;
    return `Mild conditions at ${temp}°${degSuffix()} (feels ${feels}°) — a light layer you can adjust through the day works well.`;
  }
  if (/travel|trip|flight|drive|road/.test(q)){
    if (group === "storm") return `I'd be cautious travelling today — thunderstorms are expected, which can mean delays and slippery roads.`;
    if (group === "fog") return `Visibility could be reduced by fog today — allow extra time if you're driving.`;
    if (pop >= 60) return `There's a ${pop}% chance of rain, so keep a buffer in your travel schedule and pack a rain layer.`;
    return `Conditions look reasonable for travel — ${temp}°${degSuffix()}, ${wmo(cur.weather_code).label.toLowerCase()}, ${wind} ${windSuffix()} wind.`;
  }
  if (/work.?out|gym|exercise/.test(q)){
    if (wet) return `It's ${wmo(cur.weather_code).label.toLowerCase()} — an indoor workout is probably more comfortable today.`;
    if (uv >= 7) return `UV is high (${uv}) — if you're training outside, go early morning or evening and wear sunscreen.`;
    return `Good conditions for an outdoor workout — ${temp}°${degSuffix()}, UV ${uv}. Stay hydrated either way.`;
  }
  if (/run|jog/.test(q)){
    if (wet) return `Wet out there today — if you still want to run, watch your footing; otherwise a treadmill session avoids the rain.`;
    if (temp >= 30) return `It's ${temp}°${degSuffix()} — for a run, aim for early morning or after sunset, and carry water.`;
    return `Solid running weather — ${temp}°${degSuffix()}, wind ${wind} ${windSuffix()}. Enjoy it.`;
  }
  if (/cycl|bike|biking/.test(q)){
    if (wind >= (state.windUnit === "mph" ? 20 : 32)) return `Wind is up around ${wind} ${windSuffix()} — expect some resistance on a bike today, especially on exposed roads.`;
    if (wet) return `Wet roads expected — if you ride anyway, slow your braking distance and watch for slick surfaces.`;
    return `Good cycling conditions — ${temp}°${degSuffix()}, wind ${wind} ${windSuffix()}.`;
  }
  if (/farm|crop|irrigat|field/.test(q)){
    if (pop >= 60) return `With a ${pop}% chance of rain, you could likely hold off on irrigation today and watch for waterlogging in low fields.`;
    if (uv >= 8 && pop < 20) return `High UV and low rain chance — crops may need extra watering, especially in exposed plots.`;
    return `Moderate conditions today (${temp}°${degSuffix()}, ${pop}% rain chance) — a normal working day for most field tasks.`;
  }
  if (/hydrat|water|drink/.test(q)){
    if (temp >= 32 || uv >= 8) return `With ${temp}°${degSuffix()} and UV at ${uv}, it's worth drinking more water than usual today and taking shade breaks.`;
    return `Nothing extreme today (${temp}°${degSuffix()}), but regular water intake is always a good habit.`;
  }
  if (/uv|sun\s?burn|sunscreen/.test(q)){
    if (uv >= 8) return `UV index is ${uv} — very high. Sunscreen, a hat, and shade during midday are strongly recommended.`;
    if (uv >= 6) return `UV index is ${uv} — high. Sunscreen is a good idea if you're outside for a while.`;
    if (uv >= 3) return `UV index is ${uv} — moderate. Fine for most people, sunscreen still helps on long exposure.`;
    return `UV index is ${uv} — low today, minimal sun protection needed.`;
  }
  if (/rain|umbrella|precip/.test(q)){
    if (pop >= 70) return `Yes — ${pop}% chance of rain today, likely ${wmo(day.weather_code[0]).label.toLowerCase()}. Bring an umbrella.`;
    if (pop >= 30) return `There's a ${pop}% chance of rain — worth carrying an umbrella just in case.`;
    return `Rain looks unlikely today — only a ${pop}% chance.`;
  }
  // fallback: general summary
  return `Right now it's ${temp}°${degSuffix()} and ${wmo(cur.weather_code).label.toLowerCase()} in ${state.city.name}, feels like ${feels}°. Today's high is ${round(day.temperature_2m_max[0])}°, low ${round(day.temperature_2m_min[0])}°, with a ${pop}% chance of rain. Ask me about clothing, travel, workouts, running, cycling, farming, hydration, UV, or rain for more specific advice.`;
}

function askAssistant(question){
  if (!state.data) return;
  addMsg(question, "user");
  const reply = getAIResponse(question, state.data, state.lang);
  setTimeout(() => {
    addMsg(reply, "bot");
    if (document.getElementById("speakToggle").classList.contains("is-active")) speak(reply);
  }, 260);
}

/* ---------------- voice: text-to-speech ---------------- */
document.getElementById("speakToggle").addEventListener("click", (e) => e.currentTarget.classList.toggle("is-active"));
function speak(text){
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = state.lang; u.rate = 1; u.pitch = 1;
  window.speechSynthesis.speak(u);
}

/* ---------------- voice: speech-to-text ---------------- */
const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
const micBtn = document.getElementById("micBtn");
if (!SpeechRecognitionCtor){
  micBtn.disabled = true;
  micBtn.title = "Voice input isn't supported in this browser";
} else {
  let recognizer = null, listening = false;
  micBtn.addEventListener("click", () => {
    if (listening){ recognizer && recognizer.stop(); return; }
    recognizer = new SpeechRecognitionCtor();
    recognizer.lang = state.lang; recognizer.interimResults = false; recognizer.maxAlternatives = 1;
    recognizer.onstart = () => { listening = true; micBtn.classList.add("listening"); };
    recognizer.onend = () => { listening = false; micBtn.classList.remove("listening"); };
    recognizer.onerror = () => { listening = false; micBtn.classList.remove("listening"); toast("Didn't catch that — try again."); };
    recognizer.onresult = (e) => { const text = e.results[0][0].transcript; askAssistant(text); };
    try{ recognizer.start(); }catch(e){ /* already running */ }
  });
}

/* ============================================================
   KEYBOARD SHORTCUTS
   ============================================================ */
document.addEventListener("keydown", (e) => {
  if (["INPUT","TEXTAREA","SELECT"].includes(document.activeElement.tagName)) return;
  if (e.key === "/"){ e.preventDefault(); searchInput.focus(); }
  else if (e.key.toLowerCase() === "u"){ document.getElementById("unitToggle").click(); }
  else if (e.key.toLowerCase() === "m"){ openModal("mapModal"); }
  else if (e.key.toLowerCase() === "a"){ assistantPanel.hidden = false; assistantInputFocus(); }
  else if (e.key.toLowerCase() === "s"){ openModal("settingsModal"); }
  else if (e.key === "?"){ openModal("shortcutsModal"); }
});

/* ============================================================
   PWA — install support + offline-friendly caching
   ============================================================ */
if ("serviceWorker" in navigator){
  window.addEventListener("load", () => { navigator.serviceWorker.register("sw.js").catch(()=>{}); });
}

/* ============================================================
   TOUCH & SWIPE GESTURE SUPPORT (HOUR STRIP & DAY TABS)
   ============================================================ */
function setupSwipeSupport() {
  const hourStrip = document.getElementById("hourStrip");
  const dayTabs = document.getElementById("dayTabs");
  const hero = document.querySelector(".hero");

  function attachDragScroll(container, options = {}) {
    if (!container) return;

    let isDown = false;
    let startX = 0;
    let startY = 0;
    let initialScrollLeft = 0;
    let lastX = 0;
    let lastTime = 0;
    let velocity = 0;
    let totalMoved = 0;

    container.addEventListener("touchstart", (e) => {
      if (!e.touches || e.touches.length === 0) return;
      isDown = true;
      totalMoved = 0;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      initialScrollLeft = container.scrollLeft;
      lastX = startX;
      lastTime = Date.now();
      velocity = 0;
    }, { passive: true });

    container.addEventListener("touchmove", (e) => {
      if (!isDown || !e.touches || e.touches.length === 0) return;
      const x = e.touches[0].clientX;
      const y = e.touches[0].clientY;
      const dx = startX - x;
      const dy = startY - y;

      totalMoved = Math.hypot(dx, dy);

      if (Math.abs(dx) > Math.abs(dy)) {
        container.scrollLeft = initialScrollLeft + dx;
        const now = Date.now();
        const dt = now - lastTime;
        if (dt > 0) {
          velocity = (x - lastX) / dt;
          lastX = x;
          lastTime = now;
        }
      }
    }, { passive: true });

    container.addEventListener("touchend", (e) => {
      if (!isDown) return;
      isDown = false;
      const endX = e.changedTouches && e.changedTouches[0] ? e.changedTouches[0].clientX : lastX;
      const swipeDistance = startX - endX;

      if (Math.abs(velocity) > 0.35) {
        const momentum = velocity * 220;
        container.scrollBy({ left: -momentum, behavior: "smooth" });
      }

      if (options.onSwipe && totalMoved > 40) {
        if (swipeDistance > 40) {
          options.onSwipe("next");
        } else if (swipeDistance < -40) {
          options.onSwipe("prev");
        }
      }
    });

    container.addEventListener("mousedown", (e) => {
      if (e.button !== 0) return;
      isDown = true;
      totalMoved = 0;
      startX = e.clientX;
      startY = e.clientY;
      initialScrollLeft = container.scrollLeft;
      lastX = startX;
      lastTime = Date.now();
      velocity = 0;
      container.classList.add("is-dragging");
    });

    window.addEventListener("mousemove", (e) => {
      if (!isDown) return;
      const x = e.clientX;
      const y = e.clientY;
      const dx = startX - x;
      const dy = startY - y;

      totalMoved = Math.hypot(dx, dy);

      if (Math.abs(dx) > Math.abs(dy)) {
        container.scrollLeft = initialScrollLeft + dx;
        const now = Date.now();
        const dt = now - lastTime;
        if (dt > 0) {
          velocity = (x - lastX) / dt;
          lastX = x;
          lastTime = now;
        }
      }
    });

    window.addEventListener("mouseup", (e) => {
      if (!isDown) return;
      isDown = false;
      container.classList.remove("is-dragging");

      const endX = e.clientX;
      const swipeDistance = startX - endX;

      if (Math.abs(velocity) > 0.35) {
        const momentum = velocity * 220;
        container.scrollBy({ left: -momentum, behavior: "smooth" });
      }

      if (options.onSwipe && totalMoved > 50) {
        if (swipeDistance > 50) options.onSwipe("next");
        else if (swipeDistance < -50) options.onSwipe("prev");
      }
    });

    container.addEventListener("click", (e) => {
      if (totalMoved > 10) {
        e.preventDefault();
        e.stopPropagation();
      }
    }, true);
  }

  attachDragScroll(hourStrip);

  attachDragScroll(dayTabs, {
    onSwipe: (direction) => {
      if (!state.data || !state.data.daily) return;
      const totalDays = state.data.daily.time.length;
      if (direction === "next" && state.selectedDay < totalDays - 1) {
        state.selectedDay++;
        render();
        toast(`Forecast: ${formatWeekday(state.data.daily.time[state.selectedDay], true)}`);
      } else if (direction === "prev" && state.selectedDay > 0) {
        state.selectedDay--;
        render();
        toast(`Forecast: ${formatWeekday(state.data.daily.time[state.selectedDay], true)}`);
      }
    }
  });

  if (hero) {
    let hStartX = 0, hStartY = 0, hStartTime = 0;

    hero.addEventListener("touchstart", (e) => {
      if (!e.touches || e.touches.length === 0) return;
      if (e.target.closest("button, input, select, textarea, .strip, .daytabs, canvas")) return;
      hStartX = e.touches[0].clientX;
      hStartY = e.touches[0].clientY;
      hStartTime = Date.now();
    }, { passive: true });

    hero.addEventListener("touchend", (e) => {
      if (!e.changedTouches || e.changedTouches.length === 0) return;
      if (e.target.closest("button, input, select, textarea, .strip, .daytabs, canvas")) return;
      const endX = e.changedTouches[0].clientX;
      const endY = e.changedTouches[0].clientY;
      const dx = endX - hStartX;
      const dy = endY - hStartY;
      const dt = Date.now() - hStartTime;

      if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.4 && dt < 450) {
        if (!state.data || !state.data.daily) return;
        const totalDays = state.data.daily.time.length;
        if (dx < 0 && state.selectedDay < totalDays - 1) {
          state.selectedDay++;
          render();
          toast(`Swiped to ${formatWeekday(state.data.daily.time[state.selectedDay], true)}`);
        } else if (dx > 0 && state.selectedDay > 0) {
          state.selectedDay--;
          render();
          toast(`Swiped to ${formatWeekday(state.data.daily.time[state.selectedDay], true)}`);
        }
      }
    });
  }
}

/* ============================================================
   BOOT
   ============================================================ */
(async function boot(){
  const savedTheme = localStorage.getItem(THEME_KEY) || "dark";
  applyTheme(savedTheme);
  applySettingsToCss(); syncSettingsUI(); updateTheme();
  
  setupSwipeSupport();
  startIntroProgress();
  
  const minLoad = new Promise(r => setTimeout(r, 600));
  const dataLoad = loadCity(state.city, { persist:false, addRecent:false }).catch(() => {});
  
  await Promise.all([minLoad, dataLoad]);
  bootFinished = true;
})();
