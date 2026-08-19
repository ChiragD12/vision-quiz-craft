// Client-only. No UI, no button, no settings toggle — this runs itself once
// per app session, from AppRoot, right after onboarding finishes.

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * True if `existingKey` (the raw applicationServerKey bytes exposed on a
 * PushSubscription's `.options`) matches the currently configured VAPID
 * public key. False for null/undefined (Safari/iOS doesn't always expose
 * `.options`, in which case we can't prove a match either way — callers
 * treat "unknown" the same as "mismatch" so a stale key still gets
 * rotated, at the cost of occasionally re-subscribing when it wasn't
 * strictly necessary, which is harmless and idempotent).
 */
function subscriptionKeyMatches(
  existingKey: ArrayBuffer | null | undefined,
  expectedKey: Uint8Array,
): boolean {
  if (!existingKey) return false;
  const existing = new Uint8Array(existingKey);
  if (existing.length !== expectedKey.length) return false;
  for (let i = 0; i < existing.length; i++) {
    if (existing[i] !== expectedKey[i]) return false;
  }
  return true;
}

/**
 * Creates a fresh subscription against `publicKey` and registers it with
 * the server. Shared by both the first-time subscribe path and the
 * stale-key recovery path so they can't drift apart.
 */
async function createAndRegisterSubscription(
  registration: ServiceWorkerRegistration,
  publicKey: string,
): Promise<PushSubscription> {
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  });

  const res = await fetch("/api/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(subscription.toJSON()),
  });
  // TEMP DEBUG LOGGING
  console.log("[push-debug] POST /api/subscribe", res.status, res.ok);

  return subscription;
}

/**
 * Resolves only once `registration.active` is actually set. `await
 * navigator.serviceWorker.ready` alone isn't enough here: on a fresh
 * install (or right after an update), the worker can still be
 * "installing"/"waiting" for a moment, and calling
 * pushManager.subscribe() during that window is what throws
 * "AbortError: Subscription failed - no active Service Worker". This
 * waits out the remaining installing->activating->activated transition
 * for this exact registration before returning.
 */
function waitForActiveServiceWorker(
  registration: ServiceWorkerRegistration,
): Promise<void> {
  if (registration.active) return Promise.resolve();

  const worker = registration.installing || registration.waiting;
  if (!worker) return Promise.resolve();

  return new Promise<void>((resolve) => {
    const onStateChange = () => {
      if (worker.state === "activated") {
        worker.removeEventListener("statechange", onStateChange);
        resolve();
      }
    };
    worker.addEventListener("statechange", onStateChange);
  });
}

/**
 * Silent, one-shot push opt-in flow:
 * - permission "default"  -> ask once, right now (no separate button/UI)
 * - permission "granted"  -> (re)register the subscription; idempotent
 * - permission "denied"   -> do nothing, don't ask again, app works as normal
 *
 * Any failure here (unsupported browser, network error, iOS PWA not
 * installed to home screen, etc.) is swallowed — this must never block or
 * break the rest of the app.
 */
