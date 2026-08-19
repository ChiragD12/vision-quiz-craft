import { motion } from "framer-motion";
import { Link } from "@tanstack/react-router";
import { cloneElement, isValidElement, useEffect, useState } from "react";
import { lionAvatarUrl } from "@/lib/journey/assets";
import { TOTAL_STORY_IMAGES } from "@/lib/journey";
import type { ReactElement, ReactNode } from "react";

type LionLike = { id: number; name: string; english: string } | undefined;
type ChapterLike = { id: number; title: string; subtitle?: string } | undefined;
type ProgressLike = { unlocked: number; total: number; complete?: boolean };

interface Props {
  expanded: boolean;
  onToggle: () => void;
  onDismiss: () => void;
  lion: LionLike;
  chapter: ChapterLike;
  unlockCount: number;
  progress: ProgressLike;
  rewardProgress: number;
}

const SPRING = { type: "spring" as const, stiffness: 260, damping: 22, mass: 0.9 };
const SPRING_SOFT = { type: "spring" as const, stiffness: 200, damping: 26, mass: 1 };

// Cross layout offsets (desktop-first, from the lion's center).
const CAPSULE_TOP = { x: 0, y: -132 };
const CAPSULE_BOTTOM = { x: 0, y: 154 };
const CAPSULE_LEFT = { x: -145, y: 0 };
const CAPSULE_RIGHT = { x: 156, y: 0 };

// ---------------------------------------------------------------------------
// Sequencing
//
// The whole scene is driven by a single `expanded` boolean. Instead of
// mounting/unmounting pieces (AnimatePresence) with independent exit
// animations, every element stays mounted and animates between a
// "collapsed" and "expanded" value for its own properties. Each element is
// assigned a stage number; the further along the chain an element is, the
// later it starts on open, and the earlier it starts on close — giving the
// exact reverse choreography without any separate exit trees.
//
//   0 lion            (opens first,  closes last)
//   1 inner ring
//   2 outer ring
//   3 glow
//   4 connectors
//   5 capsules         (opens last,   closes first)
// ---------------------------------------------------------------------------
const MAX_STAGE = 5;
const ENTER_STEP = 0.04;
const EXIT_STEP = 0.035;

function stageDelay(expanded: boolean, stage: number, extra = 0) {
  return expanded ? stage * ENTER_STEP + extra : (MAX_STAGE - stage) * EXIT_STEP + extra;
}

type Direction = "up" | "down" | "left" | "right";

interface CapsuleSpec {
  dir: Direction;
  connectorLength: number;
  connectorOffset: { x: number; y: number };
  capsuleOffset: { x: number; y: number };
  extra: number;
  label: string;
  primary: ReactNode;
  secondary?: ReactNode;
  progress?: number;
}

