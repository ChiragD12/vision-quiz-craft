import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { api } from "@/lib/store";
import { useAppearance, type ThemeMode } from "@/lib/appearance";
import {
  selectDefaultBackground,
  selectJourneyBackground,
  selectCustomBackground,
  clearCustomBackground,
  useBackgroundSelection,
  useBackgroundUrl,
  DEFAULT_BACKGROUND_SRC,
} from "@/lib/user-background";
import { storyImageUrl } from "@/lib/journey/assets";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  KeyRound,
  ExternalLink,
  Download,
  Upload,
  Trash2,
  Eye,
  EyeOff,
  Sparkles,
  Database,
  SlidersHorizontal,
  Info,
  ChevronRight,
  Check,
  Palette,
  Sun,
  Moon,
  Image as ImageIcon,
  Volume2,
  VolumeX,
} from "lucide-react";
import { toast } from "sonner";
import { playSound } from "@/lib/sound-manager";

export const Route = createFileRoute("/settings")({
  ssr: false,
  head: () => ({ meta: [{ title: "Settings — UPSC Revision" }] }),
  component: SettingsPage,
});

const MODELS = [
  { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash", desc: "Fast, recommended" },
  { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro", desc: "Slower, better reasoning" },
  { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash", desc: "Previous generation" },
];

// Theme is the first Appearance preference; future ones (accent color,
// AMOLED, high contrast, animation speed, reduce motion, glass intensity,
// border radius, background style, wallpaper, font size, font family) each
// get their own options array + OptionGroup block below, reading/writing
// the same appearance store via useAppearance().
const THEME_OPTIONS = [
  { id: "dark" as const, label: "Dark", desc: "", icon: Moon },
  { id: "light" as const, label: "Light", desc: "", icon: Sun },
];

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

// ---------------- Grouped list primitives ----------------
// The whole page is built from these two pieces: Group (a rounded card
// that holds one or more Rows, with subtle dividers between them) and Row
// (a single tappable, expandable line — title + a small value/preview on
// the right, chevron rotates on expand). This mirrors iOS Settings'
// grouped-table look while keeping the app's existing glass styling.

function Group({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const shouldReduceMotion = useReducedMotion();
  return (
    <motion.div
      initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.45, delay, ease: EASE }}
      className="overflow-hidden rounded-2xl border backdrop-blur-xl"
      style={{
        background: "var(--glass-bg)",
        borderColor: "var(--glass-border)",
        boxShadow: "var(--glass-shadow)",
      }}
    >
      {children}
    </motion.div>
  );
}

function Row({
  icon: Icon,
  title,
  open,
  onToggle,
  preview,
  children,
  first = false,
  expandable = true,
}: {
  icon?: React.ElementType;
  title: string;
  open: boolean;
  onToggle: () => void;
  preview?: React.ReactNode;
  children?: React.ReactNode;
  first?: boolean;
  /** Set false for a row that's just a title + inline control (e.g. Sound),
   * with nothing to expand into — renders with no chevron / body. */
  expandable?: boolean;
}) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onToggle();
    }
  };

  return (
    <div
      className={!first ? "border-t" : ""}
      style={{ borderColor: "var(--glass-border)" }}
    >
      {/* Not a real <button> — the preview slot may contain its own
          interactive controls (toggle, segmented switch), and buttons
          can't nest inside buttons. */}
      <div
        role={expandable ? "button" : undefined}
        tabIndex={expandable ? 0 : undefined}
        onClick={expandable ? onToggle : undefined}
        onKeyDown={expandable ? handleKeyDown : undefined}
        className={`flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left min-h-[52px] select-none ${expandable ? "cursor-pointer" : ""}`}
        aria-expanded={expandable ? open : undefined}
      >
        <span className="flex items-center gap-2.5 text-[15px] font-medium">
          {Icon && <Icon className="h-4 w-4 text-primary shrink-0" />}
          {title}
        </span>
        <span className="flex items-center gap-1.5 text-sm text-muted-foreground shrink-0">
          {preview}
          {expandable && (
            <motion.span
              animate={{ rotate: open ? 90 : 0 }}
              transition={{ duration: 0.25, ease: EASE }}
              className="flex items-center"
            >
              <ChevronRight className="h-4 w-4 opacity-60" />
            </motion.span>
          )}
        </span>
      </div>
      {expandable && (
        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              key="content"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: EASE }}
              className="overflow-hidden"
            >
              <div
                className="px-4 pb-4 pt-0.5 border-t"
                style={{ borderColor: "var(--glass-border)" }}
              >
                {children}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}

