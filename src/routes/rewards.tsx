import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { StreakRing } from "@/components/streak-ring";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { api, ACHIEVEMENTS, evaluateAchievementsNow, type Achievement } from "@/lib/store";
import {
  TOTAL_IMAGE_REWARDS,
  nextImageReward,
} from "@/lib/rewards";
import {
  currentChapter,
  chapterProgress,
  currentLion,
  unlockedWallpapers,
  unlockedJourneyAchievements,
  WALLPAPERS,
  JOURNEY_ACHIEVEMENTS,
  CHAPTERS,
  TOTAL_STORY_IMAGES,
} from "@/lib/journey";
import {
  Settings,
  Lock,
  BarChart3,
  Trophy,
  Sparkles,
  Star,
  Moon,
  Sun,
  Gem,
  Award,
  Medal,
  Crown,
  Flame as FlameLucide,
  Zap,
  Target,
  CheckCircle2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Flame from "@/components/Flame";
import { useEffect, useState, useCallback, useRef } from "react";
import type { PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AppBackground } from "@/components/app-background";
import { buildRewardCeremonyQueue } from "@/components/reward-ceremony/reward-ceremony-types";
import { useRewardCeremony } from "@/components/reward-ceremony/RewardCeremonyContext";
import { feedback, FEEDBACK } from "@/lib/feedback";
import { playGalleryEntrySound } from "@/lib/sound-manager";

export const Route = createFileRoute("/rewards")({
  component: RewardsPage,
});


function useDB() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const cb = () => setTick((t) => t + 1);
    window.addEventListener("upsc-db-change", cb);
    window.addEventListener("storage", cb);
    return () => {
      window.removeEventListener("upsc-db-change", cb);
      window.removeEventListener("storage", cb);
    };
  }, []);
  return tick;
}

// Drag-to-scroll behaviour shared by the reward carousels below — same
// interaction model as GallerySection: click-and-drag anywhere on desktop,
// grab/grabbing cursor, a small drag threshold before click-suppression kicks
// in (so a plain click still opens dialogs), and native touch/momentum
// scrolling left untouched on mobile.
function useDragScroll<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const drag = useRef({
    active: false,
    dragging: false,
    startX: 0,
    scrollLeft: 0,
  });

  const onPointerDown = useCallback((e: ReactPointerEvent) => {
    if (e.pointerType !== "mouse") return; // leave touch to native scrolling
    const el = ref.current;
    if (!el) return;
    drag.current.active = true;
    drag.current.dragging = false;
    drag.current.startX = e.clientX;
    drag.current.scrollLeft = el.scrollLeft;
  }, []);

  const endDrag = useCallback(() => {
    drag.current.active = false;
  }, []);

  const onPointerMove = useCallback((e: ReactPointerEvent) => {
    const el = ref.current;
    if (!el || !drag.current.active) return;
    const delta = e.clientX - drag.current.startX;
    if (!drag.current.dragging && Math.abs(delta) > 6) {
      drag.current.dragging = true;
    }
    if (drag.current.dragging) {
      el.scrollLeft = drag.current.scrollLeft - delta;
    }
  }, []);

  // Suppress the click that follows a drag so cards don't open their
  // dialog mid-swipe, while a plain click (no movement past the
  // threshold) still opens it normally.
  const onClickCapture = useCallback((e: React.MouseEvent) => {
    if (drag.current.dragging) {
      e.preventDefault();
      e.stopPropagation();
    }
    drag.current.dragging = false;
  }, []);

  return {
    ref,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: endDrag,
      onPointerLeave: endDrag,
      onPointerCancel: endDrag,
      onClickCapture,
    },
  };
}

// Premium horizontal carousel row: scroll-snap, edge fade, no visible
// scrollbar, smooth scrolling, grab/grabbing cursor on desktop, and native
// swipe/momentum preserved on touch devices.
function CarouselRow({ children }: { children: ReactNode }) {
  const { ref, handlers } = useDragScroll<HTMLDivElement>();
  return (
    <div
      ref={ref}
      {...handlers}
      className="flex gap-3 sm:gap-4 overflow-x-auto snap-x snap-mandatory scroll-smooth cursor-grab active:cursor-grabbing select-none [&::-webkit-scrollbar]:hidden -mx-1 px-1"
      style={{
        scrollbarWidth: "none",
        msOverflowStyle: "none",
        WebkitOverflowScrolling: "touch",
        WebkitMaskImage:
          "linear-gradient(to right, transparent 0, black 20px, black calc(100% - 20px), transparent 100%)",
        maskImage:
          "linear-gradient(to right, transparent 0, black 20px, black calc(100% - 20px), transparent 100%)",
      }}
    >
      {children}
    </div>
  );
}

