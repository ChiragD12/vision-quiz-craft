# Architecture

## Layers

```
┌─────────────────────────────────────────────────────────┐
│  UI            src/routes/**, src/components/**         │
├─────────────────────────────────────────────────────────┤
│  Domain        src/domain/**  (pure, no React, no I/O)  │
├─────────────────────────────────────────────────────────┤
│  Persistence   src/lib/store.ts  (localStorage adapter) │
├─────────────────────────────────────────────────────────┤
│  Gemini        src/lib/gemini.ts (only online dep)      │
└─────────────────────────────────────────────────────────┘
```

Each layer only knows the layers below it. UI never touches localStorage
directly; domain never imports React.

## Folder map

```
src/
  domain/
    subjects.ts    Core subject seed, subject helpers
    streak.ts      Ring tier logic (bronze/silver/gold/gem)
  lib/
    store.ts       Typed localStorage repository (single source of truth)
    gemini.ts      Fetch wrapper for Google Generative Language API
    pwa-register.ts Service worker registration guard
  components/
    streak-ring.tsx  Concentric SVG rings
    quiz-timer.tsx   Per-question countdown
    ui/              shadcn primitives
  routes/
    __root.tsx       Head, providers, offline shell
    index.tsx        Home / Revision Dashboard
    new.tsx          Generate Quiz flow
    subjects.tsx     Subject & topic & knowledge manager
    quiz.$id.tsx     Quiz player
    result.$id.tsx   Result screen
    settings.tsx     API key, import, export, erase, about
```

## Data model

Persisted under localStorage key `upsc_revision_db_v1`. The v1 key is retained
across v2 to guarantee zero regression — v2 fields are additive and optional.

```ts
Subject      { id, name, kind?: 'core'|'custom', hidden?: boolean, created_at }
Topic        { id, subject_id, name, created_at }
Note         { id, topic_id, content, source: 'text'|'image'|'pdf', created_at }
Quiz         { id, title, topic_id?, question_count, questions,
               answers, per_q_seconds?, current_index, status,
               created_at, completed_at? }
MCQ          { question, options[4], answerIndex, explanation }
Bookmark     { id: hash(mcq), question, topic_name?, created_at }
WrongAnswer  { id: hash(mcq), question, topic_name?, created_at }
StreakDay    { date: 'YYYY-MM-DD', solved: number }
Settings     { gemini_api_key, gemini_model }
```

Invariants enforced by the store:

- IDs are UUIDs. Names are display-only.
- Subject name equality: `name.trim().toLowerCase()`.
- Topic name equality: `name.trim().toLowerCase()` scoped by `subject_id`.
- Core subjects are seeded on first read and cannot be deleted (only hidden).

## Data flow

1. User picks Subject/Topic on `/new`.
2. Store ensures Subject and Topic exist (dedupe by normalised name).
3. Gemini extracts notes from images/PDF/text → store appends Notes.
4. Gemini generates MCQs from all Notes on that Topic → store saves Quiz.
5. Quiz player writes each answer back to the same Quiz; wrong answers land
   in `wrong_answers`; bookmarks land in `bookmarks`; the day counter bumps.
6. Result screen reads the completed Quiz.

## PWA

- `public/sw.js` caches the app shell (`NetworkFirst` for HTML, `CacheFirst`
  for hashed assets). Registered only in production, never in preview.
- `public/manifest.webmanifest` provides installability.
- Gemini calls always hit the network; failures surface to the user.

## Deployment

Any static host: Vercel, Netlify, GitHub Pages, Cloudflare Pages, or a plain
S3 bucket. Build with `bun run build`; publish the `dist/` folder. See
`CONTRIBUTING.md` for step-by-step.
