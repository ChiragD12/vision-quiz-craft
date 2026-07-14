import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useRouterState } from "@tanstack/react-router";
import { Image as ImageIcon, Upload, Check, Lock, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/store";
import {
  useBackgroundSelection,
  selectDefaultBackground,
  selectJourneyBackground,
  selectCustomBackground,
  clearCustomBackground,
  DEFAULT_BACKGROUND_SRC,
} from "@/lib/user-background";
import { storyImageUrl } from "@/lib/journey/assets";
import { TOTAL_STORY_IMAGES } from "@/lib/journey";

type Tab = "default" | "unlocked" | "custom";

/**
 * Floating glass wallpaper selector, mounted globally at bottom-right.
 * Reuses the existing user-background store — Journey story images act
 * as "wallpapers" and unlock as the user progresses.
 */
export function WallpaperSelector() {
  const route = useRouterState({
  select: (s) => s.location.pathname,
});
  const sel = useBackgroundSelection(route);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>(() =>
    sel.kind === "journey" ? "unlocked" : sel.kind === "custom" ? "custom" : "default",
  );
  const rootRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Reactive unlock count.
  const [unlocked, setUnlocked] = useState<number>(() => api.unlockedImageCount());
  useEffect(() => {
    const cb = () => setUnlocked(api.unlockedImageCount());
    window.addEventListener("upsc-db-change", cb);
    window.addEventListener("storage", cb);
    return () => {
      window.removeEventListener("upsc-db-change", cb);
      window.removeEventListener("storage", cb);
    };
  }, []);

  // Close on outside click / escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const onUpload = async (f: File | null) => {
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      toast.error("Please choose an image file.");
      return;
    }
    try {
      await selectCustomBackground(route, f);
      toast.success("Wallpaper updated.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    }
  };

  return (
    <div
      ref={rootRef}
      className="relative flex justify-center pointer-events-auto"
    >
      <AnimatePresence>
        {open && (
          <motion.div
            key="panel"
            initial={{ opacity: 0, y: 12, scale: 0.96, filter: "blur(6px)" }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: 8, scale: 0.97, filter: "blur(4px)" }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="absolute bottom-[52px] left-1/2 -translate-x-1/2 w-[320px] rounded-2xl border overflow-hidden"
            style={{
              borderColor: "rgba(255,255,255,0.10)",
              background: "rgba(15,17,26,0.72)",
              backdropFilter: "blur(24px) saturate(140%)",
              boxShadow:
                "0 30px 80px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.03) inset, 0 1px 0 rgba(255,255,255,0.06) inset",
            }}
          >
            {/* Tabs */}
            <div className="flex items-center gap-1 p-1.5 border-b border-white/5">
              <TabButton active={tab === "default"} onClick={() => setTab("default")}>
                Default
              </TabButton>
              <TabButton active={tab === "unlocked"} onClick={() => setTab("unlocked")}>
                Unlocked
              </TabButton>
              <TabButton active={tab === "custom"} onClick={() => setTab("custom")}>
                Custom
              </TabButton>
            </div>

            <div className="p-3 max-h-[320px] overflow-y-auto">
              {tab === "default" && (
                <button
                  type="button"
                  onClick={() => {
                    selectDefaultBackground(route);
                    toast.success("Default wallpaper applied.");
                  }}
                  className="group relative w-full aspect-[3/4] rounded-xl overflow-hidden border transition-all"
                  style={{
                    borderColor:
                      sel.kind === "default"
                        ? "rgba(251,191,36,0.55)"
                        : "rgba(255,255,255,0.08)",
                  }}
                >
                  <img
                    src={DEFAULT_BACKGROUND_SRC}
                    alt="Default"
                    className="absolute inset-0 h-full w-full object-cover opacity-90 group-hover:opacity-100 transition-opacity"
                  />
                  <div className="absolute inset-x-0 bottom-0 p-2 text-xs text-white/85 bg-gradient-to-t from-black/70 to-transparent">
                    Default
                  </div>
                  {sel.kind === "default" && <SelectedTick />}
                </button>
              )}

              {tab === "unlocked" && (
                <UnlockedGrid
                  unlocked={unlocked}
                  selectedId={sel.kind === "journey" ? sel.journeyId : undefined}
                  onPick={(id) => {
                    selectJourneyBackground(route, id);
                    toast.success("Wallpaper updated.");
                  }}
                />
              )}

              {tab === "custom" && (
                <div className="space-y-3">
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      onUpload(e.target.files?.[0] ?? null);
                      if (fileRef.current) fileRef.current.value = "";
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="w-full flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed py-6 text-sm text-white/80 hover:text-white transition-colors"
                    style={{ borderColor: "rgba(255,255,255,0.15)" }}
                  >
                    <Upload className="h-4 w-4" />
                    {sel.kind === "custom" ? "Replace image" : "Upload wallpaper"}
                    <span className="text-[10px] uppercase tracking-[0.18em] text-white/40">
                      1178 × 2556 recommended
                    </span>
                  </button>
                  {sel.kind === "custom" && (
                    <button
                      type="button"
                      onClick={async () => {
                        await clearCustomBackground(route);
                        toast.success("Custom wallpaper removed.");
                      }}
                      className="w-full inline-flex items-center justify-center gap-2 text-xs text-white/60 hover:text-white/90 transition-colors py-2"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Remove custom
                    </button>
                  )}
                  <p className="text-[10px] leading-relaxed text-white/40 px-1">
                    Stored on this device only. Nothing is uploaded.
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Trigger capsule */}
      <motion.button
        type="button"
        onClick={() => setOpen((v) => !v)}
        whileTap={{ scale: 0.96 }}
        whileHover={{ y: -1 }}
        transition={{ type: "spring", stiffness: 320, damping: 24 }}
        aria-label="Change wallpaper"
        className="group inline-flex items-center gap-2 rounded-full border pl-3 pr-4 py-2 text-xs font-medium text-white/85 hover:text-white transition-colors"
        style={{
          borderColor: "rgba(255,255,255,0.10)",
          background: "rgba(15,17,26,0.62)",
          backdropFilter: "blur(20px) saturate(140%)",
          boxShadow:
            "0 10px 30px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.03) inset",
        }}
      >
        <ImageIcon className="h-3.5 w-3.5 opacity-80 group-hover:opacity-100" />
        <span className="tracking-wide">Change Wallpaper</span>
      </motion.button>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative flex-1 rounded-lg px-2.5 py-1.5 text-[11px] font-medium tracking-wide transition-colors"
      style={{
        color: active ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.55)",
        background: active ? "rgba(255,255,255,0.06)" : "transparent",
      }}
    >
      {children}
    </button>
  );
}

function SelectedTick() {
  return (
    <div
      className="absolute top-1.5 right-1.5 h-5 w-5 rounded-full flex items-center justify-center"
      style={{
        background: "rgba(251,191,36,0.95)",
        boxShadow: "0 0 12px rgba(251,191,36,0.6)",
      }}
    >
      <Check className="h-3 w-3 text-black" strokeWidth={3} />
    </div>
  );
}

function UnlockedGrid({
  unlocked,
  selectedId,
  onPick,
}: {
  unlocked: number;
  selectedId: number | undefined;
  onPick: (id: number) => void;
}) {
  if (unlocked === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
        <Lock className="h-4 w-4 text-white/40" />
        <p className="text-xs text-white/60">No wallpapers unlocked yet.</p>
        <p className="text-[10px] text-white/40 max-w-[220px]">
          Answer questions correctly to unlock Journey wallpapers.
        </p>
      </div>
    );
  }
  const ids = Array.from({ length: Math.min(unlocked, TOTAL_STORY_IMAGES) }, (_, i) => i + 1);
  return (
    <div className="grid grid-cols-3 gap-2">
      {ids.map((id) => {
        const active = selectedId === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onPick(id)}
            className="relative aspect-[3/4] rounded-lg overflow-hidden border transition-all hover:scale-[1.02]"
            style={{
              borderColor: active
                ? "rgba(251,191,36,0.65)"
                : "rgba(255,255,255,0.08)",
              boxShadow: active ? "0 0 16px rgba(251,191,36,0.28)" : "none",
            }}
          >
            <img
              src={storyImageUrl(id)}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
              loading="lazy"
            />
            {active && <SelectedTick />}
          </button>
        );
      })}
    </div>
  );
}
