import { playSound, SOUNDS, type SoundEvent } from "@/lib/sound-manager";
import { celebrate, CELEBRATION, type CelebrationEvent } from "@/lib/celebration";
import { triggerHaptic, HAPTICS, type HapticEvent } from "@/lib/haptics";

// ---------------- Feedback layer ----------------
//
// Sits one level above the Sound Manager and the Celebration Engine.
// Feature code calls feedback(FEEDBACK.SOME_EVENT) instead of calling
// playSound(SOUNDS.SOME_EVENT) or celebrate(CELEBRATION.X) directly, so
// *what happened* (a semantic application event) is decoupled from *how
// the app currently reacts to it*. Today reacting means "play a sound"
// and/or "trigger a celebration" (itself still a no-op placeholder);
// later the same call can also trigger haptics or an accessibility
// announcement — none of that requires touching feature code, only
// adding a field to a feedback event's config below.
//
// Sound Manager keeps owning everything about audio itself: creation,
// caching, playback, preloading, and reading the sound preference.
// Celebration Engine keeps owning what an intensity level eventually
// renders as. This file never duplicates either — it only maps events to
// calls into each.
//
// To add a new feedback event in the future:
//   1. Add one FeedbackKey + one FEEDBACK entry below.
//   2. Add one FEEDBACK_CONFIG entry pointing it at a SOUNDS.* value
//      and/or a CELEBRATION.* value (and, once those channels exist, a
//      haptic/announce value too).
//   3. Call feedback(FEEDBACK.YOUR_NEW_EVENT) wherever it's needed.
// Nothing else changes — callers never know or care which channels fired.

// ---------------- 1. Application events ----------------
//
// What happened, in product terms — not what sound plays. Not meant to
// be referenced directly by feature code; use the FEEDBACK catalogue
// below instead, so call sites get autocomplete + compile-time safety.
export type FeedbackKey =
  | "QUIZ_CORRECT"
  | "QUIZ_WRONG"
  | "BUTTON_PRESS"
  | "BOOKMARK"
  | "IMAGE_UNLOCK"
  | "CHAPTER_COMPLETE"
  | "ACHIEVEMENT"
  | "GALLERY_OPEN"
  | "GALLERY_CLOSE"
  | "LION_OPEN"
  | "LION_EVOLVED"
  | "FLAME_CLICK"
  | "FLAME_ENTER"
  | "LOADING";

// ---------------- 2. Event catalogue ----------------
//
// The public, typo-proof way for feature code to refer to a feedback
// event: feedback(FEEDBACK.QUIZ_CORRECT) instead of a raw string.
export const FEEDBACK = {
  QUIZ_CORRECT: "QUIZ_CORRECT",
  QUIZ_WRONG: "QUIZ_WRONG",
  BUTTON_PRESS: "BUTTON_PRESS",
  BOOKMARK: "BOOKMARK",
  IMAGE_UNLOCK: "IMAGE_UNLOCK",
  CHAPTER_COMPLETE: "CHAPTER_COMPLETE",
  ACHIEVEMENT: "ACHIEVEMENT",
  GALLERY_OPEN: "GALLERY_OPEN",
  GALLERY_CLOSE: "GALLERY_CLOSE",
  LION_OPEN: "LION_OPEN",
  LION_EVOLVED: "LION_EVOLVED",
  FLAME_CLICK: "FLAME_CLICK",
  FLAME_ENTER: "FLAME_ENTER",
  LOADING: "LOADING",
} as const satisfies Record<string, FeedbackKey>;

export type FeedbackEvent = (typeof FEEDBACK)[keyof typeof FEEDBACK];

