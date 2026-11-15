const CACHE_VERSION = "twin-cakery-v4";
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const PRECACHE = ["/", "/index.html"];
const MEDIA_CACHE_PREFIXES = ["/uploads/"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== STATIC_CACHE).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  const isSameOrigin = url.origin === self.location.origin;
  const isPrecached = PRECACHE.includes(url.pathname);
  const isMedia = MEDIA_CACHE_PREFIXES.some((prefix) => url.pathname.startsWith(prefix));

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(STATIC_CACHE).then((cache) => cache.put("/index.html", copy));
          return response;
        })
        .catch(async () => (await caches.match(request)) || caches.match("/index.html")),
    );
    return;
  }

  if (isSameOrigin && (isPrecached || isMedia)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          const copy = response.clone();
          caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
          return response;
        });
      }),
    );
  }
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "Twin Cakery";
  const targetUrl = data.deepLink || data.actionUrl || "/";
  const options = {
    body: data.body || "",
    icon: "/uploads/twin-cakery-logo.webp",
    badge: "/uploads/twin-cakery-logo.webp",
    tag: data.tag || data.notificationId || "twin-cakery-notification",
    renotify: true,
    data: { url: targetUrl, ...data },
  };

  event.waitUntil(
    (async () => {
      // Let open clients react (toast/chime/badge refresh) without requiring focus.
      const clientList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of clientList) {
        client.postMessage({ type: "PUSH_NOTIFICATION", payload: data });
      }
      await self.registration.showNotification(title, options);
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const rawUrl = (event.notification.data && event.notification.data.url) || "/";
  let targetPath = "/";
  try {
    const u = new URL(rawUrl, self.location.origin);
    targetPath = u.origin === self.location.origin ? (u.pathname + u.search + u.hash || "/") : "/";
  } catch {
    targetPath = rawUrl.startsWith("/") ? rawUrl : "/";
  }

  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of clientList) {
        const clientUrl = new URL(client.url);
        if (clientUrl.origin === self.location.origin && "focus" in client) {
          await client.focus();
          client.postMessage({ type: "NOTIFICATION_NAVIGATE", url: targetPath });
          return;
        }
      }
      if (self.clients.openWindow) {
        await self.clients.openWindow(targetPath);
      }
    })(),
  );
});
