import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useRouterState } from "@tanstack/react-router";
import { useBackgroundUrl } from "@/lib/user-background";
import { storyImageUrl } from "@/lib/journey/assets";
import { useAppearance, resolveThemedAsset } from "@/lib/appearance";

/**
 * Single shared app background. Reads the user's selected background
 * (default / journey / custom) and renders it via a portal to the body.
 *
 * Crossfades between wallpapers so switching sources feels calm and
 * premium rather than snapping.
 */
export function AppBackground({
  opacity = 0.4,
  objectPosition = "center center",
  className = "",
  style,
}: {
  opacity?: number;
  objectPosition?: string;
  className?: string;
  style?: CSSProperties;
}) {
  const route = useRouterState({
  select: (s) => s.location.pathname,
});
  const resolver = useCallback((id: number) => storyImageUrl(id), []);
  const rawUrl = useBackgroundUrl(route, resolver);
  const [{ theme }] = useAppearance();
  const themedSrc = resolveThemedAsset(rawUrl, theme);

  // Preload the next image before we cross-fade so we never fade to a
  // blank frame while a large image decodes.
  const [displayed, setDisplayed] = useState<string>(themedSrc);
  const lastRequested = useRef<string>(themedSrc);
  useEffect(() => {
    if (themedSrc === displayed) return;
    lastRequested.current = themedSrc;
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      if (lastRequested.current === themedSrc) setDisplayed(themedSrc);
    };
    img.onerror = () => {
      if (lastRequested.current === themedSrc) setDisplayed(themedSrc);
    };
    img.src = themedSrc;
  }, [themedSrc, displayed]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none"
      style={{
        zIndex: -1,
        // Promote this layer to its own compositing layer so it's
        // isolated from repaints triggered elsewhere (e.g. the edge-nav
        // backdrop's animated backdrop-filter). Without this, negative
        // z-index content can get swept into the same repaint pass as
        // sibling stacking contexts, causing a visible flash.
        isolation: "isolate",
        transform: "translateZ(0)",
        willChange: "opacity",
      }}
    >
      <AnimatePresence mode="sync" initial={false}>
        <motion.img
          key={displayed}
          src={displayed}
          alt=""
          initial={{ opacity: 0 }}
          animate={{ opacity }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className={`absolute inset-0 h-full w-full object-cover ${className}`.trim()}
          style={{
            objectPosition,
            ...style,
          }}
        />
      </AnimatePresence>
      {/* Subtle breathing vignette — almost imperceptible, adds depth. */}
      <motion.div
        aria-hidden
        className="absolute inset-0"
        animate={{ opacity: [0.55, 0.7, 0.55] }}
        transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.28) 100%)",
        }}
      />
    </div>,
    document.body,
  );
}