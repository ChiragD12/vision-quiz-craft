// ---------------- Reward Ceremony — display (Phase 5) ----------------
//
// PHASE 3: motion only. Layout, spacing, typography, and assets are
// unchanged from Phase 2 — this pass only wraps the existing sections in
// framer-motion so the same structure animates in on a fixed timeline.
//
// PHASE 4: ambient motion. Adds continuous, very slow animation on top of
// the Phase 3 entrance timeline — ray rotation, particle drift, and (Lion
// Evolution only) a subtle breathing scale on the artwork. These loops
// live on layers/wrappers that are never remounted by AnimatePresence or
// by advancing the queue, so they run uninterrupted for as long as the
// ceremony stays open. No layout, spacing, typography, or asset changes.
//
// PHASE 5: reward-to-reward continuity. The single "whole content group"
// AnimatePresence from Phase 3/4 is split into two independent
// AnimatePresence scopes — artwork, and text (kicker/title/subtitle/
// quote) — so they can transition on their own timelines instead of
// fading together as one block. The Continue button now lives outside
// both scopes entirely: it is mounted once for the life of the ceremony
// and never remounts, moves, or disappears between rewards.
//
// The very first reward in a ceremony still plays the original,
// choreographed entrance timeline (rays/particles/artwork/text staged in
// on the 0-1100ms schedule below). Every subsequent reward (advancing
// within the same open ceremony) instead plays the faster Phase 5
// transition: artwork shrinks+fades out, then fades+scales back in;
// text cross-fades independently and is allowed to overlap slightly.
// Background/rays/particles/sparkles/frame are never part of either
// transition and are untouched by reward-to-reward changes.
//
// Entrance timeline (ms) — first reward of the ceremony only:
//   0    overlay fades in            (opacity)
//   150  rays fade in                (opacity, no rotation)
//   300  particles fade in           (opacity)
//   450  artwork: 0.92 -> 1.03 -> 1.00, soft spring (opacity + scale)
//   650  title fades upward          (opacity + translateY)
//   800  subtitle fades upward       (opacity + translateY)
//   950  quote fades upward          (Journey Images only)
//   1100 continue button fades upward
//
// Sparkles remain static (per spec: no sparkle animation, no particle
// spawning, no ray glow).
//
// NOTE: RewardCeremonyProvider mounts <RewardCeremony> without a
// per-item key, so this component persists across the whole queue.
// That persistence is what lets the Phase 4 ambient loops (ray
// rotation, particle drift) and the Phase 5 independent artwork/text
// transitions run without the background layer ever unmounting.
//
// Reduced motion: every layer/transition becomes an opacity-only fade —
// no scale, no translateY, no rotation, no drift.

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