function RewardsPage() {
  useDB();
  const navigate = useNavigate();
  const [clickCount, setClickCount] = useState(0);
  const [flameMessage, setFlameMessage] = useState(false);
  useEffect(() => {
    evaluateAchievementsNow();
  }, []);

  const progress = api.correctSinceReward();
  const unlockedImages = api.unlockedImageCount();
  const canReveal = progress >= 125 && unlockedImages < TOTAL_IMAGE_REWARDS;
  const MAX_PROGRESS = 125;
  const ringProgress = Math.min(progress, MAX_PROGRESS);
  const progressPct = Math.min((progress / MAX_PROGRESS) * 100, 100);

  const pendingImage = canReveal ? nextImageReward(unlockedImages) : null;

  // Reward Ceremony: api.consumeReward() remains the single source of
  // truth for what unlocked (it decrements the reward counter, increments
  // unlocked images, and calls computeUnlockDelta internally). This just
  // converts its returned delta into a display queue and hands it to the
  // ceremony provider — no reward calculation happens here.
  const { show: showRewardCeremony } = useRewardCeremony();

  const handleReveal = useCallback(() => {
    if (!canReveal) return;
    const result = api.consumeReward();
    const queue = buildRewardCeremonyQueue(result.delta);
    if (queue.length > 0) showRewardCeremony(queue);
  }, [canReveal, showRewardCeremony]);

  const milestones: {
    label: string;
    threshold: number;
    icon: LucideIcon;
  }[] = [
    { label: "Bronze Ring", threshold: 25, icon: Star },
    { label: "Silver Ring", threshold: 50, icon: Moon },
    { label: "Gold Ring", threshold: 100, icon: Sun },
    { label: "Gem Ring", threshold: 125, icon: Gem },
  ];

  return (
    <div className="relative min-h-screen z-10">
      <AppBackground objectPosition="center 50%" />
      <main className="mx-auto max-w-4xl px-5 pt-20 pb-10 space-y-10">
        <h1 className="font-display text-3xl font-semibold">Rewards</h1>

        <div className="flex flex-col items-center gap-6">
          <motion.div
            onClick={() => {
              const newCount = clickCount + 1;
              if (newCount >= 5) {
                setClickCount(0);
                setFlameMessage(true);
                feedback(FEEDBACK.FLAME_ENTER);
                setTimeout(() => {
  
  const video = document.createElement("video");
  const flash = document.createElement("div");
  const screenFlash = document.createElement("div");
  screenFlash.style.position = "fixed";
screenFlash.style.inset = "0";
screenFlash.style.background = "white";
screenFlash.style.opacity = "0";
screenFlash.style.pointerEvents = "none";
screenFlash.style.zIndex = "9997";
screenFlash.style.transition = "opacity 120ms ease-out";
  flash.style.position = "fixed";
const anchor = document.getElementById("secret-flame-anchor");
const rect = anchor?.getBoundingClientRect();

flash.style.left = `${rect ? rect.left + rect.width / 2 : window.innerWidth / 2}px`;
flash.style.top = `${rect ? rect.top + rect.height / 2 : window.innerHeight / 2}px`;
flash.style.width = "60px";
flash.style.height = "60px";
flash.style.transform = "translate(-50%, -50%) scale(0)";
flash.style.borderRadius = "9999px";
flash.style.pointerEvents = "none";
flash.style.zIndex = "9998";
flash.style.background =
  "radial-gradient(circle, rgba(255,255,255,1) 0%, rgba(255,230,150,0.95) 25%, rgba(255,190,50,0.65) 55%, rgba(255,190,50,0) 100%)";
flash.style.filter = "blur(12px)";
flash.style.opacity = "0";
flash.style.transition =
  "opacity 180ms ease-out, transform 320ms cubic-bezier(0.16, 1, 0.3, 1)";
  const message = document.createElement("div");
message.textContent = "Going through Wisdom Portal ✨";
message.style.position = "fixed";
message.style.left = "50%";
message.style.bottom = "48px";
message.style.transform = "translateX(-50%)";
message.style.zIndex = "10000";
message.style.padding = "12px 22px";
message.style.borderRadius = "14px";
message.style.background = "rgba(0, 0, 0, 0.35)";
message.style.backdropFilter = "blur(10px)";
message.style.border = "1px solid rgba(255,255,255,0.08)";
document.body.appendChild(message);
message.style.opacity = "0";
message.style.transform = "translateX(-50%) translateY(18px) scale(0.6)";
message.style.fontSize = "15px";
message.style.fontWeight = "300";
message.style.letterSpacing = "0.04em";
message.style.whiteSpace = "nowrap";

requestAnimationFrame(() => {
  message.style.transition =
    "opacity 220ms ease-out, transform 850ms cubic-bezier(0.16, 1, 0.3, 1)";

  setTimeout(() => {
    message.style.opacity = "1";
    message.style.transform = "translateX(-50%) translateY(0) scale(1)";
  }, 100);
});
  video.src = "/enter-secret-vault.mp4";
  video.muted = true;
  video.playsInline = true;
  video.style.position = "fixed";
  video.style.inset = "0";
  video.style.width = "100vw";
  video.style.height = "100vh";
  video.style.objectFit = "cover";
  video.style.zIndex = "9999";
  video.controls = false;
  video.style.background = "black";
  video.style.opacity = "0";
video.style.transform = "translate(-50%, -50%) scale(0.15)";
video.style.filter = "brightness(1.8) blur(8px)";
video.style.transformOrigin = "center center";
video.style.left = flash.style.left;
video.style.top = flash.style.top;
video.style.width = "100vw";
video.style.height = "100vh";
video.style.transition =
  "opacity 220ms ease-out, transform 850ms cubic-bezier(0.16, 1, 0.3, 1)";
  document.body.appendChild(flash);

requestAnimationFrame(() => {
  flash.style.opacity = "1";
  flash.style.transform = "translate(-50%, -50%) scale(6)";
});
setTimeout(() => {
  flash.style.opacity = "0";
}, 180);

setTimeout(() => {
  flash.remove();
}, 350);
document.body.appendChild(flash);

requestAnimationFrame(() => {
  flash.style.opacity = "1";
  flash.style.transform = "translate(-50%, -50%) scale(6)";
});
  document.body.appendChild(video);
  video.play().catch(console.error);
  // gallery-entry.mp3 belongs to this intro video only — it must never be
  // triggered from gallery.tsx or GalleryLightbox.tsx. Uses its own
  // lifecycle (auto fade-out at 3s) rather than the generic feedback().
  playGalleryEntrySound();
  video.style.boxShadow =
  "0 0 220px 100px rgba(255,215,120,1), 0 0 420px 180px rgba(255,190,60,0.9)";
  requestAnimationFrame(() => {
    setTimeout(() => {
  video.style.opacity = "1";
  video.style.left = "50%";
video.style.top = "50%";
video.style.transform = "translate(-50%, -50%) scale(1)";
video.style.filter = "brightness(1) blur(0px)";
video.style.boxShadow = "none";
}, 80);
});
    video.onended = () => {
  video.style.opacity = "0";
  video.style.transform = "translate(-50%, -50%) scale(1.03)";
  message.style.opacity = "0";
  message.style.transform = "translateX(-50%) scale(1.03)";
  navigate({ to: "/gallery" });
  setTimeout(() => {
message.remove();
setFlameMessage(false);
video.remove();
}, 220);
};
}, 0);
              } else {
                feedback(FEEDBACK.FLAME_CLICK);
                setClickCount(newCount);
              }
            }}
            animate={{
              scale: clickCount === 0 ? 1 : 1 + clickCount * 0.03,
              filter:
                clickCount === 0
                  ? "drop-shadow(0 0 0 rgba(251,191,36,0))"
                  : `drop-shadow(0 0 ${8 + clickCount * 6}px rgba(251,191,36,${0.3 + clickCount * 0.12}))`,
            }}
            transition={{ type: "spring", stiffness: 320, damping: 18 }}
            className="cursor-default relative select-none"
          >
            <div id="secret-flame-anchor">
  <StreakRing
  rewardProgress={ringProgress}
  size={260}
  flameScale={6}
  stroke={7}
  gap={8}
/>
</div>
            {/* Per-tap pulse rings */}
            <AnimatePresence>
              {clickCount > 0 && (
                <motion.span
                  key={`pulse-${clickCount}`}
                  initial={{ opacity: 0.7, scale: 0.6 }}
                  animate={{ opacity: 0, scale: 1.8 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.75, ease: "easeOut" }}
                  className="pointer-events-none absolute inset-0 rounded-full border-2 border-amber-300"
                />
              )}
            </AnimatePresence>
            {/* Particle burst on 5th tap */}
            <AnimatePresence>
              {flameMessage && (
                <>
                  {Array.from({ length: 18 }).map((_, i) => {
                    const angle = (i / 18) * Math.PI * 2;
                    const dist = 140 + Math.random() * 80;
                    return (
                      <motion.span
                        key={`burst-${i}`}
                        initial={{ opacity: 1, x: 0, y: 0, scale: 0 }}
                        animate={{
                          opacity: 0,
                          x: Math.cos(angle) * dist,
                          y: Math.sin(angle) * dist,
                          scale: 1.2,
                        }}
                        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
                        className="pointer-events-none absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-300"
                        style={{ boxShadow: "0 0 10px rgba(251,191,36,0.9)" }}
                      />
                    );
                  })}
                </>
              )}
            </AnimatePresence>
            
          </motion.div>

          <div className="text-center">
            <div className="text-muted-foreground uppercase tracking-widest text-xs mb-1">
              Correct Answers Since Last Reward
            </div>
            <div className="font-display text-5xl nums leading-none">
              {progress}
              <span className="text-muted-foreground text-2xl"> / 125</span>
            </div>
          </div>

          {canReveal && (
            <motion.button
              onClick={() => {
  handleReveal();
}}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              whileTap={{ scale: 0.97 }}
              className="relative inline-flex items-center gap-2 px-8 py-3 rounded-full
                         bg-gradient-to-r from-amber-500 via-amber-300 to-amber-500
                         text-black font-semibold tracking-wide
                         shadow-[0_0_20px_rgba(251,191,36,.55),0_0_50px_rgba(251,191,36,.3)]
                         hover:shadow-[0_0_28px_rgba(251,191,36,.75),0_0_60px_rgba(251,191,36,.4)]
                         transition-all"
            >
              <Sparkles className="h-4 w-4" />
              Tap to Reveal
            </motion.button>
          )}
        </div>

        <Card className="p-6">
          <h2 className="font-semibold text-lg mb-6">Ring Progress</h2>

          <div className="space-y-8">
            {(() => {
              const m =
                milestones.find((ms) => progress < ms.threshold) ??
                milestones[milestones.length - 1];
              const current = Math.min(progress, m.threshold);
              const progressPercent = Math.min((current / m.threshold) * 100, 100);
              const isCompleted = progress >= m.threshold;

              const tierConfig =
                m.label === "Bronze Ring"
                  ? {
                      glow: "bg-gradient-to-r from-amber-700 via-amber-400 to-yellow-300",
                      shadow:
                        "shadow-[0_0_6px_rgba(217,119,6,0.9),0_0_14px_rgba(217,119,6,0.7),0_0_24px_rgba(217,119,6,0.45)]",
                      color: "#f59e0b",
                    }
                  : m.label === "Silver Ring"
                    ? {
                        glow: "bg-gradient-to-r from-slate-500 via-white to-slate-300",
                        shadow:
                          "shadow-[0_0_6px_rgba(255,255,255,0.95),0_0_14px_rgba(255,255,255,0.8),0_0_24px_rgba(255,255,255,0.55)]",
                        color: "#ffffff",
                      }
                    : m.label === "Gold Ring"
                      ? {
                          glow: "bg-gradient-to-r from-yellow-700 via-yellow-400 to-yellow-200",
                          shadow:
                            "shadow-[0_0_6px_rgba(250,204,21,0.9),0_0_14px_rgba(250,204,21,0.7),0_0_24px_rgba(250,204,21,0.45)]",
                          color: "#facc15",
                        }
                      : {
                          glow: "bg-gradient-to-r from-sky-700 via-cyan-300 to-white",
                          shadow:
                            "shadow-[0_0_8px_rgba(103,232,249,0.95),0_0_18px_rgba(103,232,249,0.8),0_0_32px_rgba(103,232,249,0.55)]",
                          color: "#67e8f9",
                        };
              return (
                <div key={m.label} className="space-y-2">
                  <div className="flex items-center gap-3">
                    <motion.div
                      initial={false}
                      animate={
                        isCompleted
                          ? {
                              scale: [1, 1.15, 1],
                              filter: [
                                `drop-shadow(0 0 6px ${tierConfig.color})`,
                                `drop-shadow(0 0 14px ${tierConfig.color})`,
                                `drop-shadow(0 0 6px ${tierConfig.color})`,
                              ],
                            }
                          : { scale: 1, filter: "none" }
                      }
                      transition={{
                        duration: 2.4,
                        repeat: isCompleted ? Infinity : 0,
                        ease: "easeInOut",
                      }}
                      className="relative w-7 h-7 rounded-full flex items-center justify-center"
                      style={{
                        background: isCompleted
                          ? `radial-gradient(circle at 30% 30%, ${tierConfig.color}55, transparent 70%)`
                          : "transparent",
                        border: `1px solid ${
                          isCompleted ? tierConfig.color : "rgba(255,255,255,0.15)"
                        }`,
                      }}
                    >
                      <m.icon
                        className="h-3.5 w-3.5"
                        style={{
                          color: isCompleted ? tierConfig.color : "rgba(255,255,255,0.4)",
                        }}
                      />
                    </motion.div>
                    <span
                      className="font-medium"
                      style={{
                        color: isCompleted ? tierConfig.color : undefined,
                        textShadow: isCompleted ? "0 0 8px currentColor" : undefined,
                      }}
                    >
                      {m.label}
                    </span>
                  </div>
                  <div className="h-1 w-full rounded-full bg-muted/40 overflow-visible">
                    <div
                      className={`h-full rounded-full transition-all ${isCompleted ? `${tierConfig.glow} ${tierConfig.shadow}` : `${tierConfig.glow}`}`}
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                  <div
                    className="text-xs font-semibold tracking-wide"
                    style={{
                      color: isCompleted ? tierConfig.color : undefined,
                      textShadow: isCompleted ? "0 0 8px currentColor" : undefined,
                    }}
                  >
                    {current} / {m.threshold}
                  </div>
                </div>
              );
            })()}
          </div>
          <div className="mt-6 text-xs text-muted-foreground">
            Reward progress is continuous — it does not reset at midnight.
            Only correct answers count. Progress resets to zero when you reveal a reward.
          </div>
          <div className="mt-3">
            <Progress value={progressPct} className="h-1.5" />
          </div>
        </Card>

        <AchievementsCard />

        <JourneyDashboardCard
          unlockedImages={unlockedImages}
          progress={progress}
          maxProgress={MAX_PROGRESS}
        />
      </main>
    </div>
  );
}

