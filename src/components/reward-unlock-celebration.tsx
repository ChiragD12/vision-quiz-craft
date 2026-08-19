import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Flame from "@/components/Flame";
import { X as XIcon } from "lucide-react";

// Full-screen cinematic "Reward Unlocked" celebration.
// Phases: darken → giant ring fills → flame grows → flash → particle burst → text.
// Non-interruptive — mounts only after the quiz has finished (result page).
export function RewardUnlockCelebration({ onClose }: { onClose: () => void }) {
  const [phase, setPhase] = useState<0 | 1 | 2 | 3 | 4>(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 250), // ring appears + starts filling
      setTimeout(() => setPhase(2), 1900), // flame grows
      setTimeout(() => setPhase(3), 2700), // flash + burst
      setTimeout(() => setPhase(4), 3100), // text
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const particles = useMemo(() => {
    return Array.from({ length: 60 }).map((_, i) => {
      const angle = (i / 60) * Math.PI * 2 + (Math.random() - 0.5) * 0.3;
      const dist = 180 + Math.random() * 320;
      return {
        x: Math.cos(angle) * dist,
        y: Math.sin(angle) * dist,
        size: 4 + Math.random() * 7,
        delay: Math.random() * 0.25,
        dur: 1.2 + Math.random() * 0.9,
        hue: 42 + Math.random() * 18,
      };
    });
  }, []);

  const sparkles = useMemo(() => {
    return Array.from({ length: 24 }).map((_, i) => ({
      x: (Math.random() - 0.5) * 90,
      y: (Math.random() - 0.5) * 90,
      delay: Math.random() * 2.5,
      size: 2 + Math.random() * 3,
    }));
  }, []);

  // Big ring geometry
  const size = 320;
  const stroke = 10;
  const r = size / 2 - stroke;
  const circumference = 2 * Math.PI * r;

  return (
    <AnimatePresence>
      <motion.div
        key="reward-celebration"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.5 }}
        className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden px-4"
        style={{
          background:
            "radial-gradient(circle at center, rgba(20,10,0,.92) 0%, rgba(0,0,0,.96) 70%)",
        }}
      >
        {/* Close */}
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 rounded-full bg-black/60 p-2 text-white/80 hover:bg-black/80"
        >
          <XIcon className="h-5 w-5" />
        </button>

        {/* Ambient sparkles */}
        {sparkles.map((s, i) => (
          <motion.span
            key={`sp-${i}`}
            className="pointer-events-none absolute rounded-full bg-amber-200"
            style={{
              left: `calc(50% + ${s.x}vmin)`,
              top: `calc(50% + ${s.y}vmin)`,
              width: s.size,
              height: s.size,
              boxShadow: "0 0 12px rgba(251,191,36,.9)",
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0], scale: [0.6, 1.2, 0.6] }}
            transition={{
              duration: 2.4,
              delay: s.delay,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        ))}

        {/* Radial glow behind ring */}
        <motion.div
          className="pointer-events-none absolute rounded-full"
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{
            opacity: phase >= 1 ? [0, 0.7, 0.5] : 0,
            scale: phase >= 3 ? 2 : 1.1,
          }}
          transition={{ duration: 1.6, ease: [0.22, 1, 0.36, 1] }}
          style={{
            width: 520,
            height: 520,
            background:
              "radial-gradient(circle, rgba(251,191,36,.55) 0%, rgba(251,191,36,.18) 45%, transparent 70%)",
            filter: "blur(30px)",
          }}
        />

        {/* Big ring */}
        <motion.div
          className="relative"
          initial={{ scale: 0.4, opacity: 0 }}
          animate={{
            scale: phase >= 1 ? 1 : 0.4,
            opacity: phase >= 1 ? 1 : 0,
          }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          style={{ width: size, height: size, maxWidth: "88vmin", maxHeight: "88vmin" }}
        >
          <svg width="100%" height="100%" viewBox={`0 0 ${size} ${size}`}>
            <defs>
              <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#fde68a" />
                <stop offset="50%" stopColor="#f59e0b" />
                <stop offset="100%" stopColor="#b45309" />
              </linearGradient>
              <filter id="ringGlow">
                <feGaussianBlur stdDeviation="6" result="glow" />
                <feMerge>
                  <feMergeNode in="glow" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            {/* Background ring */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke="rgba(255,255,255,0.08)"
              strokeWidth={stroke}
            />
            {/* Progress ring */}
            <motion.circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke="url(#ringGrad)"
              strokeWidth={stroke}
              strokeLinecap="round"
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
              filter="url(#ringGlow)"
              strokeDasharray={circumference}
              initial={{ strokeDashoffset: circumference }}
              animate={{
                strokeDashoffset: phase >= 1 ? 0 : circumference,
              }}
              transition={{ duration: 1.6, ease: [0.65, 0, 0.35, 1] }}
            />
          </svg>

          {/* Flame inside */}
          <motion.div
            className="pointer-events-none absolute inset-0 flex items-center justify-center"
            animate={{
              scale: phase >= 2 ? [1, 1.6, 1.4] : 0.9,
              filter:
                phase >= 2
                  ? "drop-shadow(0 0 24px rgba(255,180,50,.9)) drop-shadow(0 0 60px rgba(255,120,0,.6))"
                  : "drop-shadow(0 0 8px rgba(255,180,50,.4))",
            }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          >
            <div style={{ width: "42%", height: "42%" }}>
              <Flame animate width="100%" height="100%" />
            </div>
          </motion.div>

          {/* 125 / 125 label */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: phase >= 1 ? 1 : 0 }}
            transition={{ delay: 1.2 }}
            className="pointer-events-none absolute inset-x-0 -bottom-2 text-center font-display text-amber-300 nums text-sm tracking-widest"
          >
            125 / 125
          </motion.div>
        </motion.div>

        {/* Flash */}
        <AnimatePresence>
          {phase === 3 && (
            <motion.div
              key="flash"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0.95, 0] }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.55, ease: "easeOut" }}
              className="pointer-events-none absolute inset-0 bg-white"
            />
          )}
        </AnimatePresence>

        {/* Particle burst */}
        {phase >= 3 &&
          particles.map((p, i) => (
            <motion.span
              key={`p-${i}`}
              className="pointer-events-none absolute rounded-full"
              style={{
                left: "50%",
                top: "50%",
                width: p.size,
                height: p.size,
                background: `hsl(${p.hue}, 100%, 65%)`,
                boxShadow: `0 0 14px hsl(${p.hue}, 100%, 65%)`,
              }}
              initial={{ opacity: 0, x: 0, y: 0, scale: 0 }}
              animate={{
                opacity: [0, 1, 0],
                x: p.x,
                y: p.y,
                scale: [0, 1.1, 0.3],
              }}
              transition={{ duration: p.dur, delay: p.delay, ease: [0.16, 1, 0.3, 1] }}
            />
          ))}

        {/* Reward Unlocked text */}
        <AnimatePresence>
          {phase >= 4 && (
            <motion.div
              key="text"
              initial={{ opacity: 0, y: 40, scale: 0.7, rotate: -3 }}
              animate={{
                opacity: 1,
                y: [40, -6, 0],
                scale: [0.7, 1.15, 1],
                rotate: [-3, 2, 0],
              }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
              className="pointer-events-none absolute left-1/2 -translate-x-1/2"
              style={{ bottom: "18%" }}
            >
              <div
                className="font-display text-5xl sm:text-6xl font-black tracking-tight text-transparent bg-clip-text"
                style={{
                  backgroundImage:
                    "linear-gradient(135deg, #fde68a 0%, #f59e0b 40%, #fbbf24 60%, #b45309 100%)",
                  filter:
                    "drop-shadow(0 4px 0 rgba(0,0,0,.35)) drop-shadow(0 0 24px rgba(251,191,36,.7))",
                  WebkitTextStroke: "1px rgba(0,0,0,0.4)",
                  transform: "skewY(-3deg)",
                }}
              >
                Reward Unlocked!
              </div>
              <div className="mt-4 text-center text-amber-200/80 text-sm tracking-[0.4em] uppercase">
                Tap the ring in Rewards to reveal
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tap-anywhere dismiss after full sequence */}
        {phase >= 4 && (
          <button
            onClick={onClose}
            aria-label="Dismiss"
            className="absolute inset-0 cursor-default"
          />
        )}
      </motion.div>
    </AnimatePresence>
  );
}
