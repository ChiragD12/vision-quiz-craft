
# Journey System — Phase 1 Plan

Additive implementation. Existing reward engine, unlock animation, appearance system, store, and routing remain the foundation. Videos are removed from the UI only; the reward math (125 correct → 1 unlock) stays.

## Scope

1. **Manifest layer (new, data-only)** — `src/lib/journey/`
   - `chapters.ts` — 6 chapters, ranges 1–10, 11–21, 22–32, 33–43, 44–54, 55–65.
   - `story.ts` — 65 entries `{ id, chapter, title, description, quote }` (placeholder text).
   - `lion.ts` — 7 stages with Hindi names + chapter thresholds.
   - `wallpapers.ts` — 6 entries keyed by chapter.
   - `achievements.ts` — 6 entries keyed by chapter (Hindi placeholder titles).
   - `quotes.ts` — array of quotes for splash.
   - `settings.ts` — feature flags (e.g. `enableWallpapers`, easy to toggle later).
   - `index.ts` — barrel + derived selectors: `getCurrentChapter(unlocked)`, `getCurrentLion(unlocked)`, `getUnlockedWallpapers(unlocked)`, `getUnlockedAchievements(unlocked)`, `getChapterProgress(unlocked, chapter)`.
   - Asset resolution via `import.meta.glob` against `src/assets/Secret-Folder/chapters/**`, `chapter-covers/`, `avatars/`, `wallpapers/`. Missing files fall back to a placeholder SVG so builds don't break before final art lands.

2. **Rewards engine — minimal edits** (`src/lib/rewards.ts`)
   - Keep `ALL_IMAGES` derivation but re-source from `chapters/**` glob and sort by filename `001..065`.
   - Drop `ALL_VIDEOS`, `TOTAL_VIDEO_REWARDS`, `videosDueForImages`, `nextVideoOnUnlock`. Any callers get simplified.
   - Store keys unchanged (`correctSinceReward`, unlocked-count key) — no migration.

3. **Journey screen** (rename destination, keep route file `gallery.tsx`)
   - New component under `src/routes/gallery.tsx` renamed visually to "Journey" (path stays `/gallery` to preserve links; add a redirect-friendly route only if trivially cheap).
   - Sections: overall progress ring (unlocked/65), 6 chapter cards with cover + chapter progress + locked/unlocked thumbs. Tap unlocked image → modal with large image + title + description + quote (from `story.ts`). Locked shows silhouette + "X more to unlock".
   - Remove video sections, "Add Video" controls, and dev-preview video paths. Image dev-preview + user-uploaded image logic stays.
   - Bottom keeps "Experimental AI Studio" link (unchanged).

4. **Home screen** (`src/routes/index.tsx`)
   - Add a Journey card: current Lion (avatar + Hindi name), current chapter name, overall progress bar (X / 65), "Continue Learning" button → `/gallery`.
   - Do not add: next-unlock preview, wallpaper preview.

5. **Path of the Lion**
   - Derived purely from unlocked count via `getCurrentLion()`. Auto-updates; no user selection UI.
   - Existing flame/Rewards page keeps working; the "current lion" label sourced from manifest.

6. **Wallpapers** (opt-in, no auto-apply)
   - Extend `appearance.ts` with a helper listing unlocked wallpapers from the manifest. Settings page (or Appearance panel) gains "Journey wallpapers" section: Default / Unlocked / Custom upload. Per-page wallpaper selection uses the existing per-page appearance store.
   - No change to how appearance persists.

7. **Achievements**
   - Chapter-completion achievements added to existing achievements list via manifest merge. Existing achievements untouched.

8. **Splash screen**
   - `SplashScreen` picks a random quote from `quotes.ts` at mount, replaces the hardcoded "do or do not" line. Artwork untouched.

9. **Unlock celebration**
   - Extend `RewardUnlockCelebration` props with optional sections: `storyImage`, `chapterComplete`, `wallpaperUnlocked`, `lionEvolved`, `achievementUnlocked`. Only render provided sections. Result page computes which apply from the unlock delta and passes them in. Core animation phases untouched.

## Do Not Touch

- Quiz generation, timer, quiz storage format
- Reward persistence keys (`correctSinceReward`, unlocked count)
- Appearance system architecture (only additive helpers)
- Routing outside `/gallery`, `/`, splash, and unlock celebration
- LocalStorage patterns; no migration

## Files Created

```
src/lib/journey/{chapters,story,lion,wallpapers,achievements,quotes,settings,index}.ts
src/lib/journey/assets.ts        # glob-based asset resolvers with placeholder fallback
src/components/journey/ChapterCard.tsx
src/components/journey/StoryImageModal.tsx
src/components/journey/JourneyHomeCard.tsx
```

## Files Modified (surgical)

```
src/lib/rewards.ts               # drop video exports, re-source images from /chapters
src/routes/gallery.tsx           # journey layout; remove video sections
src/routes/index.tsx             # add JourneyHomeCard
src/components/splash-screen.tsx # random quote
src/components/reward-unlock-celebration.tsx  # optional section props
src/routes/result.$id.tsx        # pass unlock deltas to celebration
src/lib/appearance.ts            # (only if needed) list unlocked wallpapers helper
src/routes/settings.tsx          # journey wallpaper picker section
```

## Placeholder Asset Strategy

Every glob-based resolver returns `placeholder.svg` when the numbered asset is missing. No hard failures if artwork isn't checked in yet. Existing files under `src/assets/Secret-Folder/3 stars|4 stars|5 stars|Videos` are left in place for now (not referenced by new code); they can be deleted in a follow-up cleanup PR without code changes.

## Out of Scope (Phase 1)

Secret chapters, hidden rewards, seasonal events, animated wallpapers, extra lion stages. Manifest shape leaves room (arrays, keyed lookups) so these become data-only additions later.

Ready to build on approval.