// Journey dashboard — surfaces chapter/lion/wallpaper/achievement progress.
// Every number here comes from src/lib/journey selectors; nothing is
// recomputed locally beyond what the caller already had (progress/
// unlockedImages are passed in from RewardsPage, not recalculated).
function JourneyDashboardCard({
  unlockedImages,
  progress,
  maxProgress,
}: {
  unlockedImages: number;
  progress: number;
  maxProgress: number;
}) {
  const chapter = currentChapter(unlockedImages);
  const progressInChapter = chapterProgress(chapter, unlockedImages);
  const lion = currentLion(unlockedImages);
  const wallpapers = unlockedWallpapers(unlockedImages);
  const journeyAchievements = unlockedJourneyAchievements(unlockedImages);

  return (
    <Card className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold text-lg">Your Journey</h2>
        <span className="text-xs text-muted-foreground">
          Chapter {chapter.id} / {CHAPTERS.length}
        </span>
      </div>

      {/* 1 & 2 — current chapter + chapter progress */}
      <div>
        <div className="text-xs uppercase tracking-widest text-muted-foreground mb-1">
          Current Chapter
        </div>
        <div className="font-display text-xl">{chapter.title}</div>
        <div className="text-sm text-muted-foreground">{chapter.subtitle}</div>
        <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {progressInChapter.unlocked} / {progressInChapter.total} scenes unlocked
          </span>
          {progressInChapter.complete && <span className="text-primary">Chapter complete</span>}
        </div>
        <Progress
          value={(progressInChapter.unlocked / progressInChapter.total) * 100}
          className="h-1.5 mt-1"
        />
      </div>

      {/* 3 & 4 — lion stage + total unlocked story images */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground mb-1">
            Lion Stage
          </div>
          <div className="font-display text-lg">{lion.name}</div>
          <div className="text-xs text-muted-foreground">{lion.english}</div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground mb-1">
            Story Images
          </div>
          <div className="font-display text-lg nums">
            {unlockedImages} / {TOTAL_STORY_IMAGES}
          </div>
        </div>
      </div>

      {/* 5 — next unlock progress (reuses progress/maxProgress from RewardsPage) */}
      <div>
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
          <span>Next unlock</span>
          <span>
            {progress} / {maxProgress} correct
          </span>
        </div>
        <Progress value={Math.min((progress / maxProgress) * 100, 100)} className="h-1.5" />
      </div>

      {/* 6 — wallpaper unlocks */}
      <div>
        <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">
          Wallpapers
        </div>
        <CarouselRow>
          {WALLPAPERS.map((w) => {
            const done = wallpapers.some((u) => u.id === w.id);
            return (
              <div
                key={w.id}
                title={w.title}
                className={`snap-start shrink-0 w-[92px] sm:w-[104px] aspect-square rounded-lg border flex flex-col items-center justify-center gap-1 px-1 text-center text-[10px] ${
                  done
                    ? "border-primary/40 bg-primary/10 text-foreground"
                    : "border-white/10 text-muted-foreground grayscale opacity-60"
                }`}
              >
                {done ? w.title : <Lock className="h-4 w-4" />}
              </div>
            );
          })}
        </CarouselRow>
      </div>

      {/* 7 — Journey achievements */}
      <div>
        <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">
          Journey Achievements
        </div>
        <CarouselRow>
          {JOURNEY_ACHIEVEMENTS.map((a) => {
            const done = journeyAchievements.some((u) => u.id === a.id);
            return (
              <div
                key={a.id}
                title={a.description}
                className={`snap-start shrink-0 w-[92px] sm:w-[104px] aspect-square rounded-full border flex items-center justify-center text-center text-[10px] px-1 ${
                  done
                    ? "border-primary/40 bg-primary/10 text-foreground"
                    : "border-white/10 text-muted-foreground grayscale opacity-60"
                }`}
              >
                {done ? a.title : <Lock className="h-3.5 w-3.5" />}
              </div>
            );
          })}
        </CarouselRow>
      </div>
    </Card>
  );
}

// Visual + semantic style per achievement id. Kept local so store.ts stays pure data.
type BadgeStyle = {
  icon: LucideIcon | "10";
  gradient: string; // css background-image for medal face
  ringColor: string;
  glow: string;
};

const BADGE_STYLES: Record<string, BadgeStyle> = {
  solved_10: {
    icon: "10",
    gradient: "linear-gradient(135deg,#fde68a 0%,#f59e0b 55%,#b45309 100%)",
    ringColor: "#fbbf24",
    glow: "0 0 18px rgba(251,191,36,.55)",
  },
  solved_25: {
    icon: Medal,
    gradient: "linear-gradient(135deg,#fcd6a5 0%,#c68042 55%,#5a2d0c 100%)",
    ringColor: "#c68042",
    glow: "0 0 18px rgba(198,128,66,.55)",
  },
  solved_50: {
    icon: Medal,
    gradient: "linear-gradient(135deg,#f8fafc 0%,#cbd5e1 55%,#64748b 100%)",
    ringColor: "#e2e8f0",
    glow: "0 0 18px rgba(226,232,240,.55)",
  },
  solved_100: {
    icon: Crown,
    gradient: "linear-gradient(135deg,#fef3c7 0%,#facc15 55%,#a16207 100%)",
    ringColor: "#facc15",
    glow: "0 0 20px rgba(250,204,21,.6)",
  },
  solved_125: {
    icon: Gem,
    gradient: "linear-gradient(135deg,#e0f2fe 0%,#67e8f9 50%,#0e7490 100%)",
    ringColor: "#67e8f9",
    glow: "0 0 22px rgba(103,232,249,.65)",
  },
  streak_3: {
    icon: FlameLucide,
    gradient: "linear-gradient(135deg,#fecaca 0%,#f97316 55%,#7c2d12 100%)",
    ringColor: "#f97316",
    glow: "0 0 18px rgba(249,115,22,.55)",
  },
  streak_7: {
    icon: FlameLucide,
    gradient: "linear-gradient(135deg,#fde68a 0%,#ef4444 55%,#7c2d12 100%)",
    ringColor: "#ef4444",
    glow: "0 0 20px rgba(239,68,68,.6)",
  },
  streak_30: {
    icon: Crown,
    gradient: "linear-gradient(135deg,#f5d0fe 0%,#a855f7 55%,#4c1d95 100%)",
    ringColor: "#a855f7",
    glow: "0 0 22px rgba(168,85,247,.6)",
  },
  accuracy_80: {
    icon: Target,
    gradient: "linear-gradient(135deg,#bbf7d0 0%,#22c55e 55%,#14532d 100%)",
    ringColor: "#22c55e",
    glow: "0 0 18px rgba(34,197,94,.55)",
  },
  accuracy_100: {
    icon: Sparkles,
    gradient: "linear-gradient(135deg,#fef9c3 0%,#eab308 40%,#facc15 70%,#fde68a 100%)",
    ringColor: "#fde68a",
    glow: "0 0 22px rgba(253,230,138,.7)",
  },
  quizzes_10: {
    icon: Zap,
    gradient: "linear-gradient(135deg,#dbeafe 0%,#3b82f6 55%,#1e3a8a 100%)",
    ringColor: "#3b82f6",
    glow: "0 0 18px rgba(59,130,246,.55)",
  },
  quizzes_50: {
    icon: Award,
    gradient: "linear-gradient(135deg,#fce7f3 0%,#ec4899 55%,#831843 100%)",
    ringColor: "#ec4899",
    glow: "0 0 20px rgba(236,72,153,.6)",
  },
};

const DEFAULT_BADGE: BadgeStyle = {
  icon: Trophy,
  gradient: "linear-gradient(135deg,#fde68a 0%,#f59e0b 55%,#7c2d12 100%)",
  ringColor: "#f59e0b",
  glow: "0 0 16px rgba(245,158,11,.5)",
};

function AchievementsCard() {
  const unlockedMap = api.getAchievements();
  const consecutive = api.consecutiveDaysActive();
  const total = ACHIEVEMENTS.length;
  const unlockedCount = ACHIEVEMENTS.filter((a) => unlockedMap[a.id]).length;
  const [active, setActive] = useState<Achievement | null>(null);

  const activeUnlock = active ? unlockedMap[active.id] : undefined;
  const activeStyle = active ? (BADGE_STYLES[active.id] ?? DEFAULT_BADGE) : null;

  return (
    <Card className="p-6">
      <div className="flex items-baseline justify-between mb-2 gap-3">
        <h2 className="font-semibold text-lg inline-flex items-center gap-2 min-w-0">
          <motion.div
            aria-hidden
            animate={{
              rotate: [0, -1, 1.2, -0.8, 0],
              y: [0, -1.2, -0.5, -1.5, 0],
              filter: [
                "drop-shadow(0 0 4px rgba(255,180,50,.5))",
                "drop-shadow(0 0 10px rgba(255,180,50,.9))",
                "drop-shadow(0 0 4px rgba(255,180,50,.5))",
              ],
            }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
            className="h-6 w-6 shrink-0"
            style={{ transformOrigin: "50% 100%" }}
          >
            <Flame animate width="100%" height="100%" />
          </motion.div>
          <span className="truncate">Achievements</span>
        </h2>
        <div className="text-sm text-muted-foreground shrink-0">
          <span className="font-medium text-foreground">
            {unlockedCount} / {total}
          </span>{" "}
          unlocked
        </div>
      </div>
      <div className="text-xs text-muted-foreground mb-4">
        Current streak:{" "}
        <span className="text-foreground font-medium">
          {consecutive} day{consecutive === 1 ? "" : "s"}
        </span>
      </div>
      <Progress value={(unlockedCount / total) * 100} className="h-2 mb-6" />

      <CarouselRow>
        {ACHIEVEMENTS.map((a) => {
          const done = !!unlockedMap[a.id];
          const style = BADGE_STYLES[a.id] ?? DEFAULT_BADGE;
          const Icon = style.icon;
          return (
            <button
              key={a.id}
              onClick={() => setActive(a)}
              className="group flex flex-col items-center gap-1 focus:outline-none snap-start shrink-0 w-20 sm:w-24"
              aria-label={a.label}
            >
              <motion.div
                whileHover={done ? { scale: 1.08, rotate: -3 } : { scale: 1.04 }}
                whileTap={{ scale: 0.94 }}
                className="relative aspect-square w-full max-w-[80px] sm:max-w-[92px] rounded-full flex items-center justify-center"
                style={{
                  background: done ? style.gradient : "rgba(255,255,255,0.04)",
                  border: `2px solid ${done ? style.ringColor : "rgba(255,255,255,0.12)"}`,
                  boxShadow: done ? style.glow : "none",
                  filter: done ? "none" : "grayscale(100%)",
                  opacity: done ? 1 : 0.55,
                }}
              >
                {Icon === "10" ? (
                  <span
                    className="font-display font-black text-lg nums"
                    style={{
                      color: done ? "#3b1a00" : "rgba(255,255,255,0.5)",
                      textShadow: done ? "0 1px 0 rgba(255,255,255,.4)" : "none",
                    }}
                  >
                    10
                  </span>
                ) : (
                  <Icon
                    className="h-6 w-6"
                    style={{
                      color: done ? "#3b1a00" : "rgba(255,255,255,0.5)",
                      filter: done ? "drop-shadow(0 1px 0 rgba(255,255,255,.35))" : "none",
                    }}
                  />
                )}
                {!done && (
                  <Lock className="absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full bg-background p-0.5 text-muted-foreground" />
                )}
              </motion.div>
            </button>
          );
        })}
      </CarouselRow>

      <Dialog open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent className="max-w-sm">
          {active && activeStyle && (
            <>
              <div className="flex justify-center pt-2">
                <div
                  className="relative h-24 w-24 rounded-full flex items-center justify-center"
                  style={{
                    background: unlockedMap[active.id]
                      ? activeStyle.gradient
                      : "rgba(255,255,255,0.04)",
                    border: `3px solid ${
                      unlockedMap[active.id] ? activeStyle.ringColor : "rgba(255,255,255,0.12)"
                    }`,
                    boxShadow: unlockedMap[active.id] ? activeStyle.glow : "none",
                    filter: unlockedMap[active.id] ? "none" : "grayscale(100%)",
                    opacity: unlockedMap[active.id] ? 1 : 0.55,
                  }}
                >
                  {activeStyle.icon === "10" ? (
                    <span
                      className="font-display font-black text-3xl nums"
                      style={{ color: unlockedMap[active.id] ? "#3b1a00" : "rgba(255,255,255,0.5)" }}
                    >
                      10
                    </span>
                  ) : (
                    (() => {
                      const Icon = activeStyle.icon as LucideIcon;
                      return (
                        <Icon
                          className="h-10 w-10"
                          style={{
                            color: unlockedMap[active.id] ? "#3b1a00" : "rgba(255,255,255,0.5)",
                          }}
                        />
                      );
                    })()
                  )}
                </div>
              </div>
              <DialogHeader>
                <DialogTitle className="text-center font-display text-2xl">
                  {active.label}
                </DialogTitle>
                <DialogDescription className="text-center">
                  {active.description}
                </DialogDescription>
              </DialogHeader>
              <div className="text-center text-sm">
                {activeUnlock ? (
                  <span className="inline-flex items-center gap-1.5 text-primary">
                    <CheckCircle2 className="h-4 w-4" />
                    Unlocked
                    {activeUnlock.unlocked_at && (
                      <span className="text-muted-foreground">
                        · {new Date(activeUnlock.unlocked_at).toLocaleDateString()}
                      </span>
                    )}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                    <Lock className="h-4 w-4" />
                    Locked
                  </span>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
