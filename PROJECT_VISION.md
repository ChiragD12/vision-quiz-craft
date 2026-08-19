# UPSC Revision — Project Vision

## Mission

UPSC Revision is a **premium revision platform** for UPSC, HPSC and similar
competitive examinations. Quiz generation is only the surface. Internally the
application manages **knowledge, notes and revision history** so the user can
spend their time revising — not managing files or databases.

The felt quality bar is Apple Notes, Notion and Linear.

## What this is

- A revision workspace where subjects, topics and notes are captured once and
  revisited forever.
- A quiz engine that turns those notes into UPSC-style MCQs on demand.
- A place to track streaks, mistakes and bookmarks over time.

## What this is not

- A quiz-of-the-day app.
- A social / leaderboard app.
- A note-taking app that happens to include a quiz.

## Non-negotiables

- **Local First** — every byte lives on the user's device.
- **Privacy First** — no accounts, no telemetry, no analytics.
- **Offline First** — the app shell works with no network.
- **PWA** — installable on iOS, Android and desktop.
- **Independent** — no Supabase, no Lovable runtime, no Firebase, no hosted
  auth, no backend server, no proprietary cloud database.
- **Open architecture** — a React developer who has never used Lovable can
  clone the repo and be productive within an hour.

The single permitted online dependency is Google's Gemini API, and only when
the user pastes their own key in **Settings → Gemini API Key**.

## Zero regression

The following capabilities must keep working across every release:

Gemini API key entry · Gemini quiz generation · localStorage persistence ·
Import JSON · Export JSON · PWA install · Offline shell · Continue Quiz ·
Recent Quizzes · Bookmarks · Wrong Answers · Image upload · PDF upload ·
OCR extraction · Vercel deployment · `bun run build`.

## Design language (summary)

Dark first. Deep navy surfaces. Warm gold accent used sparingly. Fraunces
display + Inter body. Generous spacing. 200–280ms ease-out motion. No flashy
gradients, no gamer UI. See `DESIGN_SYSTEM.md` for the full token set.

## Success criteria

- The user opens the app and immediately sees today's streak and one-tap
  access to Continue / Generate / Bookmarks / Wrong Answers.
- Creating a quiz requires exactly three decisions: subject, topic, count.
- All existing notes remain accessible after every future release.
- The application still boots in ten years if only a static file server and a
  Gemini key are available.