export function JourneyHero({
  expanded,
  onToggle,
  onDismiss,
  lion,
  chapter,
  unlockCount,
  progress,
  rewardProgress,
}: Props) {
  // Once expanded, tapping the lion again enlarges just the lion image
  // (toggleable) instead of collapsing the hero. Collapsing only ever
  // happens via the outside-click handler below, so this is tracked
  // separately from `expanded` and reset whenever the hero collapses.
  const [lionLarge, setLionLarge] = useState(false);
  useEffect(() => {
    if (!expanded) setLionLarge(false);
  }, [expanded]);

  const handleLionClick = () => {
    if (!expanded) {
      onToggle();
    } else {
      setLionLarge((v) => !v);
    }
  };

  const capsules: CapsuleSpec[] = [
    {
      dir: "up",
      connectorLength: 33,
      connectorOffset: { x: 0, y: -128 },
      capsuleOffset: CAPSULE_TOP,
      extra: 0,
      label: "Current Chapter",
      primary: chapter?.title ?? "—",
      secondary: undefined,
    },
    {
      dir: "left",
      connectorLength: 55,
      connectorOffset: { x: -130, y: 0 },
      capsuleOffset: CAPSULE_LEFT,
      extra: 0.03,
      label: "Story Images",
      primary: `${unlockCount} / ${TOTAL_STORY_IMAGES}`,
      progress: unlockCount / TOTAL_STORY_IMAGES,
    },
    {
      dir: "right",
      connectorLength: 55,
      connectorOffset: { x: 138, y: 0 },
      capsuleOffset: CAPSULE_RIGHT,
      extra: 0.03,
      label: "Chapter Progress",
      primary: `${progress.unlocked} / ${progress.total}`,
      progress: progress.total > 0 ? progress.unlocked / progress.total : 0,
    },
    {
      dir: "down",
      connectorLength: 33,
      connectorOffset: { x: 0, y: 138 },
      capsuleOffset: CAPSULE_BOTTOM,
      extra: 0.06,
      label: "Next Journey Scene",
      primary: `${rewardProgress} / 125`,
      progress: rewardProgress / 125,
    },
  ];

  return (
    <div
      className="relative select-none"
      onClick={() => {
        if (expanded) onDismiss();
      }}
    >
      {/* Single scene, rooted at the lion. Everything below is a descendant
          so transforms and sequencing read top-to-bottom, and closing is a
          literal mirror of opening — nothing teleports or exits on its own. */}
      <motion.div
  initial={false}
  className="relative w-full"
        animate={{ height: expanded ? 460 : 160 }}
        transition={SPRING_SOFT}
      >
        <motion.div
  initial={false}
  animate={{
    opacity: expanded ? 1 : 0,
    y: expanded ? 0 : -12,
  }}
  transition={SPRING}
  className="absolute left-[48%] top-2 -translate-x-1/2 z-30"
>
  <div className="text-3xl font-bold text-white drop-shadow-lg">
    {lion?.name}
  </div>
</motion.div>
        <Lion expanded={expanded} large={lionLarge} lion={lion} onToggle={handleLionClick} />
        <Rings expanded={expanded} capsules={capsules} />
      </motion.div>
    </div>
  );
}

function Lion({
  expanded,
  large,
  lion,
  onToggle,
}: {
  expanded: boolean;
  large: boolean;
  lion: LionLike;
  onToggle: () => void;
}) {
  return (
    <motion.button
  initial={false}
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      animate={{
  left: expanded ? "calc(50% + 1px)" : 0,
  top: expanded ? "50%" : "50%",
  x: expanded ? "-50%" : 0,
        y: "-50%",
        scale: expanded ? 1.08 : 1,
      }}
      transition={{ ...SPRING, delay: stageDelay(expanded, 0) }}
      className="absolute z-20 flex flex-col items-center gap-2 focus:outline-none"
      style={{ transformOrigin: "center center" }}
    >
      {lion && (
        <motion.img
  initial={false}
          src={lionAvatarUrl(lion.id)}
          alt={lion.name}
          animate={{
            width: !expanded ? 80 : large ? 340 : 124,
            height: !expanded ? 80 : large ? 340 : 124,
            boxShadow: !expanded
              ? "0 0 30px rgba(251,191,36,0.18)"
              : large
              ? "0 0 140px rgba(251,191,36,0.55), 0 0 70px rgba(251,191,36,0.32), 0 20px 60px rgba(0,0,0,0.5)"
              : "0 0 60px rgba(251,191,36,0.35), 0 0 30px rgba(251,191,36,0.18)",
          }}
          transition={{ ...SPRING, delay: stageDelay(expanded, 0) }}
          className="rounded-full object-cover border border-primary/40"
          draggable={false}
        />
      )}
      <motion.div
  className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center"
  initial={false}
  animate={{
  y: 8,
  opacity: expanded ? 0 : 1,
}}
  transition={SPRING}
  style={{
  top: "100%",
  width: "180px",
}}
>
  <div className="text-xs font-medium tracking-wide text-white text-center leading-none">
    {lion?.name}
  </div>
</motion.div>
    </motion.button>
  );
}

function Rings({ expanded, capsules }: { expanded: boolean; capsules: CapsuleSpec[] }) {
  return (
    <>
      {/* Concentric rings — expand out from behind the lion. */}
      <motion.div
      initial={false}
        key="ring-inner"
        animate={{ opacity: expanded ? 1 : 0, scale: expanded ? 1 : 0.7 }}
        transition={{ ...SPRING, delay: stageDelay(expanded, 1) }}
        className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          width: 150,
          height: 150,
          border: "1px solid rgba(251,191,36,0.24)",
          boxShadow: "0 0 40px rgba(251,191,36,0.08) inset, 0 0 30px rgba(251,191,36,0.10)",
        }}
      />
      <motion.div
      initial={false}
        key="ring-outer"
        animate={{ opacity: expanded ? 1 : 0, scale: expanded ? 1 : 0.6 }}
        transition={{ ...SPRING, delay: stageDelay(expanded, 2) }}
        className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          width: 300,
          height: 300,
          border: "1px solid rgba(251,191,36,0.16)",
          boxShadow: "0 0 80px rgba(251,191,36,0.07) inset, 0 0 50px rgba(251,191,36,0.09)",
        }}
      />
      {/* Soft amber halo */}
      <motion.div
      initial={false}
        key="ring-glow"
        animate={{ opacity: expanded ? 0.42 : 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: stageDelay(expanded, 3) }}
        className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          width: 300,
          height: 300,
          background:
            "radial-gradient(circle at center, rgba(251,191,36,0.14), rgba(251,191,36,0.05) 40%, transparent 70%)",
          filter: "blur(6px)",
        }}
      />

      <ConnectorGroup expanded={expanded} capsules={capsules} />
    </>
  );
}

function ConnectorGroup({
  expanded,
  capsules,
}: {
  expanded: boolean;
  capsules: CapsuleSpec[];
}) {
  return (
    <div
      className="absolute inset-0"
      style={{ pointerEvents: expanded ? "auto" : "none" }}
    >
      {capsules.map((c) => (
        <Connector
          key={c.dir}
          expanded={expanded}
          length={c.connectorLength}
          offset={c.connectorOffset}
          dir={c.dir}
        >
          <Capsule
  expanded={expanded}
  offset={c.capsuleOffset}
  extra={c.extra}
  label={c.label}
  primary={c.primary}
  secondary={c.secondary}
  progress={c.progress}
  width={
    c.dir === "left" || c.dir === "right"
      ? 100
      : 178
  }
  height={
    c.dir === "up" || c.dir === "down"
      ? 64
      : 56
  }
/>
        </Connector>
      ))}
    </div>
  );
}

