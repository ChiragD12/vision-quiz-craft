import { motion } from "framer-motion";

export function GalleryHero({
  vipMode,
  unlockedImages,
  uploadedCount,
}: {
  vipMode: boolean;
  unlockedImages: number;
  uploadedCount: number;
}) {
  return (
    <>
      <img
        src="/backgrounds/sec-gal-bg.png"
        alt=""
        aria-hidden="true"
        className="fixed inset-0 h-full w-full object-cover pointer-events-none opacity-40"
        style={{
          objectPosition: "center 50%",
          zIndex: 0,
        }}
      />

      {/* Hero Section */}
      <motion.header
        initial={{ opacity: 0, y: 28, filter: "blur(6px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 mx-auto max-w-5xl px-6 py-16 text-center"
      >
        <h1 className="text-3xl md:text-4xl font-normal font-display leading-[1.30] tracking-tight bg-clip-text text-transparent bg-gradient-to-b from-amber-100 to-amber-500/60 mb-1">
          BHARAT
        </h1>
        <p className="text-xl text-neutral-400 font-light tracking-wider">
          ki katha
        </p>
        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
          className="mt-2 inline-flex items-center gap-4 rounded-full border px-6 py-2 text-sm text-neutral-300 backdrop-blur-xl"
          style={{
            borderColor: vipMode ? "rgba(251,191,36,0.35)" : "rgba(251,191,36,0.2)",
            background: vipMode
              ? "linear-gradient(135deg, rgba(20,10,25,0.6), rgba(88,28,135,0.25))"
              : "rgba(0,0,0,0.4)",
            boxShadow: vipMode
              ? "0 0 24px rgba(236,72,153,0.2), 0 0 48px rgba(88,28,135,0.15)"
              : "none",
          }}
        >
          <span>
            <span className="text-amber-300 font-medium">{unlockedImages}</span> unlocked
          </span>
          <span className="opacity-40">•</span>
          <span>
            <span className="text-amber-300 font-medium">{uploadedCount}</span> uploaded
          </span>
        </motion.div>
      </motion.header>
    </>
  );
}
