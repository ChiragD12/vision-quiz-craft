import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, Trash2, Copy, X, ChevronLeft, ChevronRight, ImageIcon, Film, Sparkles } from "lucide-react";
import {
  listGenerations,
  toggleFavorite,
  deleteGeneration,
  type Generation,
} from "@/lib/generations";
import { toast } from "sonner";

type WithUrl = Generation & { url: string; thumbUrl?: string };

function useGenerations(): WithUrl[] {
  const [items, setItems] = useState<WithUrl[]>([]);
  const urlsRef = useRef<string[]>([]);

  const refresh = useCallback(async () => {
    const gens = await listGenerations();
    // Revoke old
    urlsRef.current.forEach((u) => URL.revokeObjectURL(u));
    const withUrl: WithUrl[] = gens.map((g) => {
      const url = URL.createObjectURL(g.blob);
      const thumbUrl = g.thumbnail ? URL.createObjectURL(g.thumbnail) : undefined;
      return { ...g, url, thumbUrl };
    });
    urlsRef.current = withUrl.flatMap((w) => [w.url, ...(w.thumbUrl ? [w.thumbUrl] : [])]);
    setItems(withUrl);
  }, []);

  useEffect(() => {
    refresh();
    const cb = () => refresh();
    window.addEventListener("upsc-generations-change", cb);
    return () => {
      window.removeEventListener("upsc-generations-change", cb);
      urlsRef.current.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [refresh]);

  return items;
}

// ------------- Home strip -------------

export function GenerationStrip({ onOpenAll }: { onOpenAll: () => void }) {
  const items = useGenerations();
const [viewerIdx, setViewerIdx] = useState<number | null>(null);

if (items.length === 0) return null;

const featured = items.slice(0, 3);
const rest = items.slice(3);

  return (
    <section>
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="font-display text-xl font-semibold inline-flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" /> Your Generations
        </h2>
        <button
          onClick={onOpenAll}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          View all ({items.length})
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {featured.map((g, i) => (
          <button
            key={g.id}
            onClick={() => setViewerIdx(i)}
            className="group relative aspect-square rounded-2xl overflow-hidden bg-muted border border-border hover:border-primary/40 transition"
          >
            <Tile item={g} />
            {g.favorite && (
              <span className="absolute top-2 right-2 rounded-full bg-black/60 p-1.5">
                <Heart className="h-3 w-3 fill-rose-400 text-rose-400" />
              </span>
            )}
          </button>
        ))}
      </div>

      {rest.length > 0 && (
        <div className="mt-4 flex gap-3 overflow-x-auto snap-x snap-mandatory pb-3 -mx-5 px-5 scrollbar-none">
          {rest.map((g, i) => (
            <button
              key={g.id}
              onClick={() => setViewerIdx(featured.length + i)}
              className="relative shrink-0 snap-start w-32 h-32 rounded-2xl overflow-hidden bg-muted border border-border hover:border-primary/40 transition"
            >
              <Tile item={g} />
              {g.favorite && (
                <span className="absolute top-1.5 right-1.5 rounded-full bg-black/60 p-1">
                  <Heart className="h-2.5 w-2.5 fill-rose-400 text-rose-400" />
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      <AnimatePresence>
        {viewerIdx != null && (
          <MediaViewer
            items={items}
            index={viewerIdx}
            onIndex={setViewerIdx}
            onClose={() => setViewerIdx(null)}
          />
        )}
      </AnimatePresence>
    </section>
  );
}

// ------------- Fullscreen gallery modal -------------

export function GenerationGalleryModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const items = useGenerations();
  const [viewerIdx, setViewerIdx] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    const cb = (e: KeyboardEvent) => {
      if (e.key === "Escape" && viewerIdx == null) onClose();
    };
    window.addEventListener("keydown", cb);
    return () => window.removeEventListener("keydown", cb);
  }, [open, viewerIdx, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-[#05070d] overflow-y-auto"
        >
          <header className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 bg-[#05070d]/80 backdrop-blur-xl border-b border-white/5">
            <div>
              <div className="text-[11px] uppercase tracking-[0.3em] text-amber-300/70">
                Gallery
              </div>
              <h2 className="font-display text-2xl text-white mt-0.5">
                Your Generations
                <span className="text-neutral-500 text-base ml-2">
                  ({items.length})
                </span>
              </h2>
            </div>
            <button
              onClick={onClose}
              className="rounded-full h-10 w-10 flex items-center justify-center bg-white/5 hover:bg-white/10 text-white transition"
            >
              <X className="h-5 w-5" />
            </button>
          </header>

          <div className="p-6">
            {items.length === 0 ? (
              <div className="mt-24 text-center text-neutral-500">
                <ImageIcon className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p>No generations yet.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {items.map((g, i) => (
                  <motion.button
                    key={g.id}
                    layout
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: Math.min(i * 0.02, 0.4) }}
                    onClick={() => setViewerIdx(i)}
                    className="group relative aspect-square rounded-xl overflow-hidden bg-neutral-900 border border-white/5 hover:border-amber-400/40 transition"
                  >
                    <Tile item={g} lazy />
                    {g.favorite && (
                      <span className="absolute top-2 right-2 rounded-full bg-black/60 p-1.5">
                        <Heart className="h-3 w-3 fill-rose-400 text-rose-400" />
                      </span>
                    )}
                    {g.kind === "video" && (
                      <span className="absolute bottom-2 left-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] text-white inline-flex items-center gap-1">
                        <Film className="h-2.5 w-2.5" /> video
                      </span>
                    )}
                  </motion.button>
                ))}
              </div>
            )}
          </div>

          <AnimatePresence>
            {viewerIdx != null && (
              <MediaViewer
                items={items}
                index={viewerIdx}
                onIndex={setViewerIdx}
                onClose={() => setViewerIdx(null)}
              />
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ------------- Tile -------------

function Tile({ item, lazy }: { item: WithUrl; lazy?: boolean }) {
  if (item.kind === "image") {
    return (
      <img
        src={item.url}
        alt={item.prompt ?? ""}
        loading={lazy ? "lazy" : undefined}
        className="w-full h-full object-cover"
      />
    );
  }
  return (
    <div className="relative w-full h-full">
      {item.thumbUrl ? (
        <img
          src={item.thumbUrl}
          alt=""
          loading={lazy ? "lazy" : undefined}
          className="w-full h-full object-cover"
        />
      ) : (
        <video
          src={item.url}
          className="w-full h-full object-cover"
          muted
          playsInline
          preload="metadata"
        />
      )}
      <div className="absolute inset-0 flex items-center justify-center bg-black/30">
        <div className="rounded-full bg-black/60 p-2">
          <Film className="h-4 w-4 text-white" />
        </div>
      </div>
    </div>
  );
}

// ------------- Media Viewer -------------

function MediaViewer({
  items,
  index,
  onIndex,
  onClose,
}: {
  items: WithUrl[];
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
}) {
  const cur = items[index];
  const [zoom, setZoom] = useState(1);

  const go = useCallback(
    (dir: 1 | -1) => {
      const n = items.length;
      if (n === 0) return;
      onIndex((index + dir + n) % n);
      setZoom(1);
    },
    [index, items.length, onIndex],
  );

  useEffect(() => {
    const cb = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", cb);
    return () => window.removeEventListener("keydown", cb);
  }, [go, onClose]);

  // Basic swipe
  const touch = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touch.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touch.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touch.current.x;
    if (Math.abs(dx) > 60) go(dx < 0 ? 1 : -1);
    touch.current = null;
  };

  if (!cur) return null;

  const onFav = async () => {
    await toggleFavorite(cur.id);
  };
  const onDel = async () => {
    await deleteGeneration(cur.id);
    if (items.length <= 1) onClose();
    else onIndex(Math.max(0, index - 1));
  };
  const onCopy = async () => {
    if (!cur.prompt) return;
    try {
      await navigator.clipboard.writeText(cur.prompt);
      toast.success("Prompt copied");
    } catch {
      toast.error("Copy failed");
    }
  };
  const onWheel = (e: React.WheelEvent) => {
    if (cur.kind !== "image") return;
    e.preventDefault();
    setZoom((z) => Math.max(1, Math.min(4, z + (e.deltaY < 0 ? 0.2 : -0.2))));
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] bg-black/95 flex flex-col"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <header className="flex items-center justify-between px-4 py-3">
        <div className="text-white/60 text-sm nums">
          {index + 1} / {items.length}
        </div>
        <div className="flex items-center gap-2">
          <IconBtn onClick={onFav} title="Favorite">
            <Heart
              className={
                "h-5 w-5 " + (cur.favorite ? "fill-rose-400 text-rose-400" : "text-white")
              }
            />
          </IconBtn>
          <IconBtn onClick={onDel} title="Delete">
            <Trash2 className="h-5 w-5 text-white" />
          </IconBtn>
          <IconBtn onClick={onClose} title="Close">
            <X className="h-5 w-5 text-white" />
          </IconBtn>
        </div>
      </header>

      <div className="relative flex-1 flex items-center justify-center overflow-hidden" onWheel={onWheel}>
        <button
          onClick={() => go(-1)}
          className="absolute left-3 z-10 rounded-full bg-white/5 hover:bg-white/15 h-11 w-11 flex items-center justify-center"
          aria-label="Previous"
        >
          <ChevronLeft className="h-6 w-6 text-white" />
        </button>
        <AnimatePresence mode="wait">
          <motion.div
            key={cur.id}
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="max-h-full max-w-[90vw] flex items-center justify-center"
          >
            {cur.kind === "image" ? (
              <img
                src={cur.url}
                alt=""
                style={{ transform: `scale(${zoom})`, transition: "transform 120ms ease-out" }}
                className="max-h-[75vh] max-w-full object-contain select-none"
                draggable={false}
              />
            ) : (
              <video
                src={cur.url}
                controls
                autoPlay
                loop
                playsInline
                className="max-h-[75vh] max-w-full"
              />
            )}
          </motion.div>
        </AnimatePresence>
        <button
          onClick={() => go(1)}
          className="absolute right-3 z-10 rounded-full bg-white/5 hover:bg-white/15 h-11 w-11 flex items-center justify-center"
          aria-label="Next"
        >
          <ChevronRight className="h-6 w-6 text-white" />
        </button>
      </div>

      {cur.prompt && (
        <div className="px-6 py-4 border-t border-white/10 bg-black/40">
          <div className="max-w-3xl mx-auto flex items-start gap-3">
            <div className="flex-1">
              <div className="text-[10px] uppercase tracking-[0.3em] text-amber-300/60 mb-1">
                Prompt
              </div>
              <p className="text-sm text-white/90 leading-relaxed">{cur.prompt}</p>
              {cur.provider && (
                <p className="text-[11px] text-white/40 mt-1.5">
                  {cur.provider}
                  {cur.model ? ` · ${cur.model}` : ""}
                </p>
              )}
            </div>
            <button
              onClick={onCopy}
              className="shrink-0 inline-flex items-center gap-1 rounded-md bg-white/10 hover:bg-white/20 px-2.5 py-1.5 text-xs text-white"
            >
              <Copy className="h-3.5 w-3.5" /> Copy
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );
}

function IconBtn({
  children,
  onClick,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="rounded-full h-10 w-10 flex items-center justify-center bg-white/5 hover:bg-white/15 transition"
    >
      {children}
    </button>
  );
}
