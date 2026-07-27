/* Atmos service worker — caches the app shell so the last-viewed
   forecast (already saved to localStorage by script.js) and the UI
   itself still load with no connection.

   IMPORTANT: this is NETWORK-FIRST for the app shell. It tries the
   real network on every load and only falls back to the cached copy
   if the network fails (i.e. genuinely offline). An earlier version
   of this file was cache-first, which meant updates to index.html /
   style.css / script.js could get silently masked by an old cached
   copy even after a redeploy. Network-first avoids that: you'll
   always see your latest deploy when you have a connection, and only
   fall back to the cache when you don't.

   It still does NOT cache live API calls (Open-Meteo, RainViewer,
   geocoding, map tiles) — those always go straight to the network. */

const CACHE_NAME = "atmos-shell-v3"; // bumped so the old (buggy) cache is discarded
const SHELL_FILES = [
  "./",
  "./index.html",
  "./style.css",
  "./script.js",
  "./manifest.json",
  "./assets/background.jpg",
  "./assets/login-bg.jpg",
  "./assets/favicon.png",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES)).catch(() => {})
  );
  self.skipWaiting(); // activate this new version immediately, don't wait for old tabs to close
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim(); // take control of any already-open tabs right away
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return; // never intercept POST/PUT/DELETE
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return; // never intercept external API/CDN calls
  if (url.pathname.startsWith("/api/")) return; // never intercept backend API endpoints

  event.respondWith(
    fetch(event.request)
      .then((res) => {
        if (res.ok) caches.open(CACHE_NAME).then((c) => c.put(event.request, res.clone()));
        return res;
      })
      .catch(() => caches.match(event.request)) // offline fallback only
  );
});