function Capsule({
  expanded,
  offset,
  extra,
  label,
  primary,
  secondary,
  progress,
width = 176,
height = 60,
connectorEndpointExpanded = { x: 0, y: 0 },
  connectorEndpointCollapsed = { x: 0, y: 0 },
}: {
  expanded: boolean;
  offset: { x: number; y: number };
  extra: number;
  label: string;
  primary: ReactNode;
  secondary?: ReactNode;
  progress?: number;
  width?: number;
  height?: number;
  connectorEndpointExpanded?: { x: number; y: number };
  connectorEndpointCollapsed?: { x: number; y: number };
}) {
  // The connector endpoint div already carries part of the journey (from the
  // ring out to the line's tip). The capsule only needs to travel the
  // remainder — offset minus what its parent endpoint already moved — so the
  // final resting position on screen is identical to before, even though the
  // motion is now genuinely inherited rather than independently computed.
  return (
    <motion.div
    initial={false}
      onClick={(e) => e.stopPropagation()}
      animate={
        expanded
          ? {
              opacity: 1,
              x: offset.x - connectorEndpointExpanded.x,
              y: offset.y - connectorEndpointExpanded.y,
              scale: 1,
              filter: "blur(0px)",
            }
          : {
              opacity: 0,
              x: -connectorEndpointCollapsed.x,
              y: -connectorEndpointCollapsed.y,
              scale: 0.7,
              filter: "blur(4px)",
            }
      }
      transition={{
  type: "spring",
  stiffness: 340,
  damping: 28,
  mass: 0.65,
  delay: stageDelay(expanded, 2, extra),
}}
      className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 rounded-[18px] px-4 py-3 text-center overflow-hidden flex flex-col justify-center"
style={{
  width,
  height,
  border: "1px solid rgba(212,178,88,0.14)",
  background:
  "linear-gradient(180deg, rgba(255,255,255,0.16), rgba(255,255,255,0.08))",
  backdropFilter: "blur(28px) saturate(140%)",
  WebkitBackdropFilter: "blur(28px) saturate(140%)",
  boxShadow:
    "0 10px 28px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.18)",
}}
    
    >
      <Link
    to="/profile"
    className="absolute inset-0 z-20"
    aria-label={`Open ${label}`}
  />
      {/* Soft top sheen — a single restrained highlight rather than a glow,
          giving the pill a touch of glass depth. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-[24px]"
        style={{
          background:
            "linear-gradient(180deg, rgba(255,250,235,0.22), rgba(255,250,235,0) 45%)",
          mixBlendMode: "overlay",
        }}
      />
      <div className="relative text-[10px] uppercase tracking-[0.18em] text-primary/75 font-medium leading-none">
        {label}
      </div>
      <div className="relative text-lg font-medium text-foreground nums mt-0.5 tracking-tight whitespace-nowrap leading-none">{primary}</div>
      {secondary && (
        <div className="relative text-[11px] text-muted-foreground/90 mt-1 font-light">{secondary}</div>
      )}
      {progress != null && (
        <div className="relative mt-1 h-[2px] w-full overflow-hidden rounded-full bg-primary/10">
  <motion.div
    className="h-full rounded-full"
    style={{
      background:
        "linear-gradient(90deg, rgba(251,191,36,0.85), rgba(251,191,36,0.55))",
      boxShadow: "0 0 6px rgba(251,191,36,0.25)",
    }}
    animate={{
      width: expanded
        ? `${Math.min(100, Math.max(0, progress * 100))}%`
        : "0%",
    }}
    transition={{
      duration: 0.55,
      ease: [0.22, 1, 0.36, 1],
      delay: 0.2,
    }}
  />
</div>
      )}
    </motion.div>
  );
}

function Connector({
  expanded,
  length,
  offset,
  dir,
  children,
}: {
  expanded: boolean;
  length: number;
  offset: { x: number; y: number };
  dir: Direction;
  children?: ReactNode;
}) {
  const x2 = dir === "left" ? -length : dir === "right" ? length : 0;
  const y2 = dir === "up" ? -length : dir === "down" ? length : 0;

  const lineX1 = length + (dir === "left" ? 45 : dir === "right" ? -45 : 0);
  const lineY1 = length + (dir === "up" ? 45 : dir === "down" ? -45 : 0);

  const lineTransition = { duration: 0.45, delay: stageDelay(expanded, 4) };

  // Where the line's tip sits, in the same world-space coordinates as
  // `offset` — i.e. relative to the lion/scene center — for both states.
  // Passed down so the capsule can net itself against a transform it now
  // genuinely inherits instead of independently re-deriving its position.
  const endpointExpanded = { x: offset.x + x2, y: offset.y + y2 };
  const endpointCollapsed = {
    x: offset.x + (lineX1 - length),
    y: offset.y + (lineY1 - length),
  };

  return (
    <motion.div
      className="pointer-events-none absolute left-1/2 top-1/2"
      style={{
        transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
      }}
    >
      <motion.svg
        animate={{ opacity: expanded ? 1 : 0 }}
        transition={lineTransition}
        className="overflow-visible"
        width={length * 2 + 10}
        height={length * 2 + 10}
      >
        <motion.line
          x1={lineX1}
          y1={lineY1}
          animate={{
            x2: expanded ? length + x2 : lineX1,
            y2: expanded ? length + y2 : lineY1,
          }}
          transition={lineTransition}
          stroke="rgba(251,191,36,0.50)"
          strokeWidth="1.2"
          strokeLinecap="round"
          style={{
            filter: "drop-shadow(0 0 2px rgba(251,191,36,0.18))",
          }}
        />
      </motion.svg>

      {/* Positioned exactly at the connector endpoint — the capsule (passed
          as children) becomes a true child of this transform, so it rides
          along with the line automatically instead of animating on its own
          independent track. */}
      <motion.div
        className="absolute"
        style={{ left: length, top: length, pointerEvents: expanded ? "auto" : "none" }}
        animate={{
          x: expanded ? x2 : lineX1 - length,
          y: expanded ? y2 : lineY1 - length,
        }}
        transition={lineTransition}
      >
        {isValidElement(children)
          ? cloneElement(children as ReactElement<{
              connectorEndpointExpanded?: { x: number; y: number };
              connectorEndpointCollapsed?: { x: number; y: number };
            }>, {
              connectorEndpointExpanded: endpointExpanded,
              connectorEndpointCollapsed: endpointCollapsed,
            })
          : children}
      </motion.div>
    </motion.div>
  );
}
