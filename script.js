/* ============================================================
   ATMOS — frontend-only weather dashboard
   Data: Open-Meteo (no key) — geocoding, forecast, air quality
   Persistence: localStorage only. No backend anywhere.
   ============================================================ */

const GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search";
const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const AQI_URL = "https://air-quality-api.open-meteo.com/v1/air-quality";
const REVERSE_URL = "https://api.bigdatacloud.net/data/reverse-geocode-client";

const LS_KEYS = { unit: "atmos_unit", city: "atmos_city", favs: "atmos_favs" };

/* ---------------- state ---------------- */
const state = {
  unit: localStorage.getItem(LS_KEYS.unit) || "c",
  city: safeParse(localStorage.getItem(LS_KEYS.city)) || { name: "Kanpur", country: "India", lat: 26.4499, lon: 80.3319, timezone: "auto" },
  favs: safeParse(localStorage.getItem(LS_KEYS.favs)) || [],
  data: null,
  selectedDay: 0,
  clockTimer: null,
};

function safeParse(s){ try{ return JSON.parse(s); }catch(e){ return null; } }

/* ---------------- weather code → meaning/icon ---------------- */
const WMO = {
  0:  { label: "Clear sky",            group: "clear" },
  1:  { label: "Mostly clear",         group: "clear" },
  2:  { label: "Partly cloudy",        group: "cloudy" },
  3:  { label: "Overcast",             group: "cloudy" },
  45: { label: "Fog",                  group: "fog" },
  48: { label: "Rime fog",             group: "fog" },
  51: { label: "Light drizzle",        group: "rain" },
  53: { label: "Drizzle",              group: "rain" },
  55: { label: "Dense drizzle",        group: "rain" },
  56: { label: "Freezing drizzle",     group: "rain" },
  57: { label: "Freezing drizzle",     group: "rain" },
  61: { label: "Light rain",           group: "rain" },
  63: { label: "Rain",                 group: "rain" },
  65: { label: "Heavy rain",           group: "rain" },
  66: { label: "Freezing rain",        group: "rain" },
  67: { label: "Freezing rain",        group: "rain" },
  71: { label: "Light snow",           group: "snow" },
  73: { label: "Snow",                 group: "snow" },
  75: { label: "Heavy snow",           group: "snow" },
  77: { label: "Snow grains",          group: "snow" },
  80: { label: "Light showers",        group: "rain" },
  81: { label: "Showers",              group: "rain" },
  82: { label: "Violent showers",      group: "rain" },
  85: { label: "Snow showers",         group: "snow" },
  86: { label: "Heavy snow showers",   group: "snow" },
  95: { label: "Thunderstorm",         group: "storm" },
  96: { label: "Storm with hail",      group: "storm" },
  99: { label: "Storm with heavy hail",group: "storm" },
};
function wmo(code){ return WMO[code] || { label: "Unknown", group: "cloudy" }; }

function iconSvg(group, isDay = true){
  const icons = {
    clear: isDay
      ? `<circle cx="12" cy="12" r="5"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>`
      : `<path d="M20 14.5a8 8 0 1 1-9.5-9.4 6.5 6.5 0 0 0 9.5 9.4z"/>`,
    cloudy: `<path d="M7 18a4.5 4.5 0 0 1-.5-9 6 6 0 0 1 11.6-1.8A4 4 0 0 1 18 18H7z"/>`,
    fog: `<path d="M4 9h12M2 13h16M6 17h12M18 9h2M20 13h2M4 17h2"/>`,
    rain: `<path d="M7 15a4.5 4.5 0 0 1-.5-9 6 6 0 0 1 11.6-1.8A4 4 0 0 1 18 15H7z"/><path d="M8 18l-1 3M12 18l-1 3M16 18l-1 3"/>`,
    snow: `<path d="M7 13a4.5 4.5 0 0 1-.5-9 6 6 0 0 1 11.6-1.8A4 4 0 0 1 18 13H7z"/><path d="M9 18v3M9 18l-1.5 1M9 18l1.5 1M15 18v3M15 18l-1.5 1M15 18l1.5 1"/>`,
    storm: `<path d="M7 13a4.5 4.5 0 0 1-.5-9 6 6 0 0 1 11.6-1.8A4 4 0 0 1 18 13H7z"/><path d="M13 15l-3 5h3l-2 4"/>`,
  };
  return `<svg viewBox="0 0 24 24">${icons[group] || icons.cloudy}</svg>`;
}

