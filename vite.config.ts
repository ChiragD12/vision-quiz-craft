// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// On Vercel, pin the Nitro target to the `vercel` preset so the build emits a
// proper `.vercel/output` Build Output API bundle (server functions + static
// assets). Without a preset the build falls back to a plain node/cloudflare
// layout and TanStack's prerender/preview step looks for `dist/server/server.js`,
// which never exists -> "Cannot find module /vercel/path0/dist/server/server.js".
// Inside Lovable the preset is forced to Cloudflare regardless, so this is a no-op there.
const isVercel = !!process.env.VERCEL;

export default defineConfig({
  ...(isVercel ? { nitro: { preset: "vercel" } as const } : {}),
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});