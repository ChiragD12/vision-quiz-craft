import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { registerServiceWorker } from "../lib/pwa-register";
import { ensurePushSubscription } from "@/lib/push-client";
import { scheduleRevisionSync, syncRevisionsNow } from "@/lib/revision-sync";
import { Toaster } from "@/components/ui/sonner";
import { SplashScreen } from "@/components/splash-screen";
import { WallpaperSelector } from "@/components/wallpaper-selector";
import { initSounds } from "@/lib/sound-manager";
import {
  initAppearance,
  useAppearance,
  resolveThemedAsset,
} from "@/lib/appearance";
import { api } from "@/lib/store";
import { currentLion } from "@/lib/journey";
import { lionAvatarUrl } from "@/lib/journey/assets";
import { RewardCeremonyProvider } from "@/components/reward-ceremony/RewardCeremonyProvider";
import { EdgeNavProvider, EdgeNavHamburger } from "@/components/edge-nav";
import { useFullscreenLoading } from "@/lib/fullscreen-loading";
function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "qPSZ — Premium UPSC Revision" },
      {
        name: "description",
        content:
          "Local-first UPSC & HPSC revision. Notes to Prelims-style MCQs. Private, offline, install to home screen.",
      },
      { name: "theme-color", content: "#101528" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-title", content: "qPSZ" },
      { name: "mobile-web-app-capable", content: "yes" },
      { property: "og:title", content: "UPSC Revision — Premium revision workspace" },
      {
        property: "og:description",
        content: "Local-first, offline-first UPSC revision. Your notes, your device, your pace.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "icon", href: "/icon-192.png", type: "image/png" },
      { rel: "apple-touch-icon", href: "/icon-192.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function HomeLogo() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isHome = pathname === "/";

  const [{ theme }] = useAppearance();
  // Start from a stable, SSR-safe default. api.unlockedImageCount() reads
  // from the browser-only store, so calling it during the initial render
  // (e.g. via a useState initializer) returns a different value on the
  // server than on the client and causes a hydration mismatch. The real
  // count is read after mount instead, once in this effect and again on
  // every store change.
  const [unlockedImages, setUnlockedImages] = useState(0);

  // Re-read the existing count from the store whenever it broadcasts a
  // change, so the logo tracks Lion evolutions without polling or
  // duplicating the progression calculation done in currentLion().
  useEffect(() => {
    setUnlockedImages(api.unlockedImageCount());
    const handleDbChange = () => setUnlockedImages(api.unlockedImageCount());
    window.addEventListener("upsc-db-change", handleDbChange);
    return () => window.removeEventListener("upsc-db-change", handleDbChange);
  }, []);

  const lion = currentLion(unlockedImages);
  const logoSrc = lionAvatarUrl(lion.id);

  return (
    <Link
      to="/"
      aria-label="Go home"
      className={
        isHome
          ? "fixed top-4 left-4 z-40"
          : "fixed top-4 left-1/2 -translate-x-1/2 z-40"
      }
    >
      <img
        src={logoSrc}
        alt="qPSZ"
        className="h-9 w-auto select-none"
        draggable={false}
      />
    </Link>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  useEffect(() => {
    registerServiceWorker();
  }, []);

  // Silent push opt-in / stale-subscription rotation check. No button, no
  // settings toggle, no new permission prompt: this asks via the browser's
  // own permission prompt only when permission is still "default", and
  // otherwise just (re)verifies the existing subscription still matches
  // VITE_VAPID_PUBLIC_KEY, rotating it if not. Any failure (unsupported
  // browser, denied permission, network error, etc.) is swallowed inside
  // ensurePushSubscription and never blocks the rest of the app.
  //
  // Runs on mount AND on 'pageshow' / the tab becoming visible again, not
  // just on mount. An installed iOS PWA doesn't reload the page or remount
  // React on every "launch" from the home screen — iOS suspends the
  // WKWebView process in the background and resumes it later, so a
  // mount-only effect only ever fires once for the lifetime of that
  // process. Without the extra listeners, a stale-key rotation could sit
  // dormant until the user force-quits and relaunches. ensurePushSubscription
  // is cheap and idempotent, so re-running it on resume is safe.
  const pushInFlight = useRef(false);
  useEffect(() => {
    const runPushCheck = () => {
      if (pushInFlight.current) return;
      pushInFlight.current = true;
      void ensurePushSubscription().finally(() => {
        pushInFlight.current = false;
      });
    };

    runPushCheck();

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") runPushCheck();
    };
    window.addEventListener("pageshow", runPushCheck);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.removeEventListener("pageshow", runPushCheck);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  // Keep the Upstash spaced-revision snapshot in sync so the send-quiz
  // cron endpoint (which runs server-side, with no localStorage access)
  // has something current to read. localStorage/store.ts stays the real
  // source of truth — this only ever pushes a small notification snapshot
  // up, never reads one back. Synced once on load to catch changes made
  // while the app was closed, and again on every local DB write.
  useEffect(() => {
    void syncRevisionsNow();
    const onDbChange = () => scheduleRevisionSync();
    window.addEventListener("upsc-db-change", onDbChange);
    return () => window.removeEventListener("upsc-db-change", onDbChange);
  }, []);

  useEffect(() => {
    initSounds();
  }, []);

  // Safety net for hydration: re-affirms the saved appearance once React
  // takes over, in case anything reset it between the module-level
  // application above and mount (e.g. a fresh SSR paint).
  useEffect(() => {
    initAppearance();
  }, []);

  const fullscreenLoading = useFullscreenLoading();

  return (
    <QueryClientProvider client={queryClient}>
  <RewardCeremonyProvider>
    <EdgeNavProvider>
      <Toaster position="top-center" richColors theme="dark" />
      <SplashScreen />
      {!fullscreenLoading && <HomeLogo />}
      {!fullscreenLoading && <EdgeNavHamburger />}
      <AnimatedOutlet />
      <WallpaperSelector />
    </EdgeNavProvider>
  </RewardCeremonyProvider>
</QueryClientProvider>
  );
}

function AnimatedOutlet() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const skipAnimation =
  pathname === "/" ||
  pathname.startsWith("/gallery") ||
  pathname === "/new";

if (skipAnimation) {
  return <Outlet />;
}

  // Calm, Apple-Settings-style page transitions: barely-noticeable
  // opacity + a few pixels of vertical drift, smooth ease-out expo.
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -3 }}
        transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
        style={{ willChange: "opacity, transform" }}
      >
        <Outlet />
      </motion.div>
    </AnimatePresence>
  );
}
