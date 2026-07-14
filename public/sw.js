/* UPSC Revision — offline app-shell service worker. */
const VERSION = "v3";
const APP_CACHE = `upsc-app-${VERSION}`;
const ASSET_CACHE = `upsc-assets-${VERSION}`;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(APP_CACHE)
      .then((cache) =>
        cache
          .addAll(["/", "/manifest.webmanifest", "/icon-192.png", "/icon-512.png"])
          .catch(() => undefined),
      ),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k.startsWith("upsc-") && k !== APP_CACHE && k !== ASSET_CACHE)
          .map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // never touch Gemini or other APIs

  // Network-first for HTML navigations, fall back to cached shell.
  if (req.mode === "navigate" || (req.headers.get("accept") || "").includes("text/html")) {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(req);
          const cache = await caches.open(APP_CACHE);
          cache.put("/", res.clone()).catch(() => undefined);
          return res;
        } catch {
          const cache = await caches.open(APP_CACHE);
          return (await cache.match("/")) || (await cache.match(req)) || Response.error();
        }
      })(),
    );
    return;
  }

  // Cache-first for hashed static assets under /_build/ and /assets/, and same-origin images.
  if (
    url.pathname.startsWith("/_build/") ||
    url.pathname.startsWith("/assets/") ||
    /\.(png|svg|jpg|jpeg|webp|ico|woff2?|ttf|otf|css|js|mjs)$/.test(url.pathname)
  ) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(ASSET_CACHE);
        const hit = await cache.match(req);
        if (hit) return hit;
        try {
          const res = await fetch(req);
          if (res.ok) cache.put(req, res.clone()).catch(() => undefined);
          return res;
        } catch {
          return hit || Response.error();
        }
      })(),
    );
  }
});
