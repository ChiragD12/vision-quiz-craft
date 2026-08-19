import { api } from "@/lib/store";

// ---------------- Sound infrastructure ----------------
//
// Components never touch Audio directly and never see filenames. They
// call playSound(SOUNDS.SOME_EVENT); everything below decides what that
// event actually plays and how.
//
// Two things are kept deliberately separate:
//   - Application Event  — what happened ("quiz answered correctly").
//   - Audio Asset        — what file plays for it, at what volume, etc.
// A feature file can outlive/reuse an event name even if the underlying
// asset, volume, or overlap behavior for it changes later — none of that
// is feature code's concern.
//
// To add a new sound in the future:
//   1. Drop the file in public/sounds/.
//   2. Add one SoundKey + one SOUND_CONFIG entry + one SOUNDS entry below.
//   3. Call playSound(SOUNDS.YOUR_NEW_EVENT) wherever it's needed.
// Nothing else in the app changes.

// ---------------- 1. Application events ----------------
//
// The internal identifier for each event. Not meant to be referenced
// directly by feature code — use the SOUNDS catalogue below instead, so
// call sites get autocomplete + compile-time safety instead of raw
// string literals.
export type SoundKey =
  | "correct"
  | "wrong"
  | "click"
  | "gallery-entry"
  | "gallery-close"
  | "quiz-complete"
  | "unlock-image"
  | "chapter-complete"
  | "achievement"
  | "splash-theme"
  | "loading"
  | "lion-hero-open"
  | "flame-click"
  | "enter-flame";

// ---------------- 2. Per-sound configuration ----------------
//
// One centralized place per event: which asset it plays, and how. Only
// `asset` is required; everything else has a sensible default so most
// entries stay one line. This is the only place in the app that knows a
// filename.
interface SoundAssetConfig {
  /** Path under /public. NOTE: assumed to match the sound key 1:1
   * (public/sounds/<key>.mp3) — if the actual files use different names,
   * update only the `asset` values below, nothing else needs to change. */
  asset: string;
  /** 0–1. Defaults to 1. */
  volume?: number;
  /** Preload at startup via initSounds(). Defaults to true. */
  preload?: boolean;
  /** Allow overlapping instances of this sound (e.g. rapid clicks) by
   * cloning the cached element on every play. Defaults to true. Set
   * false for sounds that should cut themselves off and restart instead
   * of stacking. */
  allowOverlap?: boolean;
}

const SOUND_CONFIG: Record<SoundKey, SoundAssetConfig> = {
  correct: { asset: "/sounds/correct.mp3" },
  wrong: { asset: "/sounds/wrong.mp3" },
  click: { asset: "/sounds/click.mp3" },
  "gallery-entry": { asset: "/sounds/gallery-entry.mp3" },
  "gallery-close": { asset: "/sounds/gallery-close.mp3" },
  "quiz-complete": { asset: "/sounds/quiz-complete.mp3" },
  "unlock-image": { asset: "/sounds/unlock-image.mp3" },
  "chapter-complete": { asset: "/sounds/chapter-complete.mp3" },
  achievement: { asset: "/sounds/achievement.mp3" },
  // Plays once on SplashScreen mount; never overlaps itself.
  "splash-theme": { asset: "/sounds/app-splash-theme.mp3", allowOverlap: false },
  // Looping lifecycle sound driven by startLoadingSound()/stopLoadingSound()
  // below, not by playSound(). Not preloaded — it's only ever needed while
  // an OCR/quiz-generation call is in flight.
  loading: { asset: "/sounds/loading-sound.mp3", allowOverlap: false, preload: false },
  "lion-hero-open": { asset: "/sounds/lion-hero-open.mp3" },
  "flame-click": { asset: "/sounds/flame-click.mp3" },
  "enter-flame": { asset: "/sounds/enter-flame.mp3", allowOverlap: false },
};

// ---------------- 3. Event catalogue ----------------
//
// The public, typo-proof way for feature code to refer to a sound:
// playSound(SOUNDS.QUIZ_CORRECT) instead of playSound("correct"). The
// `satisfies` clause guarantees every catalogue entry resolves to a real,
// configured SoundKey at compile time.
//
// playSound() still accepts a raw SoundKey too (SOUNDS.X *is* a SoundKey
// string), so nothing elsewhere in the app needs to change to keep
// working — this is purely an additive, friendlier entry point.
export const SOUNDS = {
  QUIZ_CORRECT: "correct",
  QUIZ_WRONG: "wrong",
  BUTTON_CLICK: "click",
  GALLERY_ENTRY: "gallery-entry",
  GALLERY_CLOSE: "gallery-close",
  QUIZ_COMPLETE: "quiz-complete",
  UNLOCK_IMAGE: "unlock-image",
  CHAPTER_COMPLETE: "chapter-complete",
  ACHIEVEMENT: "achievement",
  SPLASH_THEME: "splash-theme",
  LOADING: "loading",
  LION_HERO_OPEN: "lion-hero-open",
  FLAME_CLICK: "flame-click",
  ENTER_FLAME: "enter-flame",
} as const satisfies Record<string, SoundKey>;

