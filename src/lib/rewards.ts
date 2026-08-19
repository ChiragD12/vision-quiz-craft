// Reward manifest & unlock state (local-first).
//
// The reward engine is unchanged: every 125 correct answers unlocks one
// story image. Journey-specific concepts (chapters, lion, wallpapers) live
// in src/lib/journey and are DERIVED from the same unlockedImageCount.
//
// Videos have been retired from the Journey system. The video helpers
// below still exist as no-op stubs so any lingering callers compile; they
// always report zero. New code should NOT reference them.

import { CHAPTERS, TOTAL_STORY_IMAGES } from "./journey/chapters";
import { storyImageUrl } from "./journey/assets";

// Legacy tier labels are kept for backward-compat with existing UI code
// that groups images by "tier". Every image now maps to a chapter, but
// we synthesize a legacy tier based on chapter index so old callers work.
export type RewardTier = "3-stars" | "4-stars" | "5-stars";

export type ImageReward = {
  kind: "image";
  tier: RewardTier;
  index: number; // 0-based global index into ALL_IMAGES
  url: string;
};

export type VideoReward = {
  kind: "video";
  index: number;
  url: string;
};

function tierForChapter(chapterId: number): RewardTier {
  if (chapterId <= 2) return "3-stars";
  if (chapterId <= 4) return "4-stars";
  return "5-stars";
}

// Build the canonical image list from the Journey chapter manifest. Each
// story slot resolves to real chapter art if present, otherwise to the
// placeholder from src/lib/journey/assets.ts — so the app renders at all
// times, even before final artwork is checked in.
export const ALL_IMAGES: ImageReward[] = Array.from(
  { length: TOTAL_STORY_IMAGES },
  (_, i) => {
    const storyId = i + 1;
    const chapter = CHAPTERS.find(
      (c) => storyId >= c.start && storyId <= c.end,
    );
    return {
      kind: "image" as const,
      tier: tierForChapter(chapter?.id ?? 1),
      index: i,
      url: storyImageUrl(storyId),
    };
  },
);

// Videos are retired. Kept as an empty list for legacy compatibility only.
export const ALL_VIDEOS: VideoReward[] = [];

export const TOTAL_IMAGE_REWARDS = ALL_IMAGES.length;
export const TOTAL_VIDEO_REWARDS = 0;

/** @deprecated Videos are no longer part of the Journey. Always returns 0. */
export function videosDueForImages(_n: number): number {
  return 0;
}

export function imagesByTier(tier: RewardTier): ImageReward[] {
  return ALL_IMAGES.filter((r) => r.tier === tier);
}

export function nextImageReward(unlockedCount: number): ImageReward | null {
  return ALL_IMAGES[unlockedCount] ?? null;
}

/** @deprecated Videos are no longer part of the Journey. Always returns null. */
export function nextVideoOnUnlock(
  _currentUnlockedImages: number,
): VideoReward | null {
  return null;
}