// Static corner placement for the sparkle accents around the artwork —
// unchanged from Phase 2, still not animated.
const SPARKLE_POSITION_CLASSES = [
  "-top-3 -left-3 h-8 w-8",
  "-top-4 right-2 h-6 w-6",
  "bottom-2 -left-4 h-6 w-6",
  "-bottom-3 right-0 h-9 w-9",
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
  // the full choreographed entrance.
  const isFirstShowRef = useRef(true);
  useEffect(() => {
    isFirstShowRef.current = false;
  }, []);

  // Full-screen modal lifecycle: lock the underlying page's scroll while
  // the ceremony is mounted, and restore it via React's guaranteed
  // unmount cleanup — not via any per-item or queue-driven logic. This
  // runs exactly once per ceremony (mount -> unmount), so it can't be
  // skipped or double-fired by reward-to-reward changes, and it always
  // fires even if the parent removes <RewardCeremony/> on the same tick
  // it empties the queue after the final item's Continue press.
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
  // Background / rays / particles: opacity only, always (reduced motion
  // changes nothing here since these were never more than a fade). Only
  // ever played once, on ceremony mount — never replayed between rewards.
  const layerVariants = (delaySeconds: number): Variants => ({
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { duration: 0.5, ease: "easeOut", delay: delaySeconds },
    },
  });

  // Artwork — first reward of the ceremony: opacity + scale, soft spring
  // overshoot (0.92 -> ~1.03 -> 1.00), staged in at 450ms.
  const artworkFirstEntranceVariants: Variants = prefersReducedMotion
    ? {
        hidden: { opacity: 0 },
        visible: {
          opacity: 1,
          transition: { duration: 0.5, ease: "easeOut", delay: 0.45 },
        },
      }
    : {
        hidden: { opacity: 0, scale: 0.92 },
        visible: {
          opacity: 1,
          scale: 1,
          transition: {
            delay: 0.45,
            type: "spring" as const,
            stiffness: 170,
            damping: 18,
            mass: 1,
          },
        },
      };

  // Artwork — reward-to-reward transition (Phase 5): shrink + fade out
  // over 250ms, then fade + scale back in with a soft spring. No large
  // delay — this plays immediately when Continue advances the queue.
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
  // upward"), staged per element. Reduced motion: opacity only.
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
  // per-element stagger so kicker/title/subtitle/quote don't all snap at
  // once — reads as "independent" fades with slight overlap rather than
  // one synchronized block.
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

  const kickerVariants = isFirstShowRef.current ? riseVariants(0.65) : crossfadeVariants(0);
  const titleVariants = isFirstShowRef.current ? riseVariants(0.65) : crossfadeVariants(0.03);
  const subtitleVariants = isFirstShowRef.current ? riseVariants(0.8) : crossfadeVariants(0.08);
  const quoteVariants = isFirstShowRef.current ? riseVariants(0.95) : crossfadeVariants(0.13);

  // Button: staged in once on the original entrance timeline. It is
  // rendered outside every AnimatePresence scope below, so it is never
  // unmounted, remounted, or re-triggered by reward-to-reward changes —
  // it simply stays in place and interactive.
  const buttonVariants = riseVariants(1.1);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 overflow-hidden"
    >
      {/* ---- Background ---- */}
      <motion.div
        className="absolute inset-0 bg-black/75"
        initial="hidden"
        animate="visible"
        variants={layerVariants(0)}
      />

      {/* ---- Rays ---- */}
      <motion.div
        className="pointer-events-none absolute inset-0 flex items-center justify-center"
        initial="hidden"
        animate="visible"
        variants={layerVariants(0.15)}
      >
        <motion.img
          src={RAYS_SECONDARY_URL}
          alt=""
          aria-hidden
          className="absolute h-[105%] w-[105%] max-w-none object-contain opacity-40"
          animate={prefersReducedMotion ? undefined : { rotate: -360 }}
          transition={
            prefersReducedMotion
              ? undefined
              : { duration: 180, repeat: Infinity, ease: "linear" }
          }
        />
        <motion.img
          src={RAYS_PRIMARY_URL}
          alt=""
          aria-hidden
          className="absolute h-[83%] w-[83%] max-w-none object-contain opacity-60"
          animate={prefersReducedMotion ? undefined : { rotate: 360 }}
          transition={
            prefersReducedMotion
              ? undefined
              : { duration: 120, repeat: Infinity, ease: "linear" }
          }
        />
      </motion.div>

      {/* ---- Particles ---- */}
      <motion.div
        className="pointer-events-none absolute inset-0"
        initial="hidden"
        animate="visible"
        variants={layerVariants(0.3)}
      >
        <motion.img
          src={PARTICLES_URL}
          alt=""
          aria-hidden
          className="absolute inset-0 h-full w-full object-cover opacity-20"
          animate={
            prefersReducedMotion
              ? undefined
              : { x: [0, 8, -6, 0], y: [0, -10, 6, 0] }
          }
          transition={
            prefersReducedMotion
              ? undefined
              : { duration: 40, repeat: Infinity, ease: "easeInOut" }
          }
        />
      </motion.div>

      {/* ---- Content: artwork (upper half) + text (lower half) + button.
           This outer container is never keyed by item and never remounts —
           only the artwork and text scopes inside it transition. ---- */}
      <div className="relative z-10 flex h-full flex-col items-center justify-center px-6 pb-28">
        {/* ---- Reward image (with per-type frame) ---- */}
        <div className="flex w-full flex-1 items-center justify-center">
          <div className="relative flex items-center justify-center">
            {/* ---- Sparkles (static, not animated, not part of any
                 AnimatePresence — present unchanged for every reward) ---- */}
            {SPARKLE_URLS.map((src, i) => (
              <img
                key={src}
                src={src}
                alt=""
                aria-hidden
                className={cn(
                  "pointer-events-none absolute object-contain opacity-70",
                  SPARKLE_POSITION_CLASSES[i],
                )}
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
                 overlapping, transition per the Phase 5 spec. ---- */}
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
                  {/* Lion breathing loop: independent of the entrance/exit
                      above, only active for Lion Evolution rewards, only
                      when reduced motion is off. Restarts (softly) each
                      time a new Lion reward mounts. */}
                  <motion.div
                    className="inline-flex"
                    animate={
                      isLion && !prefersReducedMotion
                        ? { scale: [1, 1.02, 1] }
                        : undefined
                    }
                    transition={
                      isLion && !prefersReducedMotion
                        ? {
                            duration: 5,
                            repeat: Infinity,
                            ease: "easeInOut",
                            delay: isFirstShowRef.current ? 1.3 : 0.35,
                          }
                        : undefined
                    }
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
           never re-animated by a reward change, always interactive. ---- */}
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
