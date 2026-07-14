import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { randomQuote } from "@/lib/journey";
import { SPLASH_ARTWORK } from "@/lib/loading-assets";
import { playSound, SOUNDS } from "@/lib/sound-manager";

// Curated set of splash images. Add/remove entries here to change the pool —
// nothing else needs to change.


export function SplashScreen() {
  const [quote] = useState(() => randomQuote());
  // Pick once per mount (session) and never reshuffle on rerenders.
  const [splashImage] = useState(
  () => SPLASH_ARTWORK[Math.floor(Math.random() * SPLASH_ARTWORK.length)]
);
  useEffect(() => {
    const staticSplash = document.getElementById("static-splash");
    if (staticSplash) staticSplash.remove();
  }, []);

  // Plays exactly once per mount — this component only ever mounts once
  // per app session (see splash-theme's allowOverlap: false).
  useEffect(() => {
    playSound(SOUNDS.SPLASH_THEME);
  }, []);

  return (
    <motion.div
  style={{ zIndex: 9999 }}
      initial={{ opacity: 1 }}
      animate={{ opacity: 0 }}
      exit={{ opacity: 0 }}
      transition={{ delay: 2, duration: 0.5 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-[oklch(0.16_0.03_260)]"
      onAnimationComplete={() => {
        // Ensure it is removed from DOM after animation
        const el = document.getElementById("react-splash");
        if (el) el.style.display = "none";
      }}
      id="react-splash"
    >
      <div className="relative h-screen w-full">
        <img
  src={splashImage}
  alt="Splash"
  className="h-full w-full object-cover object-[center_20%]"
/>
        <div className="absolute inset-x-4 top-[60%] flex items-center justify-center">
          <p className="text-center text-2xl font-medium text-white/80 tracking-wide max-w-md">
            {quote}
          </p>
        </div>
      </div>
    </motion.div>
  );
}
