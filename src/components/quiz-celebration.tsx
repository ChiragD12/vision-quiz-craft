import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";

// Premium quiz completion celebration. Layered radial glow, expanding
// concentric rings, sparkle ambient, and a burst of colored particles.
// Non-blocking (pointer-events: none). ~2.2s total. Layout of the result
// page is untouched — this only enhances the overlay animation.
export function QuizCelebration({ accuracy }: { accuracy: number }) {
  const intensity = Math.min(1, Math.max(0.35, accuracy / 100));
  const count = Math.round(36 + intensity * 44);

  const particles = useMemo(() => {
    return Array.from({ length: count }).map((_, i) => {
      const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.35;
      const dist = 140 + Math.random() * 260;
      const size = 3 + Math.random() * 7;
      const delay = 0.05 + Math.random() * 0.25;
      const dur = 1.2 + Math.random() * 0.7;
      return {
        x: Math.cos(angle) * dist,
        y: Math.sin(angle) * dist,
        size,
        delay,
        dur,
        hue: 38 + Math.random() * 22,
      };
    });
  }, [count]);

  const sparkles = useMemo(() => {
    return Array.from({ length: 18 }).map(() => ({
      x: (Math.random() - 0.5) * 70,
      y: (Math.random() - 0.5) * 70,
      delay: Math.random() * 1.4,
      size: 2 + Math.random() * 3,
    }));
  }, []);

  const rings = [0, 0.18, 0.36];

  return (
    <div className="pointer-events-none fixed inset-0 z-40 overflow-hidden">
      <AnimatePresence>
        {/* Base halo */}
        <motion.div
          key="halo"
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: [0, 0.7, 0.35, 0], scale: [0.5, 1.15, 1.55, 1.9] }}
          transition={{ duration: 2.1, ease: [0.22, 1, 0.36, 1] }}
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[640px] w-[640px] rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(251,191,36,0.55) 0%, rgba(251,191,36,0.18) 42%, transparent 72%)",
            filter: "blur(26px)",
          }}
        />

        {/* Warm inner glow flash */}
        <motion.div
          key="flash-glow"
          initial={{ opacity: 0, scale: 0.35 }}
          animate={{ opacity: [0, 0.85, 0], scale: [0.35, 1, 1.3] }}
          transition={{ duration: 0.75, ease: "easeOut", delay: 0.05 }}
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-72 w-72 rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(255,240,200,0.95) 0%, rgba(255,200,120,0.45) 50%, transparent 80%)",
            filter: "blur(14px)",
          }}
        />

        {/* Concentric expanding rings */}
        {rings.map((delay, i) => (
          <motion.div
            key={`ring-${i}`}
            initial={{ opacity: 0.85, scale: 0.2 }}
            animate={{ opacity: 0, scale: 3.2 }}
            transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1], delay }}
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-44 w-44 rounded-full border-2"
            style={{
              borderColor: "rgba(252,211,77,0.85)",
              boxShadow:
                "0 0 30px rgba(251,191,36,0.55), inset 0 0 20px rgba(251,191,36,0.35)",
            }}
          />
        ))}

        {/* Ambient sparkles */}
        {sparkles.map((s, i) => (
          <motion.span
            key={`sp-${i}`}
            className="absolute rounded-full bg-amber-200"
            style={{
              left: `calc(50% + ${s.x}vmin)`,
              top: `calc(50% + ${s.y}vmin)`,
              width: s.size,
              height: s.size,
              boxShadow: "0 0 12px rgba(251,191,36,0.95)",
            }}
            initial={{ opacity: 0, scale: 0.4 }}
            animate={{ opacity: [0, 1, 0], scale: [0.4, 1.25, 0.5] }}
            transition={{
              duration: 1.6,
              delay: s.delay,
              ease: "easeInOut",
            }}
          />
        ))}

        {/* Particle burst */}
        {particles.map((p, i) => (
          <motion.span
            key={`p-${i}`}
            initial={{ opacity: 0, x: 0, y: 0, scale: 0 }}
            animate={{
              opacity: [0, 1, 0],
              x: p.x,
              y: p.y,
              scale: [0, 1.15, 0.35],
            }}
            transition={{ duration: p.dur, delay: p.delay, ease: [0.16, 1, 0.3, 1] }}
            className="absolute left-1/2 top-1/2 rounded-full"
            style={{
              width: p.size,
              height: p.size,
              background: `hsl(${p.hue}, 100%, 65%)`,
              boxShadow: `0 0 12px hsl(${p.hue}, 100%, 65%)`,
            }}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}