export type SoundEvent = (typeof SOUNDS)[keyof typeof SOUNDS];

// ---------------- Playback engine ----------------
// Nothing below this line knows or cares about individual sounds — it's
// generic machinery driven entirely by SOUND_CONFIG.

const cache = new Map<SoundKey, HTMLAudioElement>();
let preloaded = false;

function configFor(key: SoundKey): SoundAssetConfig {
  return SOUND_CONFIG[key];
}

function getOrCreate(key: SoundKey): HTMLAudioElement {
  let audio = cache.get(key);
  if (!audio) {
    const config = configFor(key);
    audio = new Audio(config.asset);
    audio.preload = "auto";
    audio.volume = effectiveVolume(config.volume ?? 1);
    cache.set(key, audio);
  }
  return audio;
}

/**
 * Preloads every sound whose config doesn't opt out (`preload: false`).
 * Call this exactly once during app startup (e.g. in the root
 * component's mount effect). Safe to call more than once — subsequent
 * calls are no-ops.
 */
export function initSounds(): void {
  if (preloaded || typeof window === "undefined") return;
  preloaded = true;
  (Object.keys(SOUND_CONFIG) as SoundKey[]).forEach((key) => {
    if (configFor(key).preload === false) return;
    const audio = getOrCreate(key);
    audio.load();
  });
}

function isSoundEnabled(): boolean {
  try {
    const a = api as unknown as { getSoundEnabled?: () => boolean };
    return a.getSoundEnabled ? a.getSoundEnabled() : true;
  } catch {
    // Storage not wired up yet, or threw for any reason — default to ON.
    return true;
  }
}

function getMasterVolume(): number {
  try {
    const a = api as unknown as { getMasterVolume?: () => number };
    const v = a.getMasterVolume ? a.getMasterVolume() : 1;
    return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 1;
  } catch {
    // Storage not wired up yet, or threw for any reason — default to full.
    return 1;
  }
}

/**
 * The single place effective playback volume is computed:
 * (sound's configured volume, defaulting to 1) × current master volume.
 * Every call site that assigns an audio element's `.volume` goes through
 * this — nothing else in the file computes volume on its own.
 */
function effectiveVolume(configuredVolume: number): number {
  return configuredVolume * getMasterVolume();
}

/**
 * Plays a sound by event key (use the SOUNDS catalogue). No-ops silently
 * if sound effects are disabled in settings, if playback is blocked by
 * the browser, or if the key is unknown. By default, clones the cached,
 * already-loaded element so the same sound can overlap itself (e.g.
 * rapid clicks) without cutting off a sound already in progress; sounds
 * configured with `allowOverlap: false` instead restart the single
 * shared instance.
 */
export function playSound(key: SoundEvent): void {
  if (typeof window === "undefined") return;
  if (!isSoundEnabled()) return;
  const config = configFor(key);
  const base = getOrCreate(key);
  const vol = effectiveVolume(config.volume ?? 1);

  if (config.allowOverlap === false) {
    base.volume = vol;
    base.currentTime = 0;
    void base.play().catch(() => {
      // Autoplay/interaction restrictions or missing file — fail silently.
    });
    return;
  }

  const node = base.cloneNode(true) as HTMLAudioElement;
  node.volume = vol;
  void node.play().catch(() => {
    // Autoplay/interaction restrictions or missing file — fail silently.
  });
}

/**
 * Loading is the one sound with a duration tied to an async operation
 * (OCR / quiz generation) rather than a fire-and-forget event, so it
 * can't go through playSound()'s one-shot/clone model. These two
 * functions are the minimal lifecycle for that: start it when the
 * operation begins, stop it when the operation ends (success or
 * failure) — always pair them in a try/finally at the call site. Safe
 * to call stopLoadingSound() even if it was never started.
 */
let loadingActive = false;
let loadingFadeIntervalId: number | null = null;