const HEADLINES = {
  clear:  ["Clear", "and Bright"],
  cloudy: ["Cloudy", "Skies Ahead"],
  fog:    ["Fog", "Rolling In"],
  rain:   ["Rain", "Moving Through"],
  snow:   ["Snow", "in the Forecast"],
  storm:  ["Storm", "with Heavy Rain"],
};

/* ---------------- units ---------------- */
function tempUnitParam(){ return state.unit === "f" ? "fahrenheit" : "celsius"; }
function windUnitParam(){ return state.unit === "f" ? "mph" : "kmh"; }
function degSuffix(){ return state.unit === "f" ? "°F" : "°C"; }
function windSuffix(){ return state.unit === "f" ? "mph" : "km/h"; }
function round(n){ return Math.round(n); }

/* ---------------- fetch helpers ---------------- */
async function geocodeCity(query){
  const url = `${GEOCODE_URL}?name=${encodeURIComponent(query)}&count=6&language=en&format=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Geocoding failed");
  const json = await res.json();
  return json.results || [];
}

async function reverseGeocode(lat, lon){
  try{
    const res = await fetch(`${REVERSE_URL}?latitude=${lat}&longitude=${lon}&localityLanguage=en`);
    if (!res.ok) throw new Error("reverse failed");
    const j = await res.json();
    return {
      name: j.city || j.locality || j.principalSubdivision || "Current location",
      country: j.countryName || "",
    };
  }catch(e){
    return { name: "Current location", country: "" };
  }
}

async function fetchWeather(lat, lon){
  const params = new URLSearchParams({
    latitude: lat, longitude: lon,
    current: "temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,is_day,uv_index",
    hourly: "temperature_2m,weather_code,precipitation_probability",
    daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset,uv_index_max",
    timezone: "auto",
    forecast_days: 7,
    temperature_unit: tempUnitParam(),
    wind_speed_unit: windUnitParam(),
  });
  const res = await fetch(`${FORECAST_URL}?${params.toString()}`);
  if (!res.ok) throw new Error("Weather fetch failed");
  return res.json();
}

async function fetchAqi(lat, lon){
  try{
    const res = await fetch(`${AQI_URL}?latitude=${lat}&longitude=${lon}&current=us_aqi`);
    if (!res.ok) return null;
    const j = await res.json();
    return j.current ? j.current.us_aqi : null;
  }catch(e){ return null; }
}

function aqiLabel(v){
  if (v == null) return "—";
  if (v <= 50) return `${v} Good`;
  if (v <= 100) return `${v} Moderate`;
  if (v <= 150) return `${v} Unhealthy*`;
  if (v <= 200) return `${v} Unhealthy`;
  if (v <= 300) return `${v} Very Bad`;
  return `${v} Hazardous`;
}

/* ---------------- core load ---------------- */
async function loadCity(city, { persist = true } = {}){
  setBusy(true);
  try{
    const [weather, aqi] = await Promise.all([
      fetchWeather(city.lat, city.lon),
      fetchAqi(city.lat, city.lon),
    ]);
    state.city = city;
    state.data = weather;
    state.data.aqi = aqi;
    state.selectedDay = 0;
    if (persist) localStorage.setItem(LS_KEYS.city, JSON.stringify(city));
    render();
    startClock();
  }catch(err){
    console.error(err);
    toast("Couldn't load weather — check your connection and try again.");
  }finally{
    setBusy(false);
  }
}

function setBusy(isBusy){
  document.getElementById("refreshBtn").classList.toggle("spinning", isBusy);
}

/* ---------------- render ---------------- */
function render(){
  if (!state.data) return;
  const d = state.data;
  const day = d.daily;
  const idx = state.selectedDay;
  const code = day.weather_code[idx];
  const meta = wmo(code);
  const isToday = idx === 0;
  const isDay = isToday ? d.current.is_day === 1 : true;

  document.getElementById("main").dataset.condition = meta.group;

  // hero
  const [h1, h2] = HEADLINES[meta.group] || HEADLINES.cloudy;
  document.getElementById("heroEyebrow").textContent = isToday ? "Weather Forecast" : formatWeekday(day.time[idx], true);
  document.getElementById("heroTitle").innerHTML = `${h1}<br/>${h2}`;
  document.getElementById("heroDesc").textContent = buildDescription(idx);

  // current card always reflects "now" regardless of selected day
  document.getElementById("currentCity").textContent = `${state.city.name}${state.city.country ? ", " + state.city.country : ""}`;
  document.getElementById("currentTemp").textContent = round(d.current.temperature_2m);
  document.getElementById("currentDeg").textContent = degSuffix();
  document.getElementById("currentCond").textContent = `${wmo(d.current.weather_code).label} · Feels ${round(d.current.apparent_temperature)}${degSuffix()}`;
  document.getElementById("statWind").textContent = `${round(d.current.wind_speed_10m)} ${windSuffix()}`;
  document.getElementById("statHumidity").textContent = `${round(d.current.relative_humidity_2m)}% humidity`;
  document.getElementById("statPrecip").textContent = `${day.precipitation_probability_max[0] ?? 0}% precip`;
  document.getElementById("statUv").textContent = `UV ${round(d.current.uv_index ?? day.uv_index_max[0] ?? 0)}`;
  document.getElementById("statSunrise").textContent = formatTime(day.sunrise[0], d.timezone);
  document.getElementById("statSunset").textContent = formatTime(day.sunset[0], d.timezone);
  document.getElementById("statAqi").textContent = aqiLabel(d.aqi);
  document.getElementById("unitToggle").textContent = degSuffix();

  renderStrip();
  renderDayTabs();
  renderFavs();
}

function buildDescription(idx){
  const d = state.data;
  const day = d.daily;
  const hi = round(day.temperature_2m_max[idx]);
  const lo = round(day.temperature_2m_min[idx]);
  const pop = day.precipitation_probability_max[idx] ?? 0;
  const meta = wmo(day.weather_code[idx]);
  let sentence = `${meta.label} with a high of ${hi}${degSuffix()} and a low of ${lo}${degSuffix()}.`;
  if (pop > 15) sentence += ` Chance of precipitation is ${pop}%.`;
  if (idx === 0) sentence += ` Wind ${round(d.current.wind_speed_10m)} ${windSuffix()}, humidity ${round(d.current.relative_humidity_2m)}%.`;
  return sentence;
}

function renderStrip(){
  const d = state.data;
  const idx = state.selectedDay;
  const targetDate = d.daily.time[idx];
  const strip = document.getElementById("hourStrip");
  strip.innerHTML = "";

  const hours = d.hourly.time
    .map((t, i) => ({ t, i }))
    .filter(({ t }) => t.startsWith(targetDate));

  const nowHour = new Date().toISOString().slice(0,13);
  let startIdx = hours.findIndex(h => h.t.slice(0,13) === nowHour);
  if (startIdx === -1) startIdx = 0;
  const slice = (idx === 0 ? hours.slice(startIdx) : hours).slice(0, 12);

  slice.forEach(({ i }) => {
    const temp = round(d.hourly.temperature_2m[i]);
    const code = d.hourly.weather_code[i];
    const meta = wmo(code);
    const hourLabel = formatHour(d.hourly.time[i]);
    const chip = document.createElement("div");
    chip.className = "hour-chip";
    chip.innerHTML = `<span class="h-time">${hourLabel}</span>${iconSvg(meta.group)}<span class="h-temp">${temp}°</span>`;
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
    btn.setAttribute("role","tab");
    const hi = round(d.daily.temperature_2m_max[i]);
    btn.innerHTML = `${formatWeekday(dateStr)}<small>${hi}°</small>`;
    btn.addEventListener("click", () => { state.selectedDay = i; render(); });
    tabs.appendChild(btn);
  });
}

function renderFavs(){
  const list = document.getElementById("favList");
  list.innerHTML = "";
  if (!state.favs.length){
    list.innerHTML = `<div class="fav-empty">No saved cities yet — search above, or tap “+” to save the city you're viewing.</div>`;
    return;
  }
  state.favs.forEach((fav) => {
    const card = document.createElement("div");
    const isSelected = fav.lat === state.city.lat && fav.lon === state.city.lon;
    card.className = "fav-card" + (isSelected ? " is-selected" : "");
    card.innerHTML = `
      <div>
        <span class="fav-name">${fav.name}</span>
        <span class="fav-country">${fav.country || ""}</span>
      </div>
      <div class="fav-right">
        <span class="fav-temp">–°</span>
        <span class="fav-cond"></span>
        <button class="fav-remove" aria-label="Remove ${fav.name}"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
      </div>`;
    card.addEventListener("click", (e) => {
      if (e.target.closest(".fav-remove")) return;
      loadCity(fav);
    });
    card.querySelector(".fav-remove").addEventListener("click", (e) => {
      e.stopPropagation();
      state.favs = state.favs.filter(f => !(f.lat === fav.lat && f.lon === fav.lon));
      localStorage.setItem(LS_KEYS.favs, JSON.stringify(state.favs));
      renderFavs();
    });
    list.appendChild(card);

    // lightweight live temp for each favourite
    fetchWeather(fav.lat, fav.lon).then(w => {
      const temp = round(w.current.temperature_2m);
      const meta = wmo(w.current.weather_code);
      card.querySelector(".fav-temp").textContent = `${temp}°`;
      card.querySelector(".fav-cond").innerHTML = iconSvg(meta.group);
    }).catch(() => {});
  });
}

/* ---------------- formatting ---------------- */
function formatWeekday(dateStr, long = false){
  const dt = new Date(dateStr + "T00:00:00");
  return dt.toLocaleDateString("en-US", { weekday: long ? "long" : "short" });
}
function formatHour(iso){
  const dt = new Date(iso);
  return dt.toLocaleTimeString("en-US", { hour: "numeric" });
}
function formatTime(iso, tz){
  const dt = new Date(iso);
  return dt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function startClock(){
  if (state.clockTimer) clearInterval(state.clockTimer);
  const tz = state.data?.timezone;
  const tick = () => {
    const now = new Date();
    const opts = tz ? { timeZone: tz } : {};
    document.getElementById("clockDate").textContent = now.toLocaleDateString("en-US", { ...opts, month: "short", day: "numeric" });
    document.getElementById("clockTime").textContent = now.toLocaleTimeString("en-US", { ...opts, hour: "2-digit", minute: "2-digit" });
  };
  tick();
  state.clockTimer = setInterval(tick, 15000);
}

/* ---------------- toast ---------------- */
let toastTimer;
function toast(msg){
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.hidden = false;
  requestAnimationFrame(() => el.classList.add("show"));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.classList.remove("show");
    setTimeout(() => { el.hidden = true; }, 300);
  }, 3200);
}

