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

    if (!subscription) {
      // TEMP DEBUG LOGGING
      console.log("[push-debug] 11. Creating new subscription");
      try {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        });
        // TEMP DEBUG LOGGING
        console.log("[push-debug] 12. subscribe() success", subscription);
      } catch (subErr) {
        // TEMP DEBUG LOGGING
        console.log("[push-debug] 12. subscribe() failure", subErr);
        throw subErr;
      }
    }

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