export function startLoadingSound(): void {
  if (typeof window === "undefined") return;
  if (loadingActive) return; // already looping — no-op
  if (!isSoundEnabled()) return;
  const audio = getOrCreate("loading");
  audio.loop = true;
  audio.volume = effectiveVolume(configFor("loading").volume ?? 1);
  audio.currentTime = 0;
  loadingActive = true;
  void audio.play().catch(() => {
    // Autoplay/interaction restrictions or missing file — fail silently,
    // and allow a future startLoadingSound() call to retry.
    loadingActive = false;
  });
}

export function stopLoadingSound(): void {
  if (typeof window === "undefined") {
    loadingActive = false;
    return;
  }
  if (!loadingActive) return; // not playing — safe no-op
  loadingActive = false;

  const audio = cache.get("loading");
  if (!audio) return;

  if (loadingFadeIntervalId !== null) {
    window.clearInterval(loadingFadeIntervalId);
    loadingFadeIntervalId = null;
  }

  const defaultVolume = effectiveVolume(configFor("loading").volume ?? 1);
  const fadeDurationMs = 400; // ~300-500ms fade-out
  const fadeSteps = 12;
  const stepMs = fadeDurationMs / fadeSteps;
  const startVolume = audio.volume;
  let step = 0;

  loadingFadeIntervalId = window.setInterval(() => {
    step += 1;
    audio.volume = Math.max(0, startVolume * (1 - step / fadeSteps));
    if (step >= fadeSteps) {
      window.clearInterval(loadingFadeIntervalId as number);
      loadingFadeIntervalId = null;
      audio.pause();
      audio.loop = false;
      audio.currentTime = 0;
      audio.volume = defaultVolume; // restore so the next start is full volume
    }
  }, stepMs);
}

/**
 * Gallery Entry has its own one-off lifecycle, separate from playSound():
 * it accompanies the intro video, and if it's still going 3s in, it gets
 * faded out over ~1s and reset rather than left to finish or cut off
 * abruptly. This only ever touches the single cached "gallery-entry"
 * element (not a clone), so it can be found and controlled again by the
 * scheduled fade. Does not affect playSound(), loading-sound, or any
 * other sound.
 */
let galleryEntryFadeTimeoutId: number | null = null;
let galleryEntryFadeIntervalId: number | null = null;

export function playGalleryEntrySound(): void {
  if (typeof window === "undefined") return;
  if (!isSoundEnabled()) return;

  // Clear any pending fade/reset left over from a previous play.
  if (galleryEntryFadeTimeoutId !== null) {
    window.clearTimeout(galleryEntryFadeTimeoutId);
    galleryEntryFadeTimeoutId = null;
  }
  if (galleryEntryFadeIntervalId !== null) {
    window.clearInterval(galleryEntryFadeIntervalId);
    galleryEntryFadeIntervalId = null;
  }

  const audio = getOrCreate("gallery-entry");
  const defaultVolume = effectiveVolume(configFor("gallery-entry").volume ?? 1);
  audio.volume = defaultVolume;
  audio.currentTime = 0;
  void audio.play().catch(() => {
    // Autoplay/interaction restrictions or missing file — fail silently.
  });

  // After exactly 3s of playback, fade to 0 over ~1s, then pause/reset.
  // If the clip already finished naturally before this fires, the
  // paused/ended checks below make it a no-op.
  galleryEntryFadeTimeoutId = window.setTimeout(() => {
    galleryEntryFadeTimeoutId = null;
    if (audio.paused || audio.ended) return; // finished naturally — do nothing

    const fadeDurationMs = 1000;
    const fadeSteps = 20;
    const stepMs = fadeDurationMs / fadeSteps;
    const startVolume = audio.volume;
    let step = 0;

    galleryEntryFadeIntervalId = window.setInterval(() => {
      step += 1;
      if (audio.paused || audio.ended) {
        // Finished naturally mid-fade — stop fading, leave it alone.
        window.clearInterval(galleryEntryFadeIntervalId as number);
        galleryEntryFadeIntervalId = null;
        audio.volume = defaultVolume;
        return;
      }
      audio.volume = Math.max(0, startVolume * (1 - step / fadeSteps));
      if (step >= fadeSteps) {
        window.clearInterval(galleryEntryFadeIntervalId as number);
        galleryEntryFadeIntervalId = null;
        audio.pause();
        audio.currentTime = 0;
        audio.volume = defaultVolume; // restore configured default
      }
    }, stepMs);
  }, 3000);
}
