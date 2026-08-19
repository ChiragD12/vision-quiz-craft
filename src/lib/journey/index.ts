// Journey — data-driven progression layer on top of the existing reward
// engine. Every screen consumes these manifests + selectors; nothing here
// mutates state. Reward unlock (125-correct → 1 story image) is unchanged
// and still owned by src/lib/store.ts + src/lib/rewards.ts.

import {
  CHAPTERS,
  TOTAL_STORY_IMAGES,
  chapterOf,
  chapterProgress,
  currentChapter,
  type Chapter,
} from "./chapters";
import { STORY_IMAGES, storyById, type StoryImage } from "./story";
import { LION_STAGES, lionForCompletedChapters, type LionStage } from "./lion";
import {
  WALLPAPERS,
  wallpapersForCompletedChapters,
  type Wallpaper,
} from "./wallpapers";
import {
  JOURNEY_ACHIEVEMENTS,
  journeyAchievementFor,
  type JourneyAchievement,
} from "./achievements";
import { JOURNEY_QUOTES, randomQuote } from "./quotes";
import { JOURNEY_SETTINGS, type JourneySettings } from "./settings";
import {
  chapterCoverUrl,
  lionAvatarUrl,
  storyImageUrl,
  wallpaperUrl,
} from "./assets";

export {
  CHAPTERS,
  TOTAL_STORY_IMAGES,
  chapterOf,
  chapterProgress,
  currentChapter,
  STORY_IMAGES,
  storyById,
  LION_STAGES,
  lionForCompletedChapters,
  WALLPAPERS,
  wallpapersForCompletedChapters,
  JOURNEY_ACHIEVEMENTS,
  journeyAchievementFor,
  JOURNEY_QUOTES,
  randomQuote,
  JOURNEY_SETTINGS,
  chapterCoverUrl,
  lionAvatarUrl,
  storyImageUrl,
  wallpaperUrl,
};
export type {
  Chapter,
  StoryImage,
  LionStage,
  Wallpaper,
  JourneyAchievement,
  JourneySettings,
};

// ---------- top-level selectors (pure, given unlocked count) ----------

export function completedChapterCount(unlockedCount: number): number {
  let n = 0;
  for (const c of CHAPTERS) {
    if (chapterProgress(c, unlockedCount).complete) n++;
  }
  return n;
}

export function currentLion(unlockedCount: number): LionStage {
  return lionForCompletedChapters(completedChapterCount(unlockedCount));
}

export function unlockedWallpapers(unlockedCount: number): Wallpaper[] {
  return wallpapersForCompletedChapters(completedChapterCount(unlockedCount));
}

export function unlockedJourneyAchievements(
  unlockedCount: number,
): JourneyAchievement[] {
  const done = completedChapterCount(unlockedCount);
  return JOURNEY_ACHIEVEMENTS.filter((a) => a.chapterId <= done);
}

/**
 * Given the reward counts before and after a single reveal, compute which
 * Journey-scoped things the celebration should announce. All fields are
 * optional; the celebration renders only what's present.
 */
export interface UnlockDelta {
  storyImage?: StoryImage;
  chapterCompleted?: Chapter;
  wallpaperUnlocked?: Wallpaper;
  lionEvolved?: LionStage;
  achievementUnlocked?: JourneyAchievement;
}

export function computeUnlockDelta(
  before: number,
  after: number,
): UnlockDelta | null {
  if (after <= before) return null;
  const story = storyById(after);
  const chapter = story ? chapterOf(story.id) : null;
  const wasCompleted = completedChapterCount(before);
  const nowCompleted = completedChapterCount(after);
  const completedChapter =
    nowCompleted > wasCompleted
      ? CHAPTERS.find(
          (c) => chapterProgress(c, after).complete && !chapterProgress(c, before).complete,
        ) ?? null
      : null;
  const prevLion = lionForCompletedChapters(wasCompleted);
  const nextLion = lionForCompletedChapters(nowCompleted);
  const lionEvolved = nextLion.id !== prevLion.id ? nextLion : null;
  const wallpaper = completedChapter
    ? WALLPAPERS.find((w) => w.chapterId === completedChapter.id) ?? null
    : null;
  const achievement = completedChapter
    ? journeyAchievementFor(completedChapter.id)
    : null;
  return {
    storyImage: story ?? undefined,
    chapterCompleted: completedChapter ?? undefined,
    wallpaperUnlocked: wallpaper ?? undefined,
    lionEvolved: lionEvolved ?? undefined,
    achievementUnlocked: achievement ?? undefined,
  };
}
