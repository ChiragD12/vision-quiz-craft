// ---------------- Reward Ceremony — types & queue builder ----------------
//
// This file does not calculate rewards. It only converts the output of
// journey's computeUnlockDelta() — reached via api.consumeReward(), the
// single source of truth for what got unlocked — into an ordered queue of
// the actual Journey domain objects.
//
// Deliberately NOT flattened into strings/image paths here: the queue
// holds the real LionStage / StoryImage / JourneyAchievement / Wallpaper /
// Chapter objects, so no metadata (name, title, quote, id, ...) is copied
// or duplicated out of the Journey manifests. Presentation (which fields
// to show, which asset-url helper to call) is derived separately, at
// render time, by getRewardCeremonyPresentation() below — so adding a
// richer ceremony later (e.g. showing a chapter's subtitle, or an
// achievement's icon) never means threading a new field through the
// queue type, just reading more off the object already carried.
//
// Do not duplicate unlock calculations here. If a new unlock type is added
// to UnlockDelta in the future, add one branch each to
// buildRewardCeremonyQueue and getRewardCeremonyPresentation below —
// nothing else about "what counts as unlocked" belongs in this file.

import type {
  UnlockDelta,
  LionStage,
  StoryImage,
  JourneyAchievement,
  Wallpaper,
  Chapter,
} from "@/lib/journey";
import {
  chapterCoverUrl,
  lionAvatarUrl,
  storyImageUrl,
  wallpaperUrl,
  randomQuote,
} from "@/lib/journey";

// ---------------- 1. Queue item — a tagged Journey domain object ----------------
//
// Each variant carries the real object straight out of UnlockDelta. No
// title/image/subtitle is precomputed or stored here.
export type RewardCeremonyItem =
  | { type: "lionEvolved"; data: LionStage }
  | { type: "storyImage"; data: StoryImage }
  | { type: "achievementUnlocked"; data: JourneyAchievement }
  | { type: "wallpaperUnlocked"; data: Wallpaper }
  | { type: "chapterCompleted"; data: Chapter };

// ---------------- 2. Queue order ----------------
//
// Fixed presentation order. Only steps that actually exist on the
// UnlockDelta are included — everything else is skipped, not padded.
//   1. Lion Evolution
//   2. Journey Image
//   3. Achievement
//   4. Wallpaper
//   5. Chapter Complete

/**
 * Converts a computeUnlockDelta() result (as returned by
 * api.consumeReward().delta) into an ordered queue of tagged domain
 * objects. Pure function — no side effects, no fetching, no reward math,
 * no metadata copied out of the objects. If the delta is null or empty,
 * returns an empty array (caller should treat that as "nothing to show").
 */
export function buildRewardCeremonyQueue(
  delta: UnlockDelta | null | undefined,
): RewardCeremonyItem[] {
  if (!delta) return [];

  const queue: RewardCeremonyItem[] = [];

  if (delta.lionEvolved) {
    queue.push({ type: "lionEvolved", data: delta.lionEvolved });
  }
  if (delta.storyImage) {
    queue.push({ type: "storyImage", data: delta.storyImage });
  }
  if (delta.achievementUnlocked) {
    queue.push({ type: "achievementUnlocked", data: delta.achievementUnlocked });
  }
  if (delta.wallpaperUnlocked) {
    queue.push({ type: "wallpaperUnlocked", data: delta.wallpaperUnlocked });
  }
  if (delta.chapterCompleted) {
    queue.push({ type: "chapterCompleted", data: delta.chapterCompleted });
  }

  return queue;
}

// ---------------- 3. Presentation derivation ----------------
//
// The only place that reads display fields off a Journey domain object.
// Pure and read-only: no reward math, nothing written back to any
// object. RewardCeremony (the display component) calls this at render
// time rather than the queue carrying precomputed strings.
export interface RewardCeremonyPresentation {
  image?: string;
  title: string;
  subtitle?: string;
  quote?: string;
}

/** Stable key for React lists — derived from the object itself, not stored. */
export function rewardCeremonyItemKey(item: RewardCeremonyItem): string {
  return `${item.type}-${item.data.id}`;
}

export function getRewardCeremonyPresentation(
  item: RewardCeremonyItem,
): RewardCeremonyPresentation {
  switch (item.type) {
    case "lionEvolved": {
      const lion = item.data;
      return {
        image: lionAvatarUrl(lion.id),
        title: "Your Lion Has Evolved!",
        subtitle: lion.name,
        quote: lion.english ?? randomQuote(),
      };
    }
    case "storyImage": {
      const story = item.data;
      return {
        image: storyImageUrl(story.id),
        title: "New Story Image Unlocked",
        quote: story.quote ?? randomQuote(),
      };
    }
    case "achievementUnlocked": {
      const achievement = item.data;
      return {
        title: achievement.title,
        subtitle: achievement.description,
        quote: randomQuote(),
      };
    }
    case "wallpaperUnlocked": {
      const wallpaper = item.data;
      return {
        image: wallpaperUrl(wallpaper.id),
        title: "New Wallpaper Unlocked",
        subtitle: wallpaper.title,
        quote: randomQuote(),
      };
    }
    case "chapterCompleted": {
      const chapter = item.data;
      return {
        image: chapterCoverUrl(chapter.id),
        title: "Chapter Complete!",
        subtitle: chapter.title,
        quote: randomQuote(),
      };
    }
  }
}