function OptionGroup<T extends string>({
  name,
  value,
  onChange,
  options,
  columns = 2,
}: {
  name: string;
  value: T;
  onChange: (value: T) => void;
  options: { id: T; label: string; desc: string; icon?: React.ElementType }[];
  columns?: 1 | 2;
}) {
  return (
    <div className={columns === 2 ? "grid grid-cols-2 gap-2" : "space-y-2"}>
      {options.map((opt) => {
        const active = value === opt.id;
        const Icon = opt.icon;
        return (
          <label
            key={opt.id}
            className="relative flex items-start gap-3 cursor-pointer rounded-xl border p-3 transition-all duration-300"
            style={{
              borderColor: active ? "var(--option-border-active)" : "var(--option-border-inactive)",
              background: active ? "var(--option-bg-active)" : "var(--option-bg-inactive)",
              boxShadow: active ? "var(--option-shadow-active)" : "none",
            }}
          >
            <input
              type="radio"
              name={name}
              checked={active}
              onChange={() => onChange(opt.id)}
              className="sr-only"
            />
            <div
              className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-all duration-300"
              style={{
                borderColor: active ? "var(--option-dot-border-active)" : "var(--option-dot-border-inactive)",
                background: active ? "var(--option-dot-bg-active)" : "transparent",
              }}
            >
              <AnimatePresence>
                {active && (
                  <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: EASE }}
                  >
                    <Check className="h-2.5 w-2.5 text-primary" strokeWidth={3} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <div>
              <div className="flex items-center gap-1.5 text-sm font-medium">
                {Icon && <Icon className="h-3.5 w-3.5 text-primary" />}
                {opt.label}
                <span className="text-muted-foreground font-normal">{opt.desc}</span>
              </div>
            </div>
          </label>
        );
      })}
    </div>
  );
}

