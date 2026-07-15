import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  Menu,
  User,
  Layers,
  CalendarClock,
  Trophy,
  Sparkles,
  X,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Edge navigation — Apple / visionOS inspired floating capsule menu.
// - Swipe from the left edge (or press the hamburger) to open.
// - Swipe left, tap outside, or press Escape to close.
// - Backdrop blurs & dims, the underlying page shifts ~14px to the right.
// ---------------------------------------------------------------------------

type Ctx = {
  open: boolean;
  setOpen: (v: boolean) => void;
  toggle: () => void;
};
const EdgeNavCtx = createContext<Ctx | null>(null);

export function useEdgeNav() {
  const c = useContext(EdgeNavCtx);
  if (!c) throw new Error("useEdgeNav must be used inside <EdgeNavProvider>");
  return c;
}

const CAPSULES: Array<{
  to: string;
  label: string;
  hint: string;
  icon: ReactNode;
}> = [
  { to: "/profile", label: "Profile", hint: "Your hero, your journey", icon: <User className="h-5 w-5" /> },
  { to: "/quiz-modes", label: "Quiz Modes", hint: "Classic · Daily · Survival", icon: <Layers className="h-5 w-5" /> },
  { to: "/spaced-revision", label: "Spaced Revision", hint: "Revisit at the right time", icon: <CalendarClock className="h-5 w-5" /> },
  { to: "/rewards", label: "Rewards", hint: "Milestones & achievements", icon: <Trophy className="h-5 w-5" /> },
  { to: "/gallery", label: "Journey", hint: "The story of Bharat", icon: <Sparkles className="h-5 w-5" /> },
];

const SPRING = { type: "spring" as const, stiffness: 320, damping: 30, mass: 0.8 };

export function EdgeNavProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // Close on route change.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Escape to close.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Edge-swipe gesture: touchstart within 24px of the left edge, then drag right >= 48px.
  const gesture = useRef<{ x: number; y: number; active: boolean } | null>(null);
  useEffect(() => {
    const onStart = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!t) return;
      if (open) return;
      if (t.clientX <= 24) {
        gesture.current = { x: t.clientX, y: t.clientY, active: true };
      }
    };
    const onMove = (e: TouchEvent) => {
      const g = gesture.current;
      if (!g || !g.active) return;
      const t = e.touches[0];
      if (!t) return;
      const dx = t.clientX - g.x;
      const dy = Math.abs(t.clientY - g.y);
      if (dx >= 48 && dy < 40) {
        g.active = false;
        setOpen(true);
      }
    };
    const onEnd = () => {
      gesture.current = null;
    };
    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
    };
  }, [open]);

  const value = useMemo<Ctx>(
    () => ({ open, setOpen, toggle: () => setOpen(!open) }),
    [open],
  );

  return (
    <EdgeNavCtx.Provider value={value}>
      <motion.div
        animate={{ x: open ? 14 : 0, scale: open ? 0.985 : 1 }}
        transition={SPRING}
        style={{ transformOrigin: "left center" }}
      >
        {children}
      </motion.div>
      <EdgeNavOverlay />
    </EdgeNavCtx.Provider>
  );
}

export function EdgeNavHamburger() {
  const { toggle, open } = useEdgeNav();
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={open ? "Close menu" : "Open menu"}
      className="fixed top-4 left-4 z-[60] inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-black/25 text-white shadow-lg backdrop-blur-xl transition-colors hover:bg-black/35"
      style={{ WebkitBackdropFilter: "blur(20px) saturate(140%)" }}
    >
      <AnimatePresence mode="wait" initial={false}>
        {open ? (
          <motion.span
            key="x"
            initial={{ opacity: 0, rotate: -45 }}
            animate={{ opacity: 1, rotate: 0 }}
            exit={{ opacity: 0, rotate: 45 }}
            transition={{ duration: 0.18 }}
          >
            <X className="h-5 w-5" />
          </motion.span>
        ) : (
          <motion.span
            key="menu"
            initial={{ opacity: 0, rotate: 45 }}
            animate={{ opacity: 1, rotate: 0 }}
            exit={{ opacity: 0, rotate: -45 }}
            transition={{ duration: 0.18 }}
          >
            <Menu className="h-5 w-5" />
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}

function EdgeNavOverlay() {
  const { open, setOpen } = useEdgeNav();

  // Swipe-left-to-close on the overlay itself.
  const closeGesture = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const t = e.touches[0];
    closeGesture.current = { x: t.clientX, y: t.clientY };
  }, []);
  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      const g = closeGesture.current;
      if (!g) return;
      const t = e.touches[0];
      const dx = t.clientX - g.x;
      const dy = Math.abs(t.clientY - g.y);
      if (dx <= -60 && dy < 50) {
        closeGesture.current = null;
        setOpen(false);
      }
    },
    [setOpen],
  );

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="edge-nav"
          className="fixed inset-0 z-50"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
        >
          {/* Backdrop */}
          <motion.button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="absolute inset-0 w-full h-full"
            initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
            animate={{ opacity: 1, backdropFilter: "blur(16px)" }}
            exit={{ opacity: 0, backdropFilter: "blur(0px)" }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            style={{
              background:
                "linear-gradient(90deg, rgba(8,10,20,0.55), rgba(8,10,20,0.28) 60%, rgba(8,10,20,0.12))",
              WebkitBackdropFilter: "blur(16px)",
            }}
          />

          {/* Capsule stack */}
          <div className="relative h-full w-full pointer-events-none">
            <div
              className="absolute left-3 sm:left-5 top-20 flex flex-col gap-3 pointer-events-auto"
              style={{ maxWidth: "min(84vw, 320px)" }}
            >
              {CAPSULES.map((c, i) => (
                <motion.div
                  key={c.to}
                  initial={{ opacity: 0, x: -32, y: 8 }}
                  animate={{ opacity: 1, x: 0, y: 0 }}
                  exit={{ opacity: 0, x: -20, y: 4 }}
                  transition={{
                    type: "spring",
                    stiffness: 360,
                    damping: 28,
                    mass: 0.65,
                    delay: 0.04 + i * 0.055,
                  }}
                >
                  <NavCapsule {...c} />
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function NavCapsule({
  to,
  label,
  hint,
  icon,
}: {
  to: string;
  label: string;
  hint: string;
  icon: ReactNode;
}) {
  return (
    <Link
      to={to as any}
      className="group relative flex items-center gap-3 rounded-full pl-4 pr-6 py-3 overflow-hidden"
      style={{
        border: "1px solid rgba(212,178,88,0.35)",
        background:
          "linear-gradient(180deg, rgba(255,246,224,0.28), rgba(255,238,200,0.14))",
        backdropFilter: "blur(24px) saturate(150%)",
        WebkitBackdropFilter: "blur(24px) saturate(150%)",
        boxShadow:
          "0 14px 36px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.28), inset 0 -1px 0 rgba(0,0,0,0.15)",
      }}
    >
      {/* top sheen */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-full"
        style={{
          background:
            "linear-gradient(180deg, rgba(255,250,235,0.35), rgba(255,250,235,0) 45%)",
          mixBlendMode: "overlay",
        }}
      />
      <span className="relative flex h-9 w-9 items-center justify-center rounded-full bg-black/20 text-amber-100 ring-1 ring-white/10">
        {icon}
      </span>
      <span className="relative flex-1 min-w-0">
        <span className="block font-display text-[15px] font-semibold text-white leading-tight tracking-tight">
          {label}
        </span>
        <span className="block text-[11px] text-amber-100/70 truncate leading-tight mt-0.5">
          {hint}
        </span>
      </span>
    </Link>
  );
}
