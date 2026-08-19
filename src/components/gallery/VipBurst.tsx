import { motion } from "framer-motion";

export function VipBurst({ trigger }: { trigger: number }) {
  if (trigger === 0) return null;
  const particles = Array.from({ length: 26 });
  return (
    <motion.div
      className="pointer-events-none fixed inset-0 z-[70] flex items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: [0, 1, 0] }}
      transition={{ duration: 1.6, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Camera scale flash */}
      <motion.div
        initial={{ scale: 0.2, opacity: 0 }}
        animate={{ scale: [0.2, 1.4, 1.1], opacity: [0, 1, 0] }}
        transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
        className="absolute h-[60vh] w-[60vh] rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(255,235,190,0.9) 0%, rgba(236,72,153,0.55) 35%, rgba(88,28,135,0.35) 60%, rgba(0,0,0,0) 75%)",
          filter: "blur(6px)",
        }}
      />
      {/* Concentric rings */}
      {[0, 0.15, 0.3].map((d, i) => (
        <motion.span
          key={i}
          className="absolute rounded-full border"
          style={{
            borderColor: i === 0 ? "rgba(251,191,36,0.9)" : "rgba(236,72,153,0.8)",
            boxShadow: "0 0 40px rgba(236,72,153,0.6)",
          }}
          initial={{ width: 60, height: 60, opacity: 0.9 }}
          animate={{ width: 900, height: 900, opacity: 0 }}
          transition={{ duration: 1.4, delay: d, ease: [0.22, 1, 0.36, 1] }}
        />
      ))}
      {/* Particle burst */}
      {particles.map((_, i) => {
        const angle = (i / particles.length) * Math.PI * 2;
        const dist = 260 + Math.random() * 180;
        return (
          <motion.span
            key={i}
            className="absolute h-1.5 w-1.5 rounded-full"
            style={{
              background:
                i % 3 === 0
                  ? "#fde68a"
                  : i % 3 === 1
                    ? "#f472b6"
                    : "#a78bfa",
              boxShadow: "0 0 12px currentColor",
            }}
            initial={{ x: 0, y: 0, opacity: 1, scale: 0 }}
            animate={{
              x: Math.cos(angle) * dist,
              y: Math.sin(angle) * dist,
              opacity: 0,
              scale: 1.4,
            }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
          />
        );
      })}
      {/* VIP label */}
      <motion.div
        initial={{ opacity: 0, scale: 0.6, y: 20 }}
        animate={{ opacity: [0, 1, 1, 0], scale: [0.6, 1, 1, 1.05], y: [20, 0, 0, -10] }}
        transition={{ duration: 1.6, times: [0, 0.25, 0.75, 1], ease: "easeOut" }}
        className="relative font-display text-5xl md:text-6xl font-semibold tracking-[0.25em]"
        style={{
          background:
            "linear-gradient(135deg,#fde68a 0%,#f472b6 45%,#a78bfa 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          filter: "drop-shadow(0 0 24px rgba(236,72,153,0.7))",
        }}
      >
        VIP MODE
      </motion.div>
    </motion.div>
  );
}