/* ---------------- search ---------------- */
let searchDebounce;
const searchInput = document.getElementById("searchInput");
const suggestionsEl = document.getElementById("suggestions");
const clearBtn = document.getElementById("clearSearch");

searchInput.addEventListener("input", () => {
  const q = searchInput.value.trim();
  clearBtn.hidden = q.length === 0;
  clearTimeout(searchDebounce);
  if (q.length < 2){ hideSuggestions(); return; }
  searchDebounce = setTimeout(() => runSearch(q), 320);
});

clearBtn.addEventListener("click", () => {
  searchInput.value = "";
  clearBtn.hidden = true;
  hideSuggestions();
  searchInput.focus();
});

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
        const city = { name: r.name, country: r.country || "", lat: r.latitude, lon: r.longitude };
        loadCity(city);
        hideSuggestions();
        searchInput.value = "";
        clearBtn.hidden = true;
      });
      suggestionsEl.appendChild(row);
    });
    suggestionsEl.hidden = false;
  }catch(e){
    toast("Search failed — check your connection.");
  }
}
function hideSuggestions(){ suggestionsEl.hidden = true; suggestionsEl.innerHTML = ""; }
document.addEventListener("click", (e) => {
  if (!e.target.closest(".search-wrap")) hideSuggestions();
});

