import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Lock } from "lucide-react";
import type { GalleryItem, GallerySectionData, SelectedMedia } from "@/lib/gallery/gallery-types";
import type { UserMediaTier } from "@/lib/user-media";
import { UploadButton } from "./UploadButton";
import { GalleryTile } from "./GalleryTile";
import { LockedDevTile } from "./LockedDevTile";

// Chapter cover/subtitle aren't part of the shared GallerySectionData type;
// extended locally here rather than editing gallery-types.ts.
type JourneySectionData = GallerySectionData & {
  subtitle?: string;
  description?: string;
  coverUrl?: string;
};

export function GallerySection({
  section,
  vipMode,
  devPreviewActive,
  applyDevCacheOverride,
  onUpload,
  onSelectMedia,
  onDeleteMedia,
  onOpenChapter,
}: {
  section: JourneySectionData;
  vipMode: boolean;
  devPreviewActive: boolean;
  applyDevCacheOverride: (item: GalleryItem) => GalleryItem;
  onUpload: (files: FileList | null) => void;
  onSelectMedia: (media: SelectedMedia) => void;
  onDeleteMedia: (userMediaId: string) => void;
onOpenChapter: (chapter: JourneySectionData) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const [isDragging, setIsDragging] = useState(false);
  // Drag-to-scroll bookkeeping lives in refs, not state, so a drag gesture
  // doesn't cause a render on every pointermove — only the two renders that
  // toggle the grab/grabbing cursor.
  const isPointerDownRef = useRef(false);
  const didDragRef = useRef(false);
  const dragStartXRef = useRef(0);
  const dragStartScrollLeftRef = useRef(0);

  // Desktop-only drag-to-scroll (Apple/Google Photos, Steam Library style).
  // Gated to pointerType === "mouse" so touch pointers are never touched —
  // native swipe/touch physics on mobile pass straight through untouched.
  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse") return;
    const el = scrollRef.current;
    if (!el) return;
    isPointerDownRef.current = true;
    didDragRef.current = false;
    dragStartXRef.current = e.clientX;
    dragStartScrollLeftRef.current = el.scrollLeft;
  }, []);

  // A capture-phase click that swallows the click ONLY when the preceding
  // gesture actually crossed the drag threshold — a plain click (no
  // meaningful movement) is left completely alone, so GalleryTile /
  // LockedDevTile open exactly as before.
  const handleClickCapture = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!didDragRef.current) return;
    e.preventDefault();
    e.stopPropagation();
    didDragRef.current = false;
  }, []);

  useEffect(() => {
    const DRAG_THRESHOLD_PX = 7;

    const handlePointerMove = (e: PointerEvent) => {
      if (!isPointerDownRef.current) return;
      const el = scrollRef.current;
      if (!el) return;
      const dx = e.clientX - dragStartXRef.current;

      if (!didDragRef.current) {
        if (Math.abs(dx) < DRAG_THRESHOLD_PX) return;
        didDragRef.current = true;
        setIsDragging(true);
      }

      el.scrollLeft = dragStartScrollLeftRef.current - dx;
      e.preventDefault();
    };

    const handlePointerUp = () => {
      if (!isPointerDownRef.current) return;
      isPointerDownRef.current = false;
      if (didDragRef.current) {
        setIsDragging(false);
        // Leave didDragRef true through the synchronous click that follows
        // this pointerup (so handleClickCapture can swallow it), then clear
        // it for any unrelated future click.
        setTimeout(() => {
          didDragRef.current = false;
        }, 0);
      }
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, []);

  const allLockedAndItemsEmpty =
    section.items.length === 0 && section.lockedDevItems.length === 0;

  // On open, gently bring the most recently unlocked built-in scene into
  // view — it's the natural "you are here" point in the chapter's story.
  // Uploaded and locked cards are never targeted, and if nothing is
  // unlocked yet the carousel is simply left at its starting position.
  useEffect(() => {
    if (section.builtinUnlocked <= 0) return;
    const container = scrollRef.current;
    if (!container) return;
    const target = container.querySelector<HTMLElement>('[data-newest-unlock="true"]');
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section>
      <motion.div
        initial={{
  opacity: 0,
  y: 28,
  scale: 0.98,
}}
        whileInView={{
  opacity: 1,
  y: 0,
  scale: 1,
}}
        viewport={{ once: true, margin: "-60px" }}
        transition={{
  duration: 0.9,
  ease: [0.22, 1, 0.36, 1],
}}
        className="group relative mb-10 p-5 md:p-6 rounded-3xl bg-neutral-900/50 border backdrop-blur-md transition-all duration-500"
        style={{
          borderColor: vipMode ? "rgba(251,191,36,0.18)" : "rgba(251,191,36,0.1)",
          boxShadow: vipMode ? "0 0 40px rgba(88,28,135,0.15)" : "none",
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-amber-900/10 via-transparent to-purple-900/10 rounded-2xl" />
        <div className="relative flex flex-col items-center gap-5">
          {section.coverUrl ? (
            <div
  className="relative w-full aspect-[21/9] min-h-[320px] md:min-h-[360px] overflow-hidden rounded-3xl cursor-pointer"
  onClick={() => onOpenChapter(section)}
>
              <img
  src={section.coverUrl}
  alt={section.title}
  className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
/>

<div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 via-35% to-transparent" />

<div className="absolute inset-x-0 bottom-0 flex flex-col items-center justify-end gap-2 px-8 pb-8 text-center">
                <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-wide text-white drop-shadow-2xl">
                  {section.title}
                </h2>
                {section.subtitle && (
                  <p className="max-w-xl text-sm sm:text-base md:text-lg italic tracking-wide text-neutral-100/95 drop-shadow-lg leading-relaxed">
                    {section.subtitle}
                  </p>
                )}
                
              </div>
            </div>
          ) : (
            <>
              <h2 className="text-3xl font-semibold tracking-wide text-white">
                {section.title}
              </h2>
              {section.subtitle && (
                <p className="max-w-md text-center text-sm text-neutral-400">{section.subtitle}</p>
              )}
              {section.description && (
                <p className="max-w-md text-center text-xs text-neutral-500">
                  {section.description}
                </p>
              )}
            </>
          )}
          <div className="flex flex-col items-center gap-1 pt-2">
  <p className="text-sm font-medium tracking-wide text-amber-200">
    {section.builtinUnlocked} / {section.totalBuiltin} Scenes Discovered
  </p>

  {(section.items.length - section.builtinUnlocked) > 0 && (
    <p className="text-xs text-neutral-500">
      {section.items.length - section.builtinUnlocked} personal uploads
    </p>
  )}
</div>
          <UploadButton
            tier={section.uploadTier as UserMediaTier}
            accepts={section.accepts}
            onFiles={onUpload}
          />
        </div>
      </motion.div>

      {allLockedAndItemsEmpty ? (
        <div className="text-center py-12 text-neutral-500">
          <motion.div
            className="mx-auto mb-3 h-8 w-8"
            animate={
              section.lockedCount > 0
                ? { opacity: [0.3, 0.6, 0.3], scale: [1, 1.08, 1] }
                : { opacity: 0.4 }
            }
            transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
          >
            <Lock className="h-8 w-8" />
          </motion.div>
          <p className="text-sm">
            {section.lockedCount > 0
              ? "Locked. Keep answering correctly — or add your own."
              : "Nothing here yet."}
          </p>
        </div>
      ) : (
        <div className="relative -mx-6 px-6">
          <div
            ref={scrollRef}
            onPointerDown={handlePointerDown}
            onClickCapture={handleClickCapture}
            onDragStart={(e) => e.preventDefault()}
            className={`flex gap-8 overflow-x-auto overscroll-x-contain pb-4 snap-x snap-proximity select-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden ${
              isDragging ? "cursor-grabbing" : "cursor-grab"
            }`}
          >
            {section.items.map((rawItem, index) => {
              const item = applyDevCacheOverride(rawItem);
              const isNewestUnlock = index === section.builtinUnlocked - 1;
              return (
                <div
                  key={item.userMediaId ?? item.src}
                  data-newest-unlock={isNewestUnlock ? "true" : undefined}
                  className="shrink-0 w-[190px] sm:w-[220px] md:w-[240px] lg:w-[260px] snap-start"
                >
                  <GalleryTile
                    item={item}
                    index={index}
                    vipMode={vipMode}
                    onSelect={() =>
  onSelectMedia({
    src: item.src,
    type: item.type,
    title: item.title,
    description: item.description,
    section: section.title,
    index,
    items: section.items.map(applyDevCacheOverride).map((i) => ({
  ...i,
  title: i.title,
  description: i.description,
})),
  })
}
                    onDelete={onDeleteMedia}
                  />
                </div>
              );
            })}

            {section.lockedDevItems.map((meta) => (
              <div
                key={meta.key}
                className="group/locked relative shrink-0 w-[172px] sm:w-[196px] md:w-[216px] lg:w-[232px] snap-start"
              >
                <LockedDevTile
  meta={meta}
  developerPreviewActive={devPreviewActive}
  onSelect={() =>
    onSelectMedia({
      src: meta.src,
      type: "image",
      title: meta.label,
      description: meta.description,
      section: section.title,
      index: section.lockedDevItems.findIndex(
  (locked) => locked.key === meta.key
),
      items: section.lockedDevItems.map((locked) => ({
  src: locked.src,
  type: "image",
  title: locked.label,
  description: locked.description,
})),
    })
  }
/>
                {/* Desaturated, darkened veil — "ancient mural waiting to be
                    discovered", not a disabled button. Uses backdrop-filter
                    on a non-interactive sibling layer (not a filter on an
                    ancestor) so it never disrupts LockedDevTile's own
                    fixed-position preview overlay. */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 rounded-2xl transition-opacity duration-500 group-hover/locked:opacity-70 [backdrop-filter:grayscale(0.55)_brightness(0.68)_contrast(0.92)] [-webkit-backdrop-filter:grayscale(0.55)_brightness(0.68)_contrast(0.92)] bg-gradient-to-b from-black/10 via-black/10 to-black/35"
                />
              </div>
            ))}
          </div>

          {/* Edge fades hint that the row continues past the viewport.
              Non-interactive and narrow enough to never mask the art. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-0 w-10 sm:w-16 bg-gradient-to-r from-black to-transparent"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-0 w-10 sm:w-16 bg-gradient-to-l from-black to-transparent"
          />
        </div>
      )}
    </section>
  );
}
