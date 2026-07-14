// ---------------- Celebration Engine ----------------
//
// Sits alongside the Sound Manager as another channel the Feedback layer
// can dispatch to. Celebrations are semantic *intensity levels*, not
// animations — "how big a deal is this" rather than "confetti vs
// particles vs an overlay." That choice is deliberately left to whatever
// implementation eventually backs celebrate() below, so call sites never
// need to know or care whether a given intensity ends up as an overlay,
// particles, confetti, fire, text, or some future combination of those.
//
// Today celebrate() is a safe no-op placeholder: no rendering, no
// animation, nothing imported that touches the DOM. It exists purely so
// the Feedback layer (and, eventually, feature code) can already call it
// and be forward-compatible with whatever gets built here later.
//
// To plug in a real implementation later:
//   1. Build whatever renders a celebration (overlay/particles/confetti/
//      fire/text/animation) as its own thing, however it needs to work.
//   2. Have celebrate() below decide, per CelebrationEvent, which of
//      those to trigger.
// Nothing outside this file changes — every existing celebrate(...) call
// site picks up the real behavior automatically.

// ---------------- 1. Celebration intensities ----------------
//
// Not meant to be referenced directly by feature code; use the
// CELEBRATION catalogue below instead, so call sites get autocomplete +
// compile-time safety instead of raw string literals.
export type CelebrationKey =
  | "SMALL"
  | "MEDIUM"
  | "LARGE"
  | "LEGENDARY"
  | "CUSTOM";

// ---------------- 2. Intensity catalogue ----------------
//
// The public, typo-proof way to refer to a celebration intensity:
// celebrate(CELEBRATION.LEGENDARY) instead of a raw string.
export const CELEBRATION = {
  SMALL: "SMALL",
  MEDIUM: "MEDIUM",
  LARGE: "LARGE",
  LEGENDARY: "LEGENDARY",
  CUSTOM: "CUSTOM",
} as const satisfies Record<string, CelebrationKey>;

export type CelebrationEvent = (typeof CELEBRATION)[keyof typeof CELEBRATION];

// ---------------- Public API ----------------

/**
 * Triggers a celebration at the given intensity. Currently a no-op
 * placeholder — no overlay, no particles, no animation, nothing
 * rendered. Safe to call from anywhere (including the Feedback layer)
 * ahead of a real implementation existing; behavior will change only
 * inside this function once one is built.
 */
export function celebrate(intensity: CelebrationEvent): void {
  // Intentionally empty for now. Once a visual implementation exists,
  // this is the single place that maps intensity -> effect, e.g.:
  //   switch (intensity) {
  //     case CELEBRATION.SMALL: return showTextPop();
  //     case CELEBRATION.MEDIUM: return runConfetti();
  //     case CELEBRATION.LARGE: return runConfetti({ big: true });
  //     case CELEBRATION.LEGENDARY: return showOverlay("legendary");
  //     case CELEBRATION.CUSTOM: return /* caller-defined, once supported */;
  //   }
  void intensity;
}
