// Shared types for the Secret Gallery feature. Extracted verbatim from
// gallery.tsx so hooks/utils/components can share them without importing
// from the page component itself.

import type { UserMediaTier } from "@/lib/user-media";

export type GalleryItem = {
  src: string;
  type: "image" | "video";
  title?: string;
  description?: string;
  userMediaId?: string; // present only for user-added items
  devCacheKey?: string; // present for built-in rewards; used to check for a
  // previously-downloaded Developer Preview copy so it doesn't get
  // re-fetched once the reward unlocks normally.
};

// Locked Journey scene tile. Carries its real story image URL up front (the
// scene art isn't secret — only its unlocked status is), so Preview/Download
// on a locked tile can use meta.src directly with no separate media system.
export interface LockedDevItem {
  key: string;
  label: string;
  description?: string;
  src: string;
  type: "image";
}

export interface SelectedMedia {
  src: string;
  type: "image" | "video";
  title?: string;
  description?: string;
  section: string;
  index: number;
  items: GalleryItem[];
}

// A single gallery section (one Journey chapter, e.g. Ancient Glory /
// Golden Age / Bharat Rising) once its story images have been resolved.
export interface GallerySectionData {
  title: string;
  emoji: string;
  // Chapter identity (Journey) is separate from where uploads get stored.
  // Optional because not every section necessarily accepts uploads.
  uploadTier?: UserMediaTier;
  accepts: "image";
  items: GalleryItem[];
  lockedDevItems: LockedDevItem[];
  lockedCount: number;
  totalBuiltin: number;
  builtinUnlocked: number;
}
