import React from "react";
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useTransform,
  animate,
  type PanInfo,
} from "framer-motion";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import type { SelectedMedia, GalleryItem } from "@/lib/gallery/gallery-types";
import { playSound } from "@/lib/sound-manager";

// Gesture thresholds tuned to feel like the native iOS Photos viewer.
const DISMISS_OFFSET = 110;
const DISMISS_VELOCITY = 500;
const SWIPE_RATIO = 0.22; // >22% of viewport width triggers next/prev
const SWIPE_VELOCITY = 450;

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const DOUBLE_TAP_ZOOM = 2;
const DOUBLE_TAP_MAX_INTERVAL = 300;
const DOUBLE_TAP_MAX_MOVEMENT = 10;

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}
function touchDistance(a: Touch, b: Touch) {
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
}

export function GalleryLightbox({
  selectedMedia,
  onClose,
  onPrev,
  onNext,
}: {
  selectedMedia: SelectedMedia | null;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const [showStory, setShowStory] = React.useState(false);
  const didDragRef = React.useRef(false);

  // Outer swipe/dismiss motion values. `x` also drives the neighbour images
  // that sit at ±100% of the viewport width, so they slide in naturally as
  // the finger moves — no black background between images.
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  // Inner zoom (scale) + pan (panX/panY) for the currently-active image.
  const scale = useMotionValue(1);
  const panX = useMotionValue(0);
  const panY = useMotionValue(0);
  const [isZoomed, setIsZoomed] = React.useState(false);
  const [zoomLevel, setZoomLevel] = React.useState(1);

  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = React.useState(0);
  const [containerHeight, setContainerHeight] = React.useState(0);
  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      setContainerWidth(el.clientWidth);
      setContainerHeight(el.clientHeight);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [selectedMedia?.src ? true : false]);

  const touchStateRef = React.useRef<{
    pinch?: { startDistance: number; startScale: number };
    singleStart?: { x: number; y: number; time: number };
  }>({});
  const lastTapRef = React.useRef(0);
  const imageGestureNodeRef = React.useRef<HTMLDivElement | null>(null);

  // Reset zoom + pan whenever the active image changes.
  React.useEffect(() => {
    setShowStory(false);
    scale.set(1);
    panX.set(0);
    panY.set(0);
    x.set(0);
    y.set(0);
    touchStateRef.current = {};
    lastTapRef.current = 0;
  }, [selectedMedia?.src, scale, panX, panY, x, y]);

  React.useEffect(() => {
    const unsub = scale.on("change", (v) => {
      setIsZoomed(v > 1.01);
      setZoomLevel(v);
    });
    return unsub;
  }, [scale]);

  const setZoom = React.useCallback(
    (target: number) => {
      animate(scale, target, { type: "spring", stiffness: 300, damping: 30 });
      if (target <= MIN_ZOOM) {
        animate(panX, 0, { type: "spring", stiffness: 300, damping: 30 });
        animate(panY, 0, { type: "spring", stiffness: 300, damping: 30 });
      }
    },
    [scale, panX, panY],
  );

  const handleDoubleClick = React.useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setZoom(scale.get() > 1.01 ? MIN_ZOOM : DOUBLE_TAP_ZOOM);
    },
    [scale, setZoom],
  );

  const handleWheelNative = React.useCallback(
    (e: WheelEvent) => {
      e.preventDefault();
      const next = clamp(scale.get() - e.deltaY * 0.0015, MIN_ZOOM, MAX_ZOOM);
      scale.set(next);
      if (next <= 1.001) {
        panX.set(0);
        panY.set(0);
      }
    },
    [scale, panX, panY],
  );

  const handleTouchStartNative = React.useCallback(
    (e: TouchEvent) => {
      if (e.touches.length === 2) {
        touchStateRef.current.pinch = {
          startDistance: touchDistance(e.touches[0], e.touches[1]),
          startScale: scale.get(),
        };
        touchStateRef.current.singleStart = undefined;
      } else if (e.touches.length === 1) {
        touchStateRef.current.singleStart = {
          x: e.touches[0].clientX,
          y: e.touches[0].clientY,
          time: Date.now(),
        };
      }
    },
    [scale],
  );

  const handleTouchMoveNative = React.useCallback(
    (e: TouchEvent) => {
      const pinch = touchStateRef.current.pinch;
      if (pinch && e.touches.length === 2) {
        e.preventDefault();
        const dist = touchDistance(e.touches[0], e.touches[1]);
        const next = clamp(
          (dist / pinch.startDistance) * pinch.startScale,
          MIN_ZOOM,
          MAX_ZOOM,
        );
        scale.set(next);
      }
    },
    [scale],
  );

  const handleTouchEndNative = React.useCallback(
    (e: TouchEvent) => {
      if (e.touches.length < 2) {
        touchStateRef.current.pinch = undefined;
        if (scale.get() < 1.02) setZoom(MIN_ZOOM);
      }
      if (e.touches.length === 0) {
        const start = touchStateRef.current.singleStart;
        touchStateRef.current.singleStart = undefined;
        if (start) {
          const touch = e.changedTouches[0];
          const moved = touch
            ? Math.hypot(touch.clientX - start.x, touch.clientY - start.y)
            : 0;
          const duration = Date.now() - start.time;
          if (moved < DOUBLE_TAP_MAX_MOVEMENT && duration < DOUBLE_TAP_MAX_INTERVAL) {
            const now = Date.now();
            if (now - lastTapRef.current < DOUBLE_TAP_MAX_INTERVAL) {
              setZoom(scale.get() > 1.01 ? MIN_ZOOM : DOUBLE_TAP_ZOOM);
              lastTapRef.current = 0;
            } else {
              lastTapRef.current = now;
            }
          }
        }
      }
    },
    [scale, setZoom],
  );

  const attachImageGestures = React.useCallback(
    (node: HTMLDivElement | null) => {
      const prev = imageGestureNodeRef.current;
      if (prev) {
        prev.removeEventListener("wheel", handleWheelNative);
        prev.removeEventListener("touchstart", handleTouchStartNative);
        prev.removeEventListener("touchmove", handleTouchMoveNative);
        prev.removeEventListener("touchend", handleTouchEndNative);
      }
      imageGestureNodeRef.current = node;
      if (node) {
        node.addEventListener("wheel", handleWheelNative, { passive: false });
        node.addEventListener("touchstart", handleTouchStartNative, { passive: false });
        node.addEventListener("touchmove", handleTouchMoveNative, { passive: false });
        node.addEventListener("touchend", handleTouchEndNative, { passive: false });
      }
    },
    [handleWheelNative, handleTouchStartNative, handleTouchMoveNative, handleTouchEndNative],
  );

  const handleClose = React.useCallback(() => {
    playSound("gallery-close");
    onClose();
  }, [onClose]);

  // Visual feedback during vertical dismiss (only when not zoomed — dragging
  // is disabled while zoomed anyway, but keep the transforms guarded).
  const dragOpacity = useTransform(y, [-260, 0, 260], [0.4, 1, 0.4]);
  const dragScale = useTransform(y, [-260, 0, 260], [0.92, 1, 0.92]);

  const canSwipe = !!selectedMedia && selectedMedia.items.length > 1;

  const items = selectedMedia?.items ?? [];
  const currentIdx = selectedMedia?.index ?? 0;
  const prevItem: GalleryItem | undefined = canSwipe
    ? items[(currentIdx - 1 + items.length) % items.length]
    : undefined;
  const nextItem: GalleryItem | undefined = canSwipe
    ? items[(currentIdx + 1) % items.length]
    : undefined;

  const commitNav = (dir: "next" | "prev") => {
    // Animate the whole track off-screen in the chosen direction, then swap
    // the active item. When selectedMedia.src changes the reset-effect above
    // snaps x back to 0 seamlessly.
    const w = containerWidth || (typeof window !== "undefined" ? window.innerWidth : 0);
    const target = dir === "next" ? -w : w;
    animate(x, target, {
      type: "spring",
      stiffness: 340,
      damping: 34,
      onComplete: () => {
        if (dir === "next") onNext();
        else onPrev();
      },
    });
  };

  const handleDragEnd = (
    _event: MouseEvent | TouchEvent | PointerEvent,
    info: PanInfo,
  ) => {
    if (isZoomed) return;
    const { offset, velocity } = info;
    const absX = Math.abs(offset.x);
    const absY = Math.abs(offset.y);

    // Vertical dismiss wins when it dominates the gesture.
    if (absY > absX) {
      if (Math.abs(offset.y) > DISMISS_OFFSET || Math.abs(velocity.y) > DISMISS_VELOCITY) {
        handleClose();
        return;
      }
      animate(y, 0, { type: "spring", stiffness: 340, damping: 34 });
      animate(x, 0, { type: "spring", stiffness: 340, damping: 34 });
      return;
    }

    // Horizontal swipe carousel.
    if (canSwipe) {
      const threshold = Math.max(60, containerWidth * SWIPE_RATIO);
      if (offset.x < -threshold || velocity.x < -SWIPE_VELOCITY) {
        commitNav("next");
        return;
      }
      if (offset.x > threshold || velocity.x > SWIPE_VELOCITY) {
        commitNav("prev");
        return;
      }
    }
    animate(x, 0, { type: "spring", stiffness: 340, damping: 34 });
    animate(y, 0, { type: "spring", stiffness: 340, damping: 34 });
  };

  // Live pan bounds. Constraints scale with the current zoom so the image
  // pans within its own extra size rather than getting locked around one
  // point.
  const panExtentX =
    (Math.max(0, zoomLevel - 1) * (containerWidth || 0)) / 2;
  const panExtentY =
    (Math.max(0, zoomLevel - 1) * (containerHeight || 0)) / 2;

  const renderImage = (item: GalleryItem, active: boolean) => {
    if (item.type === "video") {
      return (
        <video
          src={item.src}
          className="max-w-full max-h-full rounded-lg"
          controls={active}
          autoPlay={active}
        />
      );
    }
    return (
      <img
        src={item.src}
        alt={active ? "Fullscreen view" : ""}
        draggable={false}
        className="max-w-full max-h-full object-contain rounded-lg select-none pointer-events-none"
      />
    );
  };

  return (
    <AnimatePresence>
      {selectedMedia && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/92 backdrop-blur-xl p-4 md:p-8"
          onClick={handleClose}
        >
          <motion.button
            onClick={handleClose}
            initial={{ opacity: 0, y: -16, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.9 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.94 }}
            className="absolute top-6 right-6 z-50 flex items-center gap-2 rounded-full px-4 py-2.5 backdrop-blur-xl border text-white"
            style={{
              background:
                "linear-gradient(135deg, rgba(20,10,25,0.75), rgba(88,28,135,0.45))",
              borderColor: "rgba(251,191,36,0.35)",
              boxShadow:
                "0 0 20px rgba(236,72,153,0.35), 0 0 40px rgba(88,28,135,0.25)",
            }}
            aria-label="Back to gallery"
          >
            <X size={20} />
            <span className="hidden sm:inline text-sm font-medium tracking-wide">
              Back to Gallery
            </span>
          </motion.button>

          {canSwipe && (
            <>
              <motion.button
                onClick={(e) => {
                  e.stopPropagation();
                  commitNav("prev");
                }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.92 }}
                className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full text-white z-50 border backdrop-blur-xl"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(20,10,25,0.65), rgba(88,28,135,0.35))",
                  borderColor: "rgba(251,191,36,0.25)",
                  boxShadow: "0 0 20px rgba(0,0,0,0.4)",
                }}
                aria-label="Previous"
              >
                <ChevronLeft size={28} />
              </motion.button>
              <motion.button
                onClick={(e) => {
                  e.stopPropagation();
                  commitNav("next");
                }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.92 }}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full text-white z-50 border backdrop-blur-xl"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(20,10,25,0.65), rgba(88,28,135,0.35))",
                  borderColor: "rgba(251,191,36,0.25)",
                  boxShadow: "0 0 20px rgba(0,0,0,0.4)",
                }}
                aria-label="Next"
              >
                <ChevronRight size={28} />
              </motion.button>
            </>
          )}

          {/* Carousel track. The three positioned children (prev/current/next)
              share the same drag layer, so as the user drags horizontally the
              adjacent image is already visible — no black gap between slides. */}
          <div
            ref={containerRef}
            className="relative w-full h-full max-w-5xl overflow-hidden"
            onClick={(e) => {
              e.stopPropagation();
              if (didDragRef.current) {
                didDragRef.current = false;
                return;
              }
              if (showStory) setShowStory(false);
            }}
          >
            <motion.div
              drag={!isZoomed}
              dragDirectionLock={false}
              dragElastic={0.18}
              dragMomentum={false}
              onDragStart={() => {
                didDragRef.current = true;
              }}
              onDragEnd={handleDragEnd}
              style={{ x, y, opacity: dragOpacity, scale: dragScale }}
              className="absolute inset-0 touch-none"
            >
              {/* Previous — offset one full viewport to the left. */}
              {prevItem && (
                <div
                  className="absolute inset-0 flex items-center justify-center"
                  style={{ transform: "translateX(-100%)" }}
                >
                  {renderImage(prevItem, false)}
                </div>
              )}

              {/* Current — the only image that pinch/pan/double-tap. */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div
                  ref={selectedMedia.type === "image" ? attachImageGestures : undefined}
                  onDoubleClick={selectedMedia.type === "image" ? handleDoubleClick : undefined}
                  className="w-full h-full flex items-center justify-center"
                >
                  <motion.div
                    drag={isZoomed}
                    dragElastic={0.15}
                    dragMomentum={false}
                    dragConstraints={{
                      left: -panExtentX,
                      right: panExtentX,
                      top: -panExtentY,
                      bottom: panExtentY,
                    }}
                    style={{ x: panX, y: panY, scale }}
                    className="w-full h-full flex items-center justify-center"
                  >
                    {renderImage(
                      {
                        src: selectedMedia.src,
                        type: selectedMedia.type,
                        title: selectedMedia.title,
                        description: selectedMedia.description,
                      },
                      true,
                    )}
                  </motion.div>
                </div>
              </div>

              {/* Next — offset one full viewport to the right. */}
              {nextItem && (
                <div
                  className="absolute inset-0 flex items-center justify-center"
                  style={{ transform: "translateX(100%)" }}
                >
                  {renderImage(nextItem, false)}
                </div>
              )}
            </motion.div>

            <div className="absolute inset-x-0 bottom-0 flex justify-center pb-8 pointer-events-none">
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  setShowStory((v) => !v);
                }}
                className={`pointer-events-auto max-w-[92%] cursor-pointer transition-all duration-300 ${
                  showStory
                    ? "max-w-3xl rounded-3xl bg-white/5 backdrop-blur-[25px] border border-white/10 px-8 py-6 shadow-2xl"
                    : "rounded-full bg-white/5 backdrop-blur-[25px] border border-white/10 px-8 py-3 shadow-xl"
                }`}
              >
                <h2 className="text-center text-xl md:text-3xl font-semibold tracking-wide text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)]">
                  {selectedMedia.title}
                </h2>
                <AnimatePresence>
                  {showStory && selectedMedia.description && (
                    <motion.p
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 12 }}
                      transition={{ duration: 0.25 }}
                      className="mt-5 text-center text-lg md:text-xl leading-9 text-white/90 font-light"
                    >
                      {selectedMedia.description}
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
