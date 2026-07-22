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

/* ---------------- state ---------------- */
const state = {
  unit: localStorage.getItem(LS.unit) || "c",
  windUnit: localStorage.getItem(LS.windUnit) || "kmh",
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
const HEADLINES = {
  clear:["Clear","and Bright"], partly:["Partly","Cloudy Skies"], cloudy:["Cloudy","Skies Ahead"],
  fog:["Fog","Rolling In"], rain:["Rain","Moving Through"], "heavy-rain":["Heavy Rain","in the Area"],
  snow:["Snow","in the Forecast"], storm:["Storm","with Heavy Rain"], wind:["Windy","and Cool"],
};

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
function updateTheme(){
  const main = document.getElementById("main");
  main.dataset.daypart = dayPart();
}
setInterval(updateTheme, 5 * 60 * 1000);

/* ---------------- background crossfade ---------------- */
let bgActive = "A";
function setBackground(group, isDay){
  const suffix = isDay ? "day" : "night";
  const path = `assets/weather/${group}-${suffix}.jpg`;
  const test = new Image();
  test.onload = () => crossfadeTo(`url("${path}")`);
  test.onerror = () => crossfadeTo(`url("assets/background.jpg")`);
  test.src = path;
}
function crossfadeTo(cssUrl){
  const layers = { A: document.getElementById("bgLayerA"), B: document.getElementById("bgLayerB") };
  const incoming = bgActive === "A" ? "B" : "A";
  layers[incoming].style.backgroundImage = cssUrl;
  layers[incoming].style.opacity = "1";
  layers[bgActive].style.opacity = "0";
  bgActive = incoming;
}

/* ---------------- particles (rain / snow / stars / lightning) ---------------- */
const canvas = document.getElementById("particles");
const ctx = canvas.getContext("2d");
let particleList = [], particleMode = "none", rafId = null, lightningTimer = null;
function resizeCanvas(){ canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight; }
window.addEventListener("resize", resizeCanvas);

function setParticles(group, part){
  clearInterval(lightningTimer); lightningTimer = null;
  if (!state.settings.anim){ particleMode = "none"; particleList = []; return; }
  resizeCanvas();
  if (group === "rain" || group === "heavy-rain") particleMode = "rain";
  else if (group === "storm") { particleMode = "rain"; scheduleLightning(); }
  else if (group === "snow") particleMode = "snow";
  else if (part === "night") particleMode = "stars";
  else particleMode = "none";
  seedParticles();
}
function seedParticles(){
  const count = particleMode === "rain" ? 140 : particleMode === "snow" ? 90 : particleMode === "stars" ? 70 : 0;
  particleList = Array.from({length: count}, () => spawnParticle());
}
function spawnParticle(){
  const w = canvas.width, h = canvas.height;
  if (particleMode === "rain") return { x: Math.random()*w, y: Math.random()*h, len: 10+Math.random()*14, speed: 7+Math.random()*6 };
  if (particleMode === "snow") return { x: Math.random()*w, y: Math.random()*h, r: 1+Math.random()*2.4, speed: .6+Math.random()*1.3, drift: Math.random()*1.2-.6 };
  if (particleMode === "stars") return { x: Math.random()*w, y: Math.random()*h*.7, r: .4+Math.random()*1.3, phase: Math.random()*Math.PI*2 };
  return {};
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
  if (particleMode === "rain"){
    ctx.strokeStyle = "rgba(190,210,230,.5)"; ctx.lineWidth = 1;
    particleList.forEach(p => {
      ctx.beginPath(); ctx.moveTo(p.x,p.y); ctx.lineTo(p.x-2,p.y+p.len); ctx.stroke();
      p.y += p.speed; p.x -= 0.6;
      if (p.y > canvas.height){ p.y = -20; p.x = Math.random()*canvas.width; }
    });
  } else if (particleMode === "snow"){
    ctx.fillStyle = "rgba(255,255,255,.85)";
    particleList.forEach(p => {
      ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,7); ctx.fill();
      p.y += p.speed; p.x += p.drift;
      if (p.y > canvas.height){ p.y = -6; p.x = Math.random()*canvas.width; }
    });
  } else if (particleMode === "stars"){
    particleList.forEach(p => {
      p.phase += 0.02;
      const a = .4 + Math.sin(p.phase)*.4;
      ctx.fillStyle = `rgba(255,255,255,${Math.max(0,a)})`;
      ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,7); ctx.fill();
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

  const [h1, h2] = HEADLINES[meta.group] || HEADLINES.cloudy;
  document.getElementById("heroEyebrow").textContent = isToday ? "Weather Forecast" : formatWeekday(day.time[idx], true);
  document.getElementById("heroTitle").innerHTML = `${h1}<br/>${h2}`;
  document.getElementById("heroDesc").textContent = buildDescription(idx);

  document.getElementById("currentCity").textContent = `${state.city.name}${state.city.country ? ", " + state.city.country : ""}`;
  document.getElementById("currentTemp").textContent = round(d.current.temperature_2m);
  document.getElementById("currentDeg").textContent = degSuffix();
  document.getElementById("currentCond").textContent = `${wmo(d.current.weather_code).label} · Feels ${round(d.current.apparent_temperature)}${degSuffix()}`;
  document.getElementById("statWind").textContent = `${round(d.current.wind_speed_10m)} ${windSuffix()}`;
  document.getElementById("statHumidity").textContent = `${round(d.current.relative_humidity_2m)}% humidity`;
  document.getElementById("statPrecip").textContent = `${day.precipitation_probability_max[0] ?? 0}% precip`;
  document.getElementById("statUv").textContent = `UV ${round(d.current.uv_index ?? day.uv_index_max[0] ?? 0)}`;
  document.getElementById("unitToggle").textContent = degSuffix();

  renderSunRing(day.sunrise[0], day.sunset[0]);
  renderMoonPhase();
  renderStrip();
  renderDayTabs();
  renderFavs();
  renderRecents();
  renderAlerts();
  renderAqiModalData();
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
searchInput.addEventListener("input", () => {
  const q = searchInput.value.trim();
  clearBtn.hidden = q.length === 0;
  clearTimeout(searchDebounce);
  if (q.length < 2){ hideSuggestions(); return; }
  searchDebounce = setTimeout(() => runSearch(q), 320);
});
clearBtn.addEventListener("click", () => { searchInput.value=""; clearBtn.hidden=true; hideSuggestions(); searchInput.focus(); });
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
function openModal(id){
  closeModal();
  const el = document.getElementById(id);
  if (!el) return;
  el.hidden = false; backdrop.hidden = false;
  requestAnimationFrame(() => { el.classList.add("show"); backdrop.classList.add("show"); });
  openModalEl = el;
  if (id === "mapModal") initMapIfNeeded();
}
function closeModal(){
  if (!openModalEl) { backdrop.hidden = true; backdrop.classList.remove("show"); return; }
  openModalEl.classList.remove("show"); backdrop.classList.remove("show");
  const el = openModalEl; openModalEl = null;
  setTimeout(() => { el.hidden = true; backdrop.hidden = true; }, 320);
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
assistantFab.addEventListener("click", () => { assistantPanel.hidden = false; assistantInputFocus(); });
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
   BOOT
   ============================================================ */
function hideLoader(){
  const loader = document.getElementById("loader");
  loader.classList.add("hide");
  document.getElementById("app").hidden = false;
  setTimeout(() => loader.remove(), 800);
}
(async function boot(){
  applySettingsToCss(); syncSettingsUI(); updateTheme();
  const minLoad = new Promise(r => setTimeout(r, 1500));
  const dataLoad = loadCity(state.city, { persist:false, addRecent:false });
  await Promise.all([minLoad, dataLoad]);
  hideLoader();
})();
