# Contributing

## Local development

```bash
bun install
bun run dev        # http://localhost:8080
```

TanStack Start + Vite. Routes live under `src/routes/`. The route tree
(`src/routeTree.gen.ts`) is auto-generated — do not edit it by hand.

## Build & preview

```bash
bun run build      # emits dist/
bun run preview    # serve dist/ locally
```

## Deploy

The output is a static SPA. Any static host works.

### Vercel

1. Import the GitHub repo in Vercel.
2. Framework preset: **Vite**.
3. Build command: `bun run build`.
4. Output directory: `dist`.
5. Add a rewrite for SPA routing:
   ```json
   { "rewrites": [{ "source": "/(.*)", "destination": "/" }] }
   ```

### GitHub Pages, Netlify, Cloudflare Pages

Same recipe. Point at `dist/` and rewrite all unknown paths to `/index.html`.

## Coding standards

- TypeScript strict — no `any`, no unresolved imports.
- Layer discipline (see `ARCHITECTURE.md`): UI → Domain → Persistence → Gemini.
  Never invert.
- No component larger than ~200 lines. Split by concern.
- No hardcoded colors (`bg-white`, `text-black`, hex literals). Use tokens.
- Server code is intentionally absent — do not add a backend.

## Git workflow

- `main` — the last known-good stable branch. Never modified in a redesign.
- `version2` (and future `versionN`) — where redesigns happen.
- Each phase lands as a single logical commit.
- Merge to `main` only after a full zero-regression sweep.

## Zero-regression checklist (run before merging)

Gemini key save · quiz generation · localStorage persists across reload ·
Import JSON · Export JSON · PWA installable · offline shell loads · resume
in-progress quiz · recents list · bookmark toggle · wrong-answer capture ·
image OCR upload · PDF OCR upload · `bun run build` succeeds.
