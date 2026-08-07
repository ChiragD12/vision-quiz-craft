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

/* ---------------------------------------------------------------------
 * Web Push support (merged in from the Pregnancy App reference sw.js).
 * Everything below is additive — it does not touch the caching logic
 * above, and none of it interferes with the "fetch" handler since these
 * are separate event types.
 * ------------------------------------------------------------------- */

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "Notification", body: event.data.text() };
  }

  const {
    title = "Notification",
    body = "",
    tag = "default",
    icon = "/apple-touch-icon.png",
    badge = "/apple-touch-icon.png",
    url = "/",
  } = payload;

  // Same tag + renotify:false = the OS/browser collapses duplicate
  // notifications instead of stacking them, on top of any server-side lock.
  const options = { body, tag, icon, badge, renotify: false, data: { url } };

  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      const appIsVisible = clientList.some((client) => client.visibilityState === "visible");

      // A visible window means the user is already looking at the app, so a
      // system notification on top would just be a duplicate.
      if (appIsVisible) return;

      await self.registration.showNotification(title, options);
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) return client.focus();
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    }),
  );
});

// Fires when the browser/OS invalidates the current push subscription (e.g.
// it expired, or the push service rotated it) and hands us a fresh one.
// Re-subscribing with the same applicationServerKey and re-POSTing to
// /api/subscribe keeps the server's copy in sync without any user action.
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    (async () => {
      const oldSubscription = event.oldSubscription;
      const applicationServerKey =
        oldSubscription && oldSubscription.options
          ? oldSubscription.options.applicationServerKey
          : undefined;

      try {
        const newSubscription = await self.registration.pushManager.subscribe(
          applicationServerKey
            ? { userVisibleOnly: true, applicationServerKey }
            : { userVisibleOnly: true },
        );

        await fetch("/api/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newSubscription.toJSON()),
        });
      } catch {
        // Nothing safe to do here if re-subscription fails; the next
        // successful ensurePushSubscription() call from the app will retry.
      }
    })(),
  );
});
