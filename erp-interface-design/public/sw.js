/*
 * Twin Cakery ERP — service worker (hand-rolled, zero-dependency).
 *
 * Strategy:
 *  - Navigations (app shell): network-first, fall back to the cached shell so
 *    the app still opens offline.
 *  - Static assets (JS/CSS/fonts/images/icons): cache-first (they are
 *    content-hashed by Vite), with a runtime cache for anything new.
 *  - API calls (/api): network-only — the ERP is a live data app; we never
 *    serve stale business data. (Auth + writes must always hit the server.)
 *
 * Bump CACHE_VERSION on each deploy to retire old caches.
 */

const CACHE_VERSION = "twin-cakery-v2";
const SHELL_CACHE = `${CACHE_VERSION}-shell`;
const ASSET_CACHE = `${CACHE_VERSION}-assets`;

const APP_SHELL = ["/", "/index.html", "/manifest.webmanifest", "/favicon.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      await cache.addAll(APP_SHELL).catch(() => {});
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => !k.startsWith(CACHE_VERSION)).map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // ignore cross-origin (fonts, etc.)

  // API: always go to the network (live data); do not cache business data.
  if (url.pathname.startsWith("/api")) return;

  // Navigations: network-first with an offline shell fallback.
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(request);
          const cache = await caches.open(SHELL_CACHE);
          cache.put("/index.html", fresh.clone());
          return fresh;
        } catch {
          const cache = await caches.open(SHELL_CACHE);
          return (
            (await cache.match("/index.html")) ||
            (await cache.match("/")) ||
            new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain" } })
          );
        }
      })(),
    );
    return;
  }

  // Static assets: cache-first, populate the runtime cache on miss.
  event.respondWith(
    (async () => {
      const cache = await caches.open(ASSET_CACHE);
      const hit = await cache.match(request);
      if (hit) return hit;
      try {
        const fresh = await fetch(request);
        if (fresh && fresh.status === 200) cache.put(request, fresh.clone());
        return fresh;
      } catch {
        return hit || Response.error();
      }
    })(),
  );
});