// Compact two-way segmented control used inline in a collapsed row (e.g.
// theme). Stops propagation so tapping it doesn't also toggle the row.
function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { id: T; label: string; icon: React.ElementType }[];
}) {
  return (
    <div
      className="flex items-center rounded-full border p-0.5"
      style={{ borderColor: "var(--option-border-inactive)" }}
      onClick={(e) => e.stopPropagation()}
    >
      {options.map((opt) => {
        const active = value === opt.id;
        const Icon = opt.icon;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            className="flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-all duration-200"
            style={{
              background: active ? "var(--option-bg-active)" : "transparent",
              color: active ? "var(--foreground)" : "var(--muted-foreground)",
            }}
          >
            <Icon className="h-3 w-3" />
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function VolumeSlider({
  value,
  onChange,
  disabled = false,
}: {
  value: number; // 0.0–1.0
  onChange: (value: number) => void;
  disabled?: boolean;
}) {
  const pct = Math.round(value * 100);
  return (
    <div onClick={(e) => e.stopPropagation()}>
      <style>{`
        .master-volume-slider {
          transition: box-shadow 0.2s ease, opacity 0.2s ease;
        }
        .master-volume-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 17px;
          height: 17px;
          border-radius: 9999px;
          background: #ffffff;
          border: 2px solid #d19a1f;
          box-shadow: 0 0 0 0 rgba(245, 180, 33, 0);
          cursor: pointer;
          transition: box-shadow 0.2s ease, transform 0.2s ease;
        }
        .master-volume-slider:hover::-webkit-slider-thumb,
        .master-volume-slider:focus-visible::-webkit-slider-thumb {
          box-shadow: 0 0 8px 1px rgba(245, 180, 33, 0.45);
          transform: scale(1.06);
        }
        .master-volume-slider::-moz-range-thumb {
          width: 17px;
          height: 17px;
          border-radius: 9999px;
          background: #ffffff;
          border: 2px solid #d19a1f;
          box-shadow: 0 0 0 0 rgba(245, 180, 33, 0);
          cursor: pointer;
          transition: box-shadow 0.2s ease, transform 0.2s ease;
        }
        .master-volume-slider:hover::-moz-range-thumb,
        .master-volume-slider:focus-visible::-moz-range-thumb {
          box-shadow: 0 0 8px 1px rgba(245, 180, 33, 0.45);
          transform: scale(1.06);
        }
        .master-volume-slider:disabled::-webkit-slider-thumb {
          cursor: default;
          transform: none;
          box-shadow: none;
        }
        .master-volume-slider:disabled::-moz-range-thumb {
          cursor: default;
          transform: none;
          box-shadow: none;
        }
      `}</style>
      <div className="flex items-center gap-3 w-full">
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={pct}
          onChange={(e) => onChange(Number(e.target.value) / 100)}
          aria-label="Master volume"
          disabled={disabled}
          className="master-volume-slider h-1.5 flex-1 cursor-pointer appearance-none rounded-full outline-none"
          style={{
            background: `linear-gradient(to right, #f5b421 ${pct}%, var(--option-bg-inactive) ${pct}%)`,
            opacity: disabled ? 0.45 : 1,
            pointerEvents: disabled ? "none" : "auto",
          }}
        />
        <span className="w-10 shrink-0 text-right text-sm text-muted-foreground tabular-nums">
          {pct}%
        </span>
      </div>
      {disabled && (
        <p className="mt-1.5 text-xs text-muted-foreground/70">
          Enable Sound Effects to adjust volume.
        </p>
      )}
    </div>
  );
}

function SoundToggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  const toggleTransition = { duration: 0.25, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] };
  return (
    <motion.button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label="Sound effects"
      onClick={(e) => {
        e.stopPropagation();
        onChange(!checked);
      }}
      className="relative h-6 w-10 shrink-0 rounded-full border"
      animate={{
        borderColor: checked ? "#d19a1f" : "var(--option-border-inactive)",
        backgroundColor: checked ? "#f5b421" : "var(--option-bg-inactive)",
        boxShadow: checked
          ? "0 0 6px 1px rgba(245, 180, 33, 0.35)"
          : "0 0 0px 0px rgba(245, 180, 33, 0)",
      }}
      transition={toggleTransition}
    >
      <motion.span
        className="absolute top-0.5 h-4 w-4 rounded-full"
        animate={{
          left: checked ? "calc(100% - 18px)" : "2px",
          backgroundColor: checked ? "#ffffff" : "var(--option-dot-border-inactive)",
        }}
        transition={toggleTransition}
      />
    </motion.button>
  );
}

function BackgroundSection() {
  const selection = useBackgroundSelection("/");
  const currentUrl = useBackgroundUrl("/", storyImageUrl);
  const fileRef = useRef<HTMLInputElement>(null);
  const unlockedCount = api.unlockedImageCount();
  const unlockedIds = Array.from({ length: unlockedCount }, (_, i) => i + 1);

  const onUpload = async (f: File | null) => {
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      toast.error("Please choose an image file.");
      return;
    }
    try {
      await selectCustomBackground("/", f);
      toast.success("Custom background applied.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    }
  };

  const chooseDefault = () => {
    selectDefaultBackground("/");
    toast.success("Default background applied.");
  };

  const chooseJourney = (id: number) => {
    selectJourneyBackground("/", id);
    toast.success("Background updated.");
  };

  const chooseCustom = () => fileRef.current?.click();

  const removeCustom = async () => {
    await clearCustomBackground("/");
    toast.success("Custom background removed.");
  };

  const isDefault = selection.kind === "default";
  const isCustom = selection.kind === "custom";

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <BgSourceTile
          label="Default"
          desc="Original app background"
          active={isDefault}
          onClick={chooseDefault}
          previewSrc={DEFAULT_BACKGROUND_SRC}
        />
        <BgSourceTile
          label="Journey"
          desc={`${unlockedCount} unlocked`}
          active={selection.kind === "journey"}
          onClick={() => {
            if (unlockedCount === 0) {
              toast.info("Unlock Journey images by answering questions correctly.");
              return;
            }
            if (selection.kind !== "journey") {
              chooseJourney(selection.journeyId ?? unlockedCount);
            }
          }}
          previewSrc={
            selection.kind === "journey" && selection.journeyId
              ? storyImageUrl(selection.journeyId)
              : unlockedCount > 0
                ? storyImageUrl(unlockedCount)
                : DEFAULT_BACKGROUND_SRC
          }
        />
        <BgSourceTile
          label="Custom"
          desc="Your own image"
          active={isCustom}
          onClick={chooseCustom}
          previewSrc={isCustom ? currentUrl : undefined}
        />
      </div>

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

      {isCustom && (
        <div
          className="flex items-center justify-between gap-3 rounded-xl border p-2.5"
          style={{
            borderColor: "var(--option-border-inactive)",
            background: "var(--option-bg-inactive)",
          }}
        >
          <div className="text-[11px] text-muted-foreground">
            Stored on this device only
          </div>
          <div className="flex gap-2 shrink-0">
            <Button size="sm" variant="outline" onClick={chooseCustom}>
              <Upload className="h-3.5 w-3.5 mr-1" />
              Replace
            </Button>
            <Button size="sm" variant="outline" onClick={removeCustom}>
              <Trash2 className="h-3.5 w-3.5 mr-1" />
              Remove
            </Button>
          </div>
        </div>
      )}

      {selection.kind === "journey" && (
        <div>
          {unlockedCount === 0 ? (
            <p className="text-xs text-muted-foreground">
              Answer questions correctly to unlock Journey images.
            </p>
          ) : (
            <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
              {unlockedIds.map((id) => {
                const active = selection.journeyId === id;
                return (
                  <button
                    key={id}
                    onClick={() => chooseJourney(id)}
                    className="group relative aspect-[9/16] rounded-lg transition-all"
                    style={{
                      boxShadow: active ? "var(--option-shadow-active)" : "none",
                    }}
                    aria-label={`Use Journey image ${id} as background`}
                  >
                    <div
                      className="relative h-full w-full overflow-hidden rounded-lg border transition-all"
                      style={{
                        borderColor: active
                          ? "var(--option-border-active)"
                          : "var(--option-border-inactive)",
                      }}
                    >
                      <img
                        src={storyImageUrl(id)}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                      {active && (
                        <div className="absolute inset-0 flex items-end justify-end p-1.5 bg-gradient-to-t from-black/60 via-transparent">
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                            <Check className="h-3 w-3" strokeWidth={3} />
                          </span>
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function BgSourceTile({
  label,
  desc,
  active,
  onClick,
  previewSrc,
}: {
  label: string;
  desc: string;
  active: boolean;
  onClick: () => void;
  previewSrc?: string;
}) {
  return (
    <button
      onClick={onClick}
      className="relative flex items-center gap-3 rounded-xl border p-2.5 text-left transition-all"
      style={{
        borderColor: active ? "var(--option-border-active)" : "var(--option-border-inactive)",
        background: active ? "var(--option-bg-active)" : "var(--option-bg-inactive)",
        boxShadow: active ? "var(--option-shadow-active)" : "none",
      }}
    >
      <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md border"
        style={{ borderColor: "var(--option-border-inactive)", background: "rgba(255,255,255,0.03)" }}
      >
        {previewSrc ? (
          <img src={previewSrc} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-muted-foreground">
            <ImageIcon className="h-4 w-4" />
          </div>
        )}
      </div>
      <div className="min-w-0">
        <div className="text-sm font-medium">{label}</div>
        <div className="text-[11px] text-muted-foreground truncate">{desc}</div>
      </div>
      {active && (
        <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Check className="h-2.5 w-2.5" strokeWidth={3} />
        </span>
      )}
    </button>
  );
}

function backgroundLabel(kind: string): string {
  if (kind === "journey") return "Journey";
  if (kind === "custom") return "Custom";
  return "Default";
}

function SettingsPage() {
  const [key, setKey] = useState(() => api.getApiKey());
  const [show, setShow] = useState(false);
  const [model, setModel] = useState(() => api.getModel());
  const [appearance, updateAppearance] = useAppearance();
  const [masterVolume, setMasterVolumeState] = useState(() => api.getMasterVolume());
  const shouldReduceMotion = useReducedMotion();

  // Which top-level row is expanded (single-open accordion keeps the page
  // short) plus the one nested row (Model, inside AI & Quiz Generation).
  const [openRow, setOpenRow] = useState<string | null>(null);
  const [modelOpen, setModelOpen] = useState(false);
  const toggleRow = (id: string) =>
    setOpenRow((cur) => (cur === id ? null : id));

  const selection = useBackgroundSelection("/");

  const saveTheme = (theme: ThemeMode) => {
    updateAppearance({ theme });
    toast.success(`${theme === "light" ? "Light" : "Dark"} theme applied.`);
  };

  const saveSoundEnabled = (value: boolean) => {
    updateAppearance({ soundEnabled: value });
    if (value) playSound("click");
    toast.success(value ? "Sound effects on." : "Sound effects off.");
  };

  const saveMasterVolume = (value: number) => {
    setMasterVolumeState(value);
    api.setMasterVolume(value);
  };

  const saveKey = () => {
    api.setApiKey(key);
    toast.success(key ? "Key saved on this device." : "Key cleared.");
  };
  const saveModel = (m: string) => {
    setModel(m);
    api.setModel(m);
    toast.success("Model updated.");
    setModelOpen(false);
  };

  const exportData = () => {
    const blob = new Blob([api.exportJSON()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `upsc-revision-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importData = async (f: File | null) => {
    if (!f) return;
    try {
      const text = await f.text();
      api.importJSON(text);
      toast.success("Data imported.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Invalid file");
    }
  };

  const eraseAll = () => {
    if (
      !confirm(
        "Erase everything on this device — subjects, topics, notes, quizzes, bookmarks, wrong answers, streak? This cannot be undone.",
      )
    )
      return;
    localStorage.removeItem("upsc_revision_db_v1");
    toast.success("All data cleared.");
    setTimeout(() => location.reload(), 300);
  };

  const activeModel = MODELS.find((m) => m.id === model);

  return (
    <div className="min-h-screen relative overflow-x-hidden">
      <header className="relative z-10 mx-auto max-w-2xl px-5 pt-8">
        <motion.h1
          initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE }}
          className="font-display text-2xl font-semibold"
        >
          Settings
        </motion.h1>
      </header>

      <main className="relative z-10 mx-auto max-w-2xl px-5 py-6 space-y-5">
        {/* ---------------- AI & Quiz Generation ---------------- */}
        <Group>
          <Row
            icon={Sparkles}
            title="AI & Quiz Generation"
            open={openRow === "ai"}
            onToggle={() => toggleRow("ai")}
            first
          >
            <div className="space-y-4 pt-2">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <KeyRound className="h-3.5 w-3.5 text-primary" />
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Gemini API Key
                  </h3>
                </div>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      type={show ? "text" : "password"}
                      value={key}
                      onChange={(e) => setKey(e.target.value)}
                      placeholder="AIza…"
                      autoComplete="off"
                      spellCheck={false}
                      className="bg-[var(--input-glass-bg)] border-[var(--input-glass-border)] backdrop-blur-md pr-10 transition-all duration-300 focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:border-primary/50"
                    />
                    <button
                      type="button"
                      onClick={() => setShow((s) => !s)}
                      className="absolute inset-y-0 right-2 flex items-center text-muted-foreground hover:text-foreground transition-colors"
                      aria-label={show ? "Hide" : "Show"}
                    >
                      {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.96 }}>
                    <Button onClick={saveKey}>Save</Button>
                  </motion.div>
                </div>
                <a
                  href="https://aistudio.google.com/apikey"
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline underline-offset-4"
                >
                  Get a free key <ExternalLink className="h-3 w-3" />
                </a>
              </div>

              <div
                className="rounded-xl border overflow-hidden"
                style={{ borderColor: "var(--option-border-inactive)" }}
              >
                <button
                  type="button"
                  onClick={() => setModelOpen((o) => !o)}
                  className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left"
                  aria-expanded={modelOpen}
                >
                  <span className="text-sm font-medium">Model</span>
                  <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    {activeModel?.label ?? model}
                    <motion.span
                      animate={{ rotate: modelOpen ? 90 : 0 }}
                      transition={{ duration: 0.25, ease: EASE }}
                      className="flex items-center"
                    >
                      <ChevronRight className="h-4 w-4 opacity-60" />
                    </motion.span>
                  </span>
                </button>
                <AnimatePresence initial={false}>
                  {modelOpen && (
                    <motion.div
                      key="model-content"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: EASE }}
                      className="overflow-hidden"
                    >
                      <div
                        className="px-3 pb-3 pt-1 space-y-2 border-t"
                        style={{ borderColor: "var(--option-border-inactive)" }}
                      >
                        {MODELS.map((m) => {
                          const active = model === m.id;
                          return (
                            <label
                              key={m.id}
                              className="relative flex items-start gap-3 cursor-pointer rounded-xl border p-3 transition-all duration-300"
                              style={{
                                borderColor: active ? "var(--option-border-active)" : "var(--option-border-inactive)",
                                background: active ? "var(--option-bg-active)" : "var(--option-bg-inactive)",
                                boxShadow: active ? "var(--option-shadow-active)" : "none",
                              }}
                            >
                              <input
                                type="radio"
                                name="model"
                                checked={active}
                                onChange={() => saveModel(m.id)}
                                className="sr-only"
                              />
                              <div
                                className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-all duration-300"
                                style={{
                                  borderColor: active ? "var(--option-dot-border-active)" : "var(--option-dot-border-inactive)",
                                  background: active ? "var(--option-dot-bg-active)" : "transparent",
                                }}
                              >
                                <AnimatePresence>
                                  {active && (
                                    <motion.div
                                      initial={{ scale: 0, opacity: 0 }}
                                      animate={{ scale: 1, opacity: 1 }}
                                      exit={{ scale: 0, opacity: 0 }}
                                      transition={{ duration: 0.25, ease: EASE }}
                                    >
                                      <Check className="h-2.5 w-2.5 text-primary" strokeWidth={3} />
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                              <div>
                                <div className="text-sm font-medium">
                                  {m.label}
                                  <span className="text-muted-foreground font-normal"> — {m.desc}</span>
                                </div>
                                <div className="text-[11px] font-mono tracking-wide text-muted-foreground/70">
                                  {m.id}
                                </div>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </Row>
        </Group>

        {/* ---------------- Sound / Appearance / Background ---------------- */}
        <Group delay={0.03}>
          <Row
            icon={appearance.soundEnabled ? Volume2 : VolumeX}
            title="Sound Effects"
            open={openRow === "sound"}
            onToggle={() => toggleRow("sound")}
            preview={
              <SoundToggle checked={appearance.soundEnabled} onChange={saveSoundEnabled} />
            }
            first
          >
            <div className="pt-2 space-y-2">
              <div className="text-sm text-muted-foreground">Master Volume</div>
              <VolumeSlider
                value={masterVolume}
                onChange={saveMasterVolume}
                disabled={!appearance.soundEnabled}
              />
            </div>
          </Row>

          <Row
            icon={Palette}
            title="Appearance"
            open={openRow === "appearance"}
            onToggle={() => toggleRow("appearance")}
            preview={<Segmented value={appearance.theme} onChange={saveTheme} options={THEME_OPTIONS} />}
          >
            <div className="pt-2">
              <OptionGroup
                name="theme"
                value={appearance.theme}
                onChange={saveTheme}
                options={THEME_OPTIONS}
              />
            </div>
          </Row>

          <Row
            icon={ImageIcon}
            title="Background"
            open={openRow === "background"}
            onToggle={() => toggleRow("background")}
            preview={<span>{backgroundLabel(selection.kind)}</span>}
          >
            <div className="pt-2">
              <BackgroundSection />
            </div>
          </Row>
        </Group>

        {/* ---------------- Data Management / Advanced ---------------- */}
        <Group delay={0.06}>
          <Row
            icon={Database}
            title="Data Management"
            open={openRow === "data"}
            onToggle={() => toggleRow("data")}
            first
          >
            <div className="pt-2 flex flex-wrap gap-2">
              <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.96 }}>
                <Button
                  variant="outline"
                  onClick={exportData}
                  className="border-2 font-medium"
                >
                  <Download className="mr-2 h-4 w-4" /> Export JSON
                </Button>
              </motion.div>
              <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.96 }}>
                <Button
                  variant="outline"
                  asChild
                  className="border-2 font-medium"
                >
                  <label className="cursor-pointer">
                    <Upload className="mr-2 h-4 w-4" /> Import JSON
                    <input
                      type="file"
                      accept="application/json"
                      className="hidden"
                      onChange={(e) => importData(e.target.files?.[0] ?? null)}
                    />
                  </label>
                </Button>
              </motion.div>
            </div>
          </Row>

          <Row
            icon={SlidersHorizontal}
            title="Advanced"
            open={openRow === "advanced"}
            onToggle={() => toggleRow("advanced")}
          >
            <div className="pt-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-destructive/80 mb-2">
                Danger Zone
              </h3>
              <motion.div
                className="inline-block"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.96 }}
              >
                <Button variant="destructive" onClick={eraseAll}>
                  <Trash2 className="mr-2 h-4 w-4" /> Erase everything
                </Button>
              </motion.div>
            </div>
          </Row>
        </Group>

        {/* ---------------- About ---------------- */}
        <Group delay={0.09}>
          <Row
            icon={Info}
            title="About"
            open={openRow === "about"}
            onToggle={() => toggleRow("about")}
            first
          >
            <div className="pt-2 text-sm text-muted-foreground leading-relaxed">
              Local-first, offline-first. No accounts, no servers — everything
              stays on this device. Add to Home Screen from your browser's
              share menu for the full-screen app experience.
            </div>
          </Row>
        </Group>
      </main>
    </div>
  );
}