export async function ensurePushSubscription(): Promise<void> {
  // TEMP DEBUG LOGGING — remove after diagnosing the missing permission prompt.
  console.log("[push-debug] 1. ensurePushSubscription entered");
  console.log("[push-debug] 2. typeof window:", typeof window);

  if (typeof window === "undefined") return;

  // TEMP DEBUG LOGGING
  const hasNotification = "Notification" in window;
  const hasServiceWorker = "serviceWorker" in navigator;
  const hasPushManager = "PushManager" in window;
  console.log("[push-debug] 3. Notification exists?", hasNotification);
  console.log("[push-debug] 4. serviceWorker exists?", hasServiceWorker);
  console.log("[push-debug] 5. PushManager exists?", hasPushManager);

  if (!hasNotification || !hasServiceWorker || !hasPushManager) {
    return;
  }

  try {
    // TEMP DEBUG LOGGING
    console.log("[push-debug] 6. Current Notification.permission:", Notification.permission);

    if (Notification.permission === "default") {
      // TEMP DEBUG LOGGING
      console.log("[push-debug] 7. About to call Notification.requestPermission()");
      const result = await Notification.requestPermission();
      // TEMP DEBUG LOGGING
      console.log("[push-debug] 8. Result returned by Notification.requestPermission():", result);
      if (result !== "granted") return;
    }

    if (Notification.permission !== "granted") return;

    // Vite only exposes VITE_-prefixed vars to client code, so this reads
    // VITE_VAPID_PUBLIC_KEY (set to the same value as VAPID_PUBLIC_KEY) rather
    // than fetching the key from an API route.
    const publicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;
    if (!publicKey) {
      console.error("VITE_VAPID_PUBLIC_KEY is not set — cannot subscribe to push.");
      return;
    }

    let registration: ServiceWorkerRegistration;
    try {
      registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      // TEMP DEBUG LOGGING
      console.log("[push-debug] 9. Service worker registration succeeded", registration);
    } catch (swErr) {
      // TEMP DEBUG LOGGING
      console.log("[push-debug] 9. Service worker registration failed", swErr);
      throw swErr;
    }

    // TEMP DEBUG LOGGING
    console.log(
      "[push-debug] 9b. Waiting for active worker. active/installing/waiting:",
      !!registration.active,
      !!registration.installing,
      !!registration.waiting,
    );
    await waitForActiveServiceWorker(registration);
    // TEMP DEBUG LOGGING
    console.log("[push-debug] 9c. Service worker is now active", !!registration.active);

    let subscription = await registration.pushManager.getSubscription();
    // TEMP DEBUG LOGGING
    console.log("[push-debug] 10. Existing subscription found?", !!subscription, subscription);

    // Recovery path: an existing subscription was created against a VAPID
    // key that no longer matches VITE_VAPID_PUBLIC_KEY (e.g. the Vercel
    // VAPID keys were rotated after this device already subscribed). Apple
    // Push rejects sends to it server-side with "VapidPkHashMismatch", and
    // no amount of retrying the send will fix that — the browser has to
    // unsubscribe and re-subscribe under the new key. This does NOT touch
    // localStorage/IndexedDB/app data; it only replaces the browser-level
    // push registration.
    if (subscription) {
      const expectedKeyBytes = urlBase64ToUint8Array(publicKey);
      const currentKey = subscription.options?.applicationServerKey ?? null;
      const isStale = !subscriptionKeyMatches(currentKey, expectedKeyBytes);

      if (isStale) {
        // TEMP DEBUG LOGGING
        console.log("[push-debug] 10b. Subscription key is stale — unsubscribing to rotate");
        try {
          await subscription.unsubscribe();
        } catch (unsubErr) {
          // TEMP DEBUG LOGGING
          console.log("[push-debug] 10c. unsubscribe() failed, continuing anyway", unsubErr);
        }
        subscription = null;
      }
    }

    if (!subscription) {
      // TEMP DEBUG LOGGING
      console.log("[push-debug] 11. Creating new subscription");
      try {
        subscription = await createAndRegisterSubscription(registration, publicKey);
        // TEMP DEBUG LOGGING
        console.log("[push-debug] 12. subscribe() + register success", subscription);
      } catch (subErr) {
        // TEMP DEBUG LOGGING
        console.log("[push-debug] 12. subscribe() failure", subErr);
        throw subErr;
      }
      return;
    }

    // Existing subscription already matches the current key — just make
    // sure the server has it (idempotent upsert by endpoint).
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });
      // TEMP DEBUG LOGGING
      console.log("[push-debug] 13. POST /api/subscribe success", res.status, res.ok);
    } catch (postErr) {
      // TEMP DEBUG LOGGING
      console.log("[push-debug] 13. POST /api/subscribe failure", postErr);
      throw postErr;
    }
  } catch (err) {
    console.error("ensurePushSubscription failed", err);
  }
}
