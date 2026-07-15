// Journey asset resolution.
//
// New artwork lives under src/assets/Secret-Folder/chapters/**,
// chapter-covers/, avatars/, wallpapers/. Until final artwork is checked in,
// every resolver falls back to a shipped placeholder SVG so the build never
// breaks and the UI keeps rendering.
//
// Legacy note: the existing reward images under 3 stars/, 4 stars/, 5 stars/
// are also loaded here so the current app continues to look exactly as it
// does today (no visible regression while placeholder chapter art is empty).

import { CHAPTERS } from "./chapters";
import { WALLPAPERS } from "./wallpapers";

const PLACEHOLDER = "/journey-placeholder.svg";

function firstUrl(mod: Record<string, unknown>): string | null {
  const keys = Object.keys(mod).sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }),
  );
  for (const k of keys) {
    const v = mod[k];
    if (typeof v === "string") return v;
    if (v && typeof v === "object" && "default" in v) {
      const d = (v as { default: unknown }).default;
      if (typeof d === "string") return d;
    }
  }
  return null;
}

function toUrlMap(mod: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of Object.keys(mod)) {
    const v = mod[k];
    if (typeof v === "string") out[k] = v;
    else if (v && typeof v === "object" && "default" in v) {
      const d = (v as { default: unknown }).default;
      if (typeof d === "string") out[k] = d;
    }
  }
  return out;
}

// ---------- chapter story images ----------

const chapterGlobs = {
  1: import.meta.glob(
    "../../assets/Secret-Folder/chapters/01-ancient-glory/*.{webp,png,jpg,jpeg}",
    { eager: true, as: "url" },
  ),
  2: import.meta.glob(
    "../../assets/Secret-Folder/chapters/02-golden-age/*.{webp,png,jpg,jpeg}",
    { eager: true, as: "url" },
  ),
  3: import.meta.glob(
    "../../assets/Secret-Folder/chapters/03-trouble-begins/*.{webp,png,jpg,jpeg}",
    { eager: true, as: "url" },
  ),
  4: import.meta.glob(
    "../../assets/Secret-Folder/chapters/04-long-night/*.{webp,png,jpg,jpeg}",
    { eager: true, as: "url" },
  ),
  5: import.meta.glob(
    "../../assets/Secret-Folder/chapters/05-final-blow/*.{webp,png,jpg,jpeg}",
    { eager: true, as: "url" },
  ),
  6: import.meta.glob(
    "../../assets/Secret-Folder/chapters/06-bharat-rising/*.{webp,png,jpg,jpeg}",
    { eager: true, as: "url" },
  ),
} as const;

// Legacy fallback so the current app keeps its existing images visible.
const legacyGlobs = [
  import.meta.glob("../../assets/Secret-Folder/3 stars/*.{png,jpg,jpeg,webp}", {
    eager: true,
    as: "url",
  }),
  import.meta.glob("../../assets/Secret-Folder/4 stars/*.{png,jpg,jpeg,webp}", {
    eager: true,
    as: "url",
  }),
  import.meta.glob("../../assets/Secret-Folder/5 stars/*.{png,jpg,jpeg,webp}", {
    eager: true,
    as: "url",
  }),
];

function chapterImagesFor(chapterId: number): string[] {
  const map = toUrlMap(chapterGlobs[chapterId as keyof typeof chapterGlobs] ?? {});
  return Object.keys(map)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .map((k) => map[k]);
}

// Naming convention: chapter images are named "story-<globalId>.<ext>",
// e.g. chapters/04-long-night/story-33.webp for story id 33. Keying by the
// id embedded in the filename (rather than sorted array position) means a
// missing file just falls through to placeholder instead of silently
// shifting every later image in the chapter by one slot.
function extractStoryId(filename: string): number | null {
  const match = filename.match(/story-(\d+)\.[a-zA-Z0-9]+$/);
  return match ? parseInt(match[1], 10) : null;
}

