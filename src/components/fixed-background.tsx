import type { CSSProperties } from "react";
import { createPortal } from "react-dom";
import { useAppearance, resolveThemedAsset } from "@/lib/appearance";
import { useRouterState } from "@tanstack/react-router";
import {
  useBackgroundSelection,
  useBackgroundUrl,
} from "@/lib/user-background";

interface FixedBackgroundProps {
  /** Canonical (dark-theme) image source, e.g. "/background.png" or
   *  "/history-dark.webp". The light-theme counterpart is resolved
   *  automatically — callers never need to branch on theme. */
  src: string;
  /** 0–1. Defaults to 0.4, matching the original opacity-40 usage. */
  opacity?: number;
  /** CSS object-position for the image. Defaults to "center center". */
  objectPosition?: string;
  /** Extra classes merged onto the <img>. */
  className?: string;
  /** Extra inline styles merged onto the <img> (e.g. a transform/scale). */
  style?: CSSProperties;
}

/**
 * Renders a fixed, non-interactive background image pinned to the real
 * viewport via a portal into document.body.
 *
 * Why the portal: page content sits inside a Framer Motion wrapper that
 * applies an inline `transform` during route transitions. Any ancestor
 * with a transform becomes the containing block for `position: fixed`
 * descendants, which breaks "fixed to viewport" (most visibly on iPhone
 * Safari). Portaling straight to document.body sidesteps that ancestor
 * entirely, so the image stays fixed to the viewport regardless of what
 * route-transition animations are doing above it.
 *
 * Why useAppearance() here: this is the one and only place that swaps a
 * wallpaper's dark asset for its light counterpart (via
 * resolveThemedAsset, see src/lib/appearance.ts). Reading the live theme
 * via the hook — rather than resolving once — means the wallpaper
 * updates immediately when the person switches themes in Settings, with
 * no page reload and no page component ever needing to know which
 * theme is active.
 */
export function FixedBackground({
  src,
  opacity = 0.4,
  objectPosition = "center center",
  className = "",
  style,
}: FixedBackgroundProps) {
  const [{ theme }] = useAppearance();

const route = useRouterState({
  select: (s) => s.location.pathname,
});

const selection = useBackgroundSelection(route);
const backgroundUrl = useBackgroundUrl(route, () => src);

const finalSrc =
  selection.kind === "default"
    ? src
    : backgroundUrl;

const themedSrc = resolveThemedAsset(finalSrc, theme);
console.log({
  selection,
  src,
  backgroundUrl,
  finalSrc,
});

  return createPortal(
    <div
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: -1 }}
    >
      <img
        src={themedSrc}
        alt=""
        className={`h-full w-full object-cover ${className}`.trim()}
        style={{
          objectPosition,
          opacity,
          ...style,
        }}
      />
    </div>,
    document.body,
  );
}