// ---------------- 3. Per-event configuration ----------------
//
// What each feedback event currently does. Only `sound` is wired up
// today (mapping straight to an existing SOUNDS.* entry); the other
// fields are reserved so future channels are additive, not a rewrite:
//   1. Add the field here (e.g. `haptic?: HapticPattern`).
//   2. Set it on the relevant FEEDBACK_CONFIG entries.
//   3. Dispatch it in feedback() below, behind an `if (config.haptic)`.
// No feature call site ever needs to change for this.
interface FeedbackConfig {
  /** Existing Sound Manager event this feedback event plays, if any. */
  sound?: SoundEvent;
  /** Celebration Engine intensity this feedback event triggers, if any.
   * Currently a no-op placeholder (see celebration.ts) — setting this
   * wires the *architecture* up now, without any visual effect existing
   * yet. */
  celebration?: CelebrationEvent;
  /** Haptics Engine intensity this feedback event triggers, if any. */
  haptic?: HapticEvent;
  // Reserved for future channels:
  // announce?: string; // accessibility live-region text
}

// Events with no `sound` or `celebration` (or any other channel)
// configured are valid, known events that currently no-op — e.g.
// BOOKMARK has no dedicated sound asset today. That's fine: feature code
// can start calling feedback(FEEDBACK.BOOKMARK) now, and it'll pick up a
// sound (or celebration, or haptic) the moment one is configured here,
// with no call-site change.
//
// LION_OPEN and LION_EVOLVED currently point at the same asset
// (lion-hero-open.mp3) because no dedicated "evolution" sound exists
// yet — they're kept as two separate semantic events on purpose so a
// future dedicated asset for LION_EVOLVED is a one-line config change
// here, not a call-site change.
const FEEDBACK_CONFIG: Record<FeedbackEvent, FeedbackConfig> = {
  QUIZ_CORRECT: { sound: SOUNDS.QUIZ_CORRECT, haptic: HAPTICS.LIGHT },
  QUIZ_WRONG: { sound: SOUNDS.QUIZ_WRONG, haptic: HAPTICS.WARNING },
  BUTTON_PRESS: { sound: SOUNDS.BUTTON_CLICK },
  BOOKMARK: { haptic: HAPTICS.LIGHT },
  IMAGE_UNLOCK: { sound: SOUNDS.UNLOCK_IMAGE, celebration: CELEBRATION.SMALL, haptic: HAPTICS.SUCCESS },
  CHAPTER_COMPLETE: {
    sound: SOUNDS.CHAPTER_COMPLETE,
    celebration: CELEBRATION.MEDIUM,
    haptic: HAPTICS.HEAVY,
  },
  ACHIEVEMENT: {
    sound: SOUNDS.ACHIEVEMENT,
    celebration: CELEBRATION.LEGENDARY,
    haptic: HAPTICS.SUCCESS,
  },
  GALLERY_OPEN: { sound: SOUNDS.GALLERY_ENTRY },
  GALLERY_CLOSE: { sound: SOUNDS.GALLERY_CLOSE },
  LION_OPEN: { sound: SOUNDS.LION_HERO_OPEN, haptic: HAPTICS.MEDIUM },
  // No dedicated Lion Evolution asset exists yet — temporarily reusing
  // lion-hero-open.mp3 (see comment above FEEDBACK_CONFIG).
  LION_EVOLVED: { sound: SOUNDS.LION_HERO_OPEN, haptic: HAPTICS.HEAVY },
  FLAME_CLICK: { sound: SOUNDS.FLAME_CLICK, haptic: HAPTICS.LIGHT },
  FLAME_ENTER: { sound: SOUNDS.ENTER_FLAME, haptic: HAPTICS.MEDIUM },
  LOADING: {},
};

// ---------------- Public API ----------------

/**
 * Fires every feedback channel configured for this event: sound
 * (delegated entirely to the Sound Manager's playSound, so sound
 * preferences/caching/preloading behave exactly as they already do) and
 * celebration (delegated to the Celebration Engine's celebrate, which is
 * currently a no-op placeholder — so this is architecturally live but
 * visually inert today). Safe to call for any FeedbackEvent, including
 * ones with nothing configured on either channel — it simply no-ops.
 */
export function feedback(key: FeedbackEvent): void {
  const config = FEEDBACK_CONFIG[key];

  if (config.sound) {
    playSound(config.sound);
  }

  if (config.celebration) {
    celebrate(config.celebration);
  }

  if (config.haptic) {
    triggerHaptic(config.haptic);
  }

  // Future channels plug in here, each gated behind its own config
  // field, added independently of the others:
  // if (config.announce) announceToScreenReader(config.announce);
}
