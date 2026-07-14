import { motion } from "framer-motion";

export function DevPreviewBadge() {
  return (
    <motion.div
      initial={{ opacity: 0, y: -12, scale: 0.1 }}
      animate={{ opacity: 1, y: 0, scale: 0.5 }}
      exit={{ opacity: 0, y: -12, scale: 0.9 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="fixed top-200 right-1 z-[80] select-none"
    >
      <div
        className="relative rounded-2xl px-4 py-2.5 backdrop-blur-xl border"
        style={{
          background:
            "linear-gradient(135deg, rgba(88,28,135,0.75), rgba(236,72,153,0.35))",
          borderColor: "rgba(251,191,36,0.45)",
          boxShadow:
            "0 0 24px rgba(236,72,153,0.45), 0 0 48px rgba(88,28,135,0.35)",
        }}
      >
        <motion.div
          className="absolute inset-0 rounded-2xl pointer-events-none"
          style={{
            background:
              "linear-gradient(115deg, transparent 35%, rgba(255,235,190,0.25) 50%, transparent 65%)",
          }}
          animate={{ x: ["-100%", "100%"] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "linear" }}
        />
        <div className="relative flex items-center gap-3">
          <span
            className="h-2 w-2 rounded-full bg-amber-300"
            style={{ boxShadow: "0 0 10px rgba(251,191,36,0.9)" }}
          />
          <div className="leading-tight">
            <div className="text-[10px] uppercase tracking-[0.3em] text-amber-200/90">
              Developer Preview
            </div>
            <div className="text-sm font-medium text-white">
              Active in this session
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