/* ---------------- top actions ---------------- */
document.getElementById("locateBtn").addEventListener("click", useMyLocation);
document.querySelector('[data-nav="explore"]').addEventListener("click", useMyLocation);

function useMyLocation(){
  if (!navigator.geolocation){ toast("Geolocation isn't available in this browser."); return; }
  setBusy(true);
  navigator.geolocation.getCurrentPosition(async (pos) => {
    const { latitude, longitude } = pos.coords;
    const place = await reverseGeocode(latitude, longitude);
    loadCity({ name: place.name, country: place.country, lat: latitude, lon: longitude });
  }, (err) => {
    setBusy(false);
    toast("Couldn't get your location — allow location access and try again.");
  }, { enableHighAccuracy: false, timeout: 10000 });
}

document.getElementById("refreshBtn").addEventListener("click", () => loadCity(state.city, { persist: false }));

document.getElementById("unitToggle").addEventListener("click", () => {
  state.unit = state.unit === "c" ? "f" : "c";
  localStorage.setItem(LS_KEYS.unit, state.unit);
  loadCity(state.city, { persist: false });
});
document.querySelector('[data-nav="units"]').addEventListener("click", () => document.getElementById("unitToggle").click());

document.getElementById("addCurrentFav").addEventListener("click", () => {
  const exists = state.favs.some(f => f.lat === state.city.lat && f.lon === state.city.lon);
  if (exists){ toast(`${state.city.name} is already saved.`); return; }
  state.favs.push({ ...state.city });
  localStorage.setItem(LS_KEYS.favs, JSON.stringify(state.favs));
  renderFavs();
  toast(`${state.city.name} saved.`);
});

document.querySelectorAll(".side-btn[data-nav]").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".side-btn[data-nav]").forEach(b => b.classList.remove("is-active"));
    btn.classList.add("is-active");
  });
});
document.querySelector('[data-nav="add"]').addEventListener("click", () => searchInput.focus());
document.querySelector('[data-nav="days"]').addEventListener("click", () => {
  document.getElementById("dayTabs").scrollIntoView({ behavior: "smooth", block: "center" });
});
document.getElementById("aboutBtn").addEventListener("click", () => {
  toast("Atmos — a frontend-only dashboard. Weather via Open-Meteo, nothing tracked, nothing stored on a server.");
});

/* ---------------- boot ---------------- */
function hideLoader(){
  const loader = document.getElementById("loader");
  loader.classList.add("hide");
  document.getElementById("app").hidden = false;
  setTimeout(() => loader.remove(), 800);
}

(async function boot(){
  const minLoad = new Promise(r => setTimeout(r, 1450));
  const dataLoad = loadCity(state.city, { persist: false });
  await Promise.all([minLoad, dataLoad]);
  hideLoader();
})();
