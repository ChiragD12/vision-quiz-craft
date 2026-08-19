// Guarded service worker registration.
// Never registers in dev or Lovable preview / sandbox contexts.
export function registerServiceWorker() {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;

  const h = window.location.hostname;
  const inIframe = window.self !== window.top;
  const isPreview =
    h === "localhost" ||
    h === "127.0.0.1" ||
    h.startsWith("id-preview--") ||
    h.startsWith("preview--") ||
    h === "lovableproject.com" ||
    h.endsWith(".lovableproject.com") ||
    h === "lovableproject-dev.com" ||
    h.endsWith(".lovableproject-dev.com") ||
    h === "beta.lovable.dev" ||
    h.endsWith(".beta.lovable.dev");

  const killSwitch = new URLSearchParams(window.location.search).get("sw") === "off";

  if (inIframe || isPreview || killSwitch || !import.meta.env.PROD) {
    // Aggressively unregister any prior SW so preview never serves stale HTML.
    navigator.serviceWorker.getRegistrations?.().then((regs) => {
      regs.forEach((r) => {
        if (r.active?.scriptURL?.endsWith("/sw.js")) r.unregister();
      });
    });
    return;
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  });
}
