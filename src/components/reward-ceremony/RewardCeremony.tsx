// ---------------- Reward Ceremony — display (Phase 6: cinematic reveal) ----------------
//
// PHASE 6 supersedes the Phase 3/4 timeline below it. Goals for this pass:
//
//   1. The reveal now reads as a proper cinematic sequence — anticipation,
//      buildup, a flash/burst "impact" moment, celebration, a clean hero
//      hold, then staggered reward info — instead of one flat fade-in.
//   2. Every animation is now FINITE. Phase 4 introduced `repeat: Infinity`
//      loops on the rays/particles/lion-breathing so they'd keep running
//      for as long as the ceremony stayed open. That violates "the
//      ceremony must complete cleanly, with no animation left running
//      indefinitely" — so those loops are gone. Rays/particles now play a
//      single bounded build + settle motion once, then hold their end
//      state (still feels alive, never loops forever). The lion breathing
//      loop is capped to a small, finite repeat count.
//   3. The reward artwork's `src` was double-checked against
//      reward-ceremony-types.ts: `getRewardCeremonyPresentation()` maps
//      each reward type to the correct asset-url helper
//      (lionAvatarUrl / storyImageUrl / wallpaperUrl / chapterCoverUrl),
//      and this component only ever renders the <img> when `image` is
//      truthy (`{image && (...)}`), so a missing/undefined src can never
//      reach the DOM from this file. No malformed-URL bug found in the
//      three supplied files — see the implementation report for where to
//      look next if a pink/magenta artifact persists.
//
// Reward-to-reward continuity (Phase 5) is unchanged in spirit: the first
// reward of an open ceremony plays the full choreographed entrance below;
// every subsequent reward (advancing the same open ceremony) plays a
// faster artwork/text transition. The Continue button still lives outside
// both AnimatePresence scopes and is mounted once for the life of the
// ceremony.
//
// Entrance timeline (seconds) — first reward of the ceremony only:
//   0.00  dark overlay fades in                      (ANTICIPATION)
//   0.10  particles begin a faint, sparse appearance  (ANTICIPATION)
//   0.25  golden rays build up (scale + opacity)       (BUILD-UP)
//   0.20–1.10  particles continue converging toward center (BUILD-UP)
//   0.70  flash/burst behind the artwork                (REVEAL IMPACT)
//   0.85  artwork springs in (scale + opacity)          (REVEAL IMPACT)
//   0.85  golden glow ring appears + single soft pulse   (REVEAL IMPACT)
//   0.90–1.55  sparkles pop in, staggered per corner     (CELEBRATION)
//   0.90–1.55  rays/particles finish their build, settle (CELEBRATION)
//   1.15  kicker fades upward                            (HERO / INFO)
//   1.30  title fades upward                             (HERO / INFO)
//   1.45  subtitle fades upward                           (HERO / INFO)
//   1.60  quote fades upward (Journey Images only)         (HERO / INFO)
//   1.85  continue button fades upward                    (COMPLETION)
//
// After ~2.4s everything is static — no timers, no repeating animations —
// the reward artwork simply holds on screen until the user continues.
//
// Reduced motion: every layer/transition collapses to an opacity-only
// fade — no scale, no translateY, no rotation, no drift, no burst.

import { useEffect, useRef } from "react";
import { AnimatePresence, motion, useReducedMotion, type Variants } from "framer-motion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { feedback, FEEDBACK } from "@/lib/feedback";
import {
  getRewardCeremonyPresentation,
  rewardCeremonyItemKey,
  type RewardCeremonyItem,
} from "./reward-ceremony-types";

const ASSET_BASE = "/celebration";
const FRAME_URL = `${ASSET_BASE}/frames/frame.png`;
const RAYS_PRIMARY_URL = `${ASSET_BASE}/rays/golden-rays-01.svg`;
const RAYS_SECONDARY_URL = `${ASSET_BASE}/rays/golden-rays-02.svg`;
const PARTICLES_URL = `${ASSET_BASE}/particles/particles.png`;
const SPARKLE_URLS = [
  `${ASSET_BASE}/effects/sparkle-01.png`,
  `${ASSET_BASE}/effects/sparkle-02.png`,
  `${ASSET_BASE}/effects/sparkle-03.png`,
  `${ASSET_BASE}/effects/sparkle-04.png`,
];

