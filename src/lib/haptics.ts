// ---------------- Haptics ----------------
//
// Mirrors the Sound Manager's shape one level down: nothing outside this
// file ever calls navigator.vibrate() or knows a vibration pattern.
// feedback.ts calls triggerHaptic(HAPTICS.SOME_INTENSITY); everything
// below decides what that intensity actually vibrates and how.
//
// Uses navigator.vibrate() only. Browsers/devices without support (most
// desktop browsers, iOS Safari, etc.) simply no-op — this is treated as
// a normal, expected case, not an error.
//
// To add a new haptic intensity in the future:
//   1. Add one HapticKey + one HAPTIC_CONFIG entry + one HAPTICS entry
//      below.
//   2. Reference it via haptic: HAPTICS.YOUR_NEW_INTENSITY in a
//      feedback.ts FEEDBACK_CONFIG entry.
// Nothing else in the app changes.

// ---------------- 1. Intensity levels ----------------
//
// The internal identifier for each intensity. Not meant to be
// referenced directly by feature code — use the HAPTICS catalogue below
// instead, so call sites get autocomplete + compile-time safety instead
// of raw string literals.
export type HapticKey = "light" | "medium" | "heavy" | "success" | "warning";

// ---------------- 2. Per-intensity configuration ----------------
//
// One centralized place per intensity: what pattern it vibrates. This is
// the only place in the app that knows a vibrate() pattern.
interface HapticPatternConfig {
  /** Passed straight to navigator.vibrate(): a single duration in ms, or
   * an on/off/on/... sequence in ms. */
  pattern: number | number[];
}

const HAPTIC_CONFIG: Record<HapticKey, HapticPatternConfig> = {
  light: { pattern: 10 },
  medium: { pattern: 20 },
  heavy: { pattern: 35 },
  success: { pattern: [15, 40, 15] },
  warning: { pattern: [20, 30, 20, 30, 20] },
};

// ---------------- 3. Intensity catalogue ----------------
//
// The public, typo-proof way for feature code (via feedback.ts) to refer
// to an intensity: HAPTICS.LIGHT instead of the raw string "light". The
// `satisfies` clause guarantees every catalogue entry resolves to a real,
// configured HapticKey at compile time.
export const HAPTICS = {
  LIGHT: "light",
  MEDIUM: "medium",
  HEAVY: "heavy",
  SUCCESS: "success",
  WARNING: "warning",
} as const satisfies Record<string, HapticKey>;

export type HapticEvent = (typeof HAPTICS)[keyof typeof HAPTICS];

// ---------------- Playback engine ----------------
// Nothing below this line knows or cares about individual intensities —
// it's generic machinery driven entirely by HAPTIC_CONFIG.

function isVibrateSupported(): boolean {
  return (
    typeof navigator !== "undefined" && typeof navigator.vibrate === "function"
  );
}

/**
 * Triggers a haptic pulse by intensity (use the HAPTICS catalogue).
 * No-ops silently on any browser/device without navigator.vibrate()
 * support, or if the call throws for any reason (e.g. blocked by a
 * permissions policy) — vibration is always best-effort.
 */
export function triggerHaptic(key: HapticEvent): void {
  if (!isVibrateSupported()) return;
  const config = HAPTIC_CONFIG[key];
  try {
    navigator.vibrate(config.pattern);
  } catch {
    // Unsupported or blocked — fail silently.
  }
}
