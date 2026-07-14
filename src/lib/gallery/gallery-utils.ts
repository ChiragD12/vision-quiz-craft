// Pure helpers for assembling gallery sections. Extracted from gallery.tsx —
// the logic is byte-for-byte unchanged; the only difference is that the
// values the function used to close over (unlockedImages, userMedia,
// devPreviewActive) are now explicit parameters so this can live outside
// the component.

import { imagesByTier, type RewardTier } from "@/lib/rewards";
import type { UserMediaTier, UserMediaWithUrl } from "@/lib/user-media";
import { buildDevPreviewKey, labelFromUrl } from "@/lib/dev-preview-media";
import type { GalleryItem, LockedDevItem } from "./gallery-types";

// Reward unlock logic is untouched: Developer Preview never grants real
// unlocks and never forces the gallery to render (let alone fetch) every
// reward at once. It only reveals locked-item *metadata* (lockedDevItems
// below), fetched on demand via the dev-preview-media helper.

// Merge unlocked built-ins with user-added media, filtered by tier.
export function buildImageSection(
  tier: RewardTier,
  unlockedImages: number,
  userMedia: UserMediaWithUrl[],
  devPreviewActive: boolean,
) {
  const uTier: UserMediaTier =
    tier === "3-stars" ? "3-stars" : tier === "4-stars" ? "4-stars" : "5-stars";
  const all = imagesByTier(tier);
  const unlocked: GalleryItem[] = all
    .filter((r) => r.index < unlockedImages)
    .map((r) => ({
      src: r.url,
      type: "image" as const,
      devCacheKey: buildDevPreviewKey("image", tier, r.index),
    }));
  const added: GalleryItem[] = userMedia
    .filter((m) => m.tier === uTier && m.type === "image")
    .map((m) => ({ src: m.url, type: "image" as const, userMediaId: m.id }));
  const lockedDevItems: LockedDevItem[] = devPreviewActive
    ? all
        .filter((r) => r.index >= unlockedImages)
        .map((r) => ({
          key: buildDevPreviewKey("image", tier, r.index),
          type: "image" as const,
          label: labelFromUrl(r.url, `${tier}-${r.index}.jpg`),
          src: r.url,
        }))
    : [];
  return {
    items: [...added, ...unlocked],
    lockedDevItems,
    lockedCount: all.length - unlocked.length,
    totalBuiltin: all.length,
    builtinUnlocked: unlocked.length,
  };
}

// Videos have been retired from the Journey system.