function chapterImageMapById(chapterId: number): Map<number, string> {
  const map = toUrlMap(chapterGlobs[chapterId as keyof typeof chapterGlobs] ?? {});
  const out = new Map<number, string>();
  for (const k of Object.keys(map)) {
    const id = extractStoryId(k);
    if (id !== null) out.set(id, map[k]);
  }
  return out;
}

const legacyFlat: string[] = legacyGlobs.flatMap((g) => {
  const map = toUrlMap(g);
  return Object.keys(map)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .map((k) => map[k]);
});

/**
 * Story image URL for a 1-based story id (1..65). Falls back to the legacy
 * reward image at the same global index, then to a placeholder SVG.
 */
export function storyImageUrl(storyId: number): string {
  const chapter = CHAPTERS.find((c) => storyId >= c.start && storyId <= c.end);
  if (chapter) {
    // Preferred: exact "story-<id>.ext" filename match.
    const byId = chapterImageMapById(chapter.id);
    const exact = byId.get(storyId);
    if (exact) return exact;

    // Backward-compatible fallback: positional match, for chapter folders
    // that haven't been renamed to the story-<id> convention yet.
    const local = storyId - chapter.start;
    const imgs = chapterImagesFor(chapter.id);
    if (imgs[local]) return imgs[local];
  }
  const legacy = legacyFlat[storyId - 1];
  return legacy ?? PLACEHOLDER;
}

// ---------- chapter covers ----------

console.log(
  "CHAPTER COVERS",
  Object.keys(
    import.meta.glob("../../assets/Secret-Folder/chapter-covers/*.{webp,png,jpg,jpeg,jfif}", {
      eager: true,
      as: "url",
    }),
  ),
);

const chapterCovers = toUrlMap(
  import.meta.glob(
    "../../assets/Secret-Folder/chapter-covers/*.{webp,png,jpg,jpeg,jfif}",
    { eager: true, as: "url" },
  ),
);

export function chapterCoverUrl(chapterId: number): string {
  const suffix = String(chapterId).padStart(2, "0");
  const hit = Object.keys(chapterCovers).find((k) =>
    k.includes(`chapter-cover-${suffix}`),
  );
  if (hit) return chapterCovers[hit];
  // Fallback to first image of the chapter as a nice-enough placeholder cover.
  const first = chapterImagesFor(chapterId)[0];
  return first ?? PLACEHOLDER;
}

// ---------- lion avatars ----------

console.log(
  "AVATARS",
  Object.keys(
    import.meta.glob("../../assets/Secret-Folder/avatars/**/*.{webp,png,jpg,jpeg}", {
      eager: true,
      as: "url",
    }),
  ),
);

const avatars = toUrlMap(
  import.meta.glob("../../assets/Secret-Folder/avatars/**/*.{webp,png,jpg,jpeg}", {
    eager: true,
    as: "url",
  }),
);

export function lionAvatarUrl(stageId: number): string {
  const suffix = String(stageId + 1).padStart(2, "0"); // stage 0 -> lion-01
  const hit = Object.keys(avatars).find((k) => {
  const n = k.toLowerCase();
  return (
    n.endsWith(`lion-${suffix}.png`) ||
    n.endsWith(`lion-${suffix}.webp`) ||
    n.endsWith(`lion-${suffix}.jpg`) ||
    n.endsWith(`lion-${suffix}.jpeg`)
  );
});
  if (hit) return avatars[hit];
  const any = firstUrl(avatars);
  return any ?? PLACEHOLDER;
}

// ---------- wallpapers ----------

const wallpapers = toUrlMap(
  import.meta.glob("/src/assets/Secret-Folder/wallpapers/*.{webp,png,jpg,jpeg}", {
    eager: true,
    as: "url",
  }),
);

export function wallpaperUrl(wallpaperId: number): string {
  const spec = WALLPAPERS.find((w) => w.id === wallpaperId);
  if (!spec) return PLACEHOLDER;
  const hit = Object.keys(wallpapers).find((k) => k.endsWith(spec.filename));
  return hit ? wallpapers[hit] : PLACEHOLDER;
}
