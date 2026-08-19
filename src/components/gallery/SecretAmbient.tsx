import { useMemo } from "react";
import { motion } from "framer-motion";

// ---------------- Hidden VIP / Dev Preview UI ----------------

export function SecretAmbient({ vip }: { vip: boolean }) {
  // Base glow always on for premium feel; extra layers when VIP is active.
  const sparkles = useMemo(
    () =>
      Array.from({ length: vip ? 28 : 12 }).map((_, i) => ({
        id: i,
        left: Math.random() * 100,
        top: Math.random() * 100,
        delay: Math.random() * 6,
        duration: 6 + Math.random() * 8,
        size: 2 + Math.random() * 3,
      })),
    [vip],
  );

  return (
    <div
      className="pointer-events-none fixed inset-0 overflow-hidden"
      style={{ zIndex: 1 }}
      aria-hidden="true"
    >
      {/* Deep purple → pink → gold ambient gradients */}
      <motion.div
        className="absolute -top-1/3 -left-1/4 h-[70vh] w-[70vh] rounded-full blur-3xl"
        style={{
          background:
            "radial-gradient(circle, rgba(236,72,153,0.28), rgba(236,72,153,0) 65%)",
        }}
        animate={{ x: [0, 40, -20, 0], y: [0, 30, -20, 0], opacity: vip ? 0.9 : 0.55 }}
        transition={{ duration: 18, repeat: Infinity, ease: [0.45, 0, 0.55, 1] }}
      />
      <motion.div
        className="absolute -bottom-1/3 -right-1/4 h-[75vh] w-[75vh] rounded-full blur-3xl"
        style={{
          background:
            "radial-gradient(circle, rgba(88,28,135,0.45), rgba(88,28,135,0) 65%)",
        }}
        animate={{ x: [0, -30, 20, 0], y: [0, -20, 30, 0], opacity: vip ? 1 : 0.6 }}
        transition={{ duration: 22, repeat: Infinity, ease: [0.45, 0, 0.55, 1] }}
      />
      <motion.div
        className="absolute top-1/2 left-1/2 h-[60vh] w-[60vh] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
        style={{
          background:
            "radial-gradient(circle, rgba(251,191,36,0.18), rgba(251,191,36,0) 60%)",
        }}
        animate={{ scale: [1, 1.15, 1], opacity: vip ? 0.85 : 0.4 }}
        transition={{ duration: 10, repeat: Infinity, ease: [0.45, 0, 0.55, 1] }}
      />

      {/* Layered breathing halo + edge vignette (VIP only) */}
      {vip && (
        <>
          <motion.div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.55) 100%)",
            }}
            animate={{ opacity: [0.7, 0.9, 0.7] }}
            transition={{ duration: 8, repeat: Infinity, ease: [0.45, 0, 0.55, 1] }}
          />
          <motion.div
            className="absolute top-1/2 left-1/2 h-[45vh] w-[45vh] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
            style={{
              background:
                "radial-gradient(circle, rgba(244,114,182,0.15), rgba(244,114,182,0) 70%)",
            }}
            animate={{ scale: [1, 1.25, 1], opacity: [0.4, 0.75, 0.4] }}
            transition={{ duration: 5.5, repeat: Infinity, ease: [0.45, 0, 0.55, 1] }}
          />
        </>
      )}

      {/* Shimmer sweep (VIP only) */}
      {vip && (
        <motion.div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(115deg, transparent 30%, rgba(255,215,150,0.10) 50%, transparent 70%)",
            mixBlendMode: "screen",
          }}
          animate={{ x: ["-30%", "30%"] }}
          transition={{ duration: 7, repeat: Infinity, ease: [0.45, 0, 0.55, 1] }}
        />
      )}

      {/* Floating sparkles */}
      {sparkles.map((s) => (
        <motion.span
          key={s.id}
          className="absolute rounded-full"
          style={{
            left: `${s.left}%`,
            top: `${s.top}%`,
            width: s.size,
            height: s.size,
            background: vip
              ? "radial-gradient(circle, rgba(255,220,180,1), rgba(236,72,153,0.6) 60%, transparent 70%)"
              : "radial-gradient(circle, rgba(255,255,255,0.9), rgba(255,255,255,0) 70%)",
            boxShadow: vip
              ? "0 0 12px rgba(236,72,153,0.85), 0 0 24px rgba(251,191,36,0.5)"
              : "0 0 8px rgba(255,255,255,0.5)",
          }}
          animate={{
            y: [0, -30, 0],
            opacity: [0, 1, 0],
            scale: [0.6, 1.2, 0.6],
          }}
          transition={{
            duration: s.duration,
            delay: s.delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}