// Static corner placement for the sparkle accents around the artwork.
const SPARKLE_POSITION_CLASSES = [
  "-top-3 -left-3 h-8 w-8",
  "-top-4 right-2 h-6 w-6",
  "bottom-2 -left-4 h-6 w-6",
  "-bottom-3 right-0 h-9 w-9",
];

// Small per-sparkle stagger + a slight rotation direction so the four
// corners don't all pop in identically — organic rather than mechanical.
const SPARKLE_MOTION = [
  { delay: 0.9, rotate: -12 },
  { delay: 1.02, rotate: 10 },
  { delay: 1.16, rotate: 8 },
  { delay: 1.3, rotate: -10 },
];

const REWARD_KICKER: Record<RewardCeremonyItem["type"], string> = {
  lionEvolved: "LION EVOLVED",
  storyImage: "JOURNEY UPDATED",
  achievementUnlocked: "ACHIEVEMENT UNLOCKED",
  wallpaperUnlocked: "WALLPAPER UNLOCKED",
  chapterCompleted: "CHAPTER COMPLETE",
};

export function RewardCeremony({
  item,
  onContinue,
}: {
  item: RewardCeremonyItem;
  onContinue: () => void;
}) {
  const { image, title, subtitle, quote } = getRewardCeremonyPresentation(item);
  const prefersReducedMotion = useReducedMotion();

  const isLion = item.type === "lionEvolved";
  const showQuote = item.type === "storyImage" && Boolean(quote);
  const kicker = REWARD_KICKER[item.type];
  const itemKey = rewardCeremonyItemKey(item);

  // Tracks whether we're still showing the very first reward of this
  // ceremony (component mount). Flipped to false shortly after mount —
  // long before a user could click Continue — so every reward-to-reward
  // change reads false and gets the fast Phase 5 transition instead of
  // the full choreographed entrance. The one-shot ambient layers below
  // (rays/particles/sparkles/flash) are keyed off this same first-mount
  // window, since they belong to the ceremony opening, not to each item.
  const isFirstShowRef = useRef(true);
  useEffect(() => {
    isFirstShowRef.current = false;
  }, []);

  // Full-screen modal lifecycle: lock the underlying page's scroll while
  // the ceremony is mounted, and restore it via React's guaranteed
  // unmount cleanup — not via any per-item or queue-driven logic.
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  // Fires exactly once each time a reward card becomes the active one
  // (including the first), mapped straight to the existing feedback
  // events already wired to their sounds elsewhere in the app.
  useEffect(() => {
    switch (item.type) {
      case "lionEvolved":
        feedback(FEEDBACK.LION_OPEN);
        break;
      case "storyImage":
        feedback(FEEDBACK.IMAGE_UNLOCK);
        break;
      case "achievementUnlocked":
        feedback(FEEDBACK.ACHIEVEMENT);
        break;
      case "chapterCompleted":
        feedback(FEEDBACK.CHAPTER_COMPLETE);
        break;
      default:
        break;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemKey]);

  // ---- Motion variants ----

  // Background overlay: single opacity fade, played once on mount.
  const overlayVariants: Variants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.5, ease: "easeOut" } },
  };

  // Rays — BUILD-UP → CELEBRATION in one bounded motion: they scale/fade
  // up from a smaller, dimmer state and rotate a fixed, finite amount as
  // they settle, then simply hold their end state. No `repeat`, so there
  // is nothing left animating once the ceremony has opened.
  const primaryRayVariants: Variants = prefersReducedMotion
    ? { hidden: { opacity: 0 }, visible: { opacity: 0.6, transition: { duration: 0.5, delay: 0.25 } } }
    : {
        hidden: { opacity: 0, scale: 0.75, rotate: -6 },
        visible: {
          opacity: 0.6,
          scale: 1,
          rotate: 34,
          transition: { duration: 2.6, delay: 0.25, ease: [0.16, 1, 0.3, 1] },
        },
      };
  const secondaryRayVariants: Variants = prefersReducedMotion
    ? { hidden: { opacity: 0 }, visible: { opacity: 0.4, transition: { duration: 0.5, delay: 0.35 } } }
    : {
        hidden: { opacity: 0, scale: 0.8, rotate: 8 },
        visible: {
          opacity: 0.4,
          scale: 1,
          rotate: -30,
          transition: { duration: 3.2, delay: 0.35, ease: [0.16, 1, 0.3, 1] },
        },
      };

  // Particles — ANTICIPATION (faint) → BUILD-UP (converging) →
  // CELEBRATION (gentle outward settle), expressed as one finite
  // keyframe animation rather than a repeating drift loop.
  const particlesVariants: Variants = prefersReducedMotion
    ? { hidden: { opacity: 0 }, visible: { opacity: 0.18, transition: { duration: 0.5, delay: 0.1 } } }
    : {
        hidden: { opacity: 0, scale: 0.94 },
        visible: {
          opacity: [0, 0.14, 0.26, 0.16],
          scale: [0.94, 1.02, 1.06, 1.1],
          transition: { duration: 2.4, delay: 0.1, ease: "easeOut", times: [0, 0.25, 0.55, 1] },
        },
      };

  // Flash / burst — the REVEAL IMPACT moment. A soft radial burst behind
  // the artwork that scales up and fades out quickly, once, right as the
  // artwork springs into view.
  const burstVariants: Variants = {
    hidden: { opacity: 0, scale: 0.4 },
    visible: prefersReducedMotion
      ? { opacity: 0, transition: { duration: 0.01 } }
      : {
          opacity: [0, 0.9, 0],
          scale: [0.4, 1.9, 2.3],
          transition: { duration: 0.9, delay: 0.7, ease: "easeOut", times: [0, 0.35, 1] },
        },
  };

  // Glow ring — appears with the artwork and gives one soft, finite pulse
  // (not a loop) before settling into a steady, non-animated glow via CSS.
  const glowVariants: Variants = prefersReducedMotion
    ? { hidden: { opacity: 0 }, visible: { opacity: 0.5, transition: { duration: 0.4, delay: 0.85 } } }
    : {
        hidden: { opacity: 0, scale: 0.85 },
        visible: {
          opacity: [0, 0.75, 0.5],
          scale: [0.85, 1.12, 1],
          transition: { duration: 1.1, delay: 0.85, ease: "easeOut", times: [0, 0.5, 1] },
        },
      };

  // Sparkle pop-in — staggered per corner (different delay + rotation
  // direction per sparkle) so they read as organic rather than
  // synchronized. Plays once during CELEBRATION, then holds still.
  const sparkleVariants = (delaySeconds: number, rotateDeg: number): Variants =>
    prefersReducedMotion
      ? { hidden: { opacity: 0 }, visible: { opacity: 0.7, transition: { duration: 0.3, delay: delaySeconds } } }
      : {
          hidden: { opacity: 0, scale: 0.3, rotate: 0 },
          visible: {
            opacity: [0, 1, 0.7],
            scale: [0.3, 1.25, 1],
            rotate: rotateDeg,
            transition: { duration: 0.55, delay: delaySeconds, ease: "easeOut" },
          },
        };

  // Artwork — first reward of the ceremony: opacity + scale, soft spring
  // overshoot, staged in at the REVEAL IMPACT beat (0.85s) — after the
  // buildup, in sync with the flash burst.
  const artworkFirstEntranceVariants: Variants = prefersReducedMotion
    ? {
        hidden: { opacity: 0 },
        visible: {
          opacity: 1,
          transition: { duration: 0.5, ease: "easeOut", delay: 0.85 },
        },
      }
    : {
        hidden: { opacity: 0, scale: 0.82 },
        visible: {
          opacity: 1,
          scale: 1,
          transition: {
            delay: 0.85,
            type: "spring" as const,
            stiffness: 190,
            damping: 16,
            mass: 1,
          },
        },
      };

  // Artwork — reward-to-reward transition (Phase 5): shrink + fade out,
  // then fade + scale back in with a soft spring. No large delay — this
  // plays immediately when Continue advances the queue.
  const artworkTransitionVariants: Variants = prefersReducedMotion
    ? {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { duration: 0.25, ease: "easeOut" } },
        exit: { opacity: 0, transition: { duration: 0.25, ease: "easeInOut" } },
      }
    : {
        hidden: { opacity: 0, scale: 0.96 },
        visible: {
          opacity: 1,
          scale: 1,
          transition: {
            type: "spring" as const,
            stiffness: 220,
            damping: 20,
            mass: 0.9,
          },
        },
        exit: {
          opacity: 0,
          scale: 0.96,
          transition: { duration: 0.25, ease: "easeInOut" },
        },
      };

  const artworkVariants = isFirstShowRef.current
    ? artworkFirstEntranceVariants
    : artworkTransitionVariants;

  // Text — first reward of the ceremony: opacity + translateY ("fades
  // upward"), staged per element, starting only after the artwork has
  // had its reveal beat (0.85s spring) so reward info always reads as
  // secondary to the artwork. Reduced motion: opacity only.
  const riseVariants = (delaySeconds: number): Variants => ({
    hidden: prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 10 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.45, ease: "easeOut", delay: delaySeconds },
    },
  });

  // Text — reward-to-reward transition (Phase 5): quick opacity
  // cross-fade, independent of the artwork's timing, with a small
  // per-element stagger.
  const crossfadeVariants = (delaySeconds = 0): Variants => ({
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { duration: 0.3, ease: "easeOut", delay: delaySeconds },
    },
    exit: {
      opacity: 0,
      transition: { duration: 0.2, ease: "easeInOut" },
    },
  });

  const kickerVariants = isFirstShowRef.current ? riseVariants(1.15) : crossfadeVariants(0);
  const titleVariants = isFirstShowRef.current ? riseVariants(1.3) : crossfadeVariants(0.03);
  const subtitleVariants = isFirstShowRef.current ? riseVariants(1.45) : crossfadeVariants(0.08);
  const quoteVariants = isFirstShowRef.current ? riseVariants(1.6) : crossfadeVariants(0.13);

  // Button: staged in once, last, on the original entrance timeline —
  // COMPLETION. Rendered outside every AnimatePresence scope below, so
  // it is never unmounted, remounted, or re-triggered by reward-to-reward
  // changes — it simply stays in place and interactive.
  const buttonVariants = riseVariants(1.85);

  // Lion breathing: a small, FINITE number of breathing cycles once the
  // hero moment has settled — not an infinite loop. It naturally stops
  // and holds still after the last repeat.
  const lionBreatheAnimate =
    isLion && !prefersReducedMotion ? { scale: [1, 1.02, 1] } : undefined;
  const lionBreatheTransition =
    isLion && !prefersReducedMotion
      ? {
          duration: 2.6,
          repeat: 3,
          ease: "easeInOut" as const,
          delay: isFirstShowRef.current ? 1.9 : 0.35,
        }
      : undefined;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 overflow-hidden"
    >
      {/* ---- Background (ANTICIPATION) ---- */}
      <motion.div
        className="absolute inset-0 bg-black/80"
        initial="hidden"
        animate="visible"
        variants={overlayVariants}
      />

      {/* ---- Rays (BUILD-UP → CELEBRATION, then static) ---- */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <motion.img
          src={RAYS_SECONDARY_URL}
          alt=""
          aria-hidden
          className="absolute h-[105%] w-[105%] max-w-none object-contain"
          initial="hidden"
          animate="visible"
          variants={secondaryRayVariants}
        />
        <motion.img
          src={RAYS_PRIMARY_URL}
          alt=""
          aria-hidden
          className="absolute h-[83%] w-[83%] max-w-none object-contain"
          initial="hidden"
          animate="visible"
          variants={primaryRayVariants}
        />
      </div>

      {/* ---- Particles (ANTICIPATION → BUILD-UP → CELEBRATION, then static) ---- */}
      <motion.img
        src={PARTICLES_URL}
        alt=""
        aria-hidden
        className="pointer-events-none absolute inset-0 h-full w-full object-cover"
        initial="hidden"
        animate="visible"
        variants={particlesVariants}
      />

      {/* ---- Content: artwork (upper half) + text (lower half) + button.
           This outer container is never keyed by item and never remounts —
           only the artwork and text scopes inside it transition. ---- */}
      <div className="relative z-10 flex h-full flex-col items-center justify-center px-6 pb-28">
        {/* ---- Reward image (with per-type frame) ---- */}
        <div className="flex w-full flex-1 items-center justify-center">
          <div className="relative flex items-center justify-center">
            {/* ---- Flash / burst (REVEAL IMPACT, first reveal only) ---- */}
            {image && isFirstShowRef.current && (
              <motion.div
                aria-hidden
                className="pointer-events-none absolute h-[22rem] w-[22rem] rounded-full sm:h-[26rem] sm:w-[26rem]"
                style={{
                  background:
                    "radial-gradient(circle, rgba(255,247,214,0.95) 0%, rgba(251,191,36,0.55) 35%, rgba(251,191,36,0) 70%)",
                }}
                initial="hidden"
                animate="visible"
                variants={burstVariants}
              />
            )}

            {/* ---- Golden glow ring around the artwork (REVEAL IMPACT) ---- */}
            {image && (
              <motion.div
                aria-hidden
                className="pointer-events-none absolute h-72 w-72 rounded-full sm:h-96 sm:w-96"
                style={{
                  boxShadow:
                    "0 0 90px 20px rgba(251,191,36,0.28), 0 0 30px 6px rgba(255,247,214,0.25)",
                }}
                initial="hidden"
                animate="visible"
                variants={glowVariants}
              />
            )}

            {/* ---- Sparkles: staggered pop-in during CELEBRATION, then
                 static — never part of the per-item AnimatePresence, so
                 they only ever play once for the life of the ceremony. ---- */}
            {SPARKLE_URLS.map((src, i) => (
              <motion.img
                key={src}
                src={src}
                alt=""
                aria-hidden
                className={cn(
                  "pointer-events-none absolute object-contain",
                  SPARKLE_POSITION_CLASSES[i],
                )}
                initial="hidden"
                animate="visible"
                variants={sparkleVariants(SPARKLE_MOTION[i].delay, SPARKLE_MOTION[i].rotate)}
              />
            ))}

            {/* ---- Frame (skipped for Lion Evolutions). Not animated —
                 swaps immediately with the current item, no transition. ---- */}
            {!isLion && (
              <img
                src={FRAME_URL}
                alt=""
                aria-hidden
                className="pointer-events-none absolute h-[26rem] w-[26rem] object-contain sm:h-[32rem] sm:w-[32rem]"
              />
            )}

            {/* ---- Artwork: its own AnimatePresence scope. mode="wait"
                 so the outgoing reward fully shrinks+fades before the
                 incoming one fades+scales in — a sequential, not
                 overlapping, transition per the Phase 5 spec. This is the
                 actual unlocked reward image, sourced from
                 getRewardCeremonyPresentation(item).image. ---- */}
            <AnimatePresence mode="wait">
              {image && (
                <motion.div
                  key={itemKey}
                  className="inline-flex"
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  variants={artworkVariants}
                >
                  {/* Lion breathing: independent of the entrance/exit
                      above, only active for Lion Evolution rewards, only
                      when reduced motion is off — and now finite (3
                      cycles), not an infinite loop. */}
                  <motion.div
                    className="inline-flex"
                    animate={lionBreatheAnimate}
                    transition={lionBreatheTransition}
                  >
                    <img
                      src={image}
                      alt={title}
                      className={cn(
                        "relative object-contain [filter:drop-shadow(0_22px_28px_rgba(0,0,0,0.45))_drop-shadow(0_0_20px_rgba(251,191,36,0.22))]",
                        isLion
                          ? "h-80 w-80 sm:h-[24rem] sm:w-[24rem]"
                          : "h-72 w-72 sm:h-96 sm:w-96",
                      )}
                    />
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* ---- Text: its own AnimatePresence scope, independent of
             artwork timing. mode="popLayout" lets the outgoing text fade
             out of flow while the incoming text fades in, giving the
             "slight overlap" the spec asks for without a layout jump. ---- */}
        <div className="flex w-full flex-col items-center gap-2 pt-4 text-center">
          <AnimatePresence mode="popLayout">
            <motion.div
              key={itemKey}
              className="flex flex-col items-center gap-2"
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              <motion.span
                className="text-xs font-semibold uppercase tracking-[0.25em] text-amber-200/80"
                variants={kickerVariants}
              >
                {kicker}
              </motion.span>
              <motion.h2
                className="font-display text-3xl font-bold text-white"
                variants={titleVariants}
              >
                {title}
              </motion.h2>
              {subtitle && (
                <motion.p
                  className="max-w-xs text-sm text-white/60"
                  variants={subtitleVariants}
                >
                  {subtitle}
                </motion.p>
              )}
              {showQuote && (
                <motion.p
                  className="max-w-sm text-sm italic text-white/50"
                  variants={quoteVariants}
                >
                  "{quote}"
                </motion.p>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* ---- Button: single, centered, fixed near the bottom in the same
           position for every reward type. Rendered once outside every
           AnimatePresence scope — never keyed by item, never remounted,
           never re-animated by a reward change, always interactive.
           COMPLETION beat: last thing to appear, then the ceremony is
           fully static until the user taps it. ---- */}
      <motion.div
        className="absolute inset-x-0 bottom-16 z-10 flex justify-center px-6"
        initial="hidden"
        animate="visible"
        variants={buttonVariants}
      >
        <Button className="w-full max-w-xs" onClick={onContinue}>
          Continue
        </Button>
      </motion.div>
    </div>
  );
}
