import { useEffect, useState } from "react";

// ---------------- Appearance / Preferences system ----------------
//
// Single source of truth for every visual preference in the app (theme
// today; accent color, AMOLED, high contrast, animation speed, reduce
// motion, glass intensity, border radius, background style, wallpaper,
// font size, font family, etc. later).
//
// Design:
// - One JSON object in localStorage holds all preferences, so adding a
//   new one never means adding a new storage key or a new init call.
// - Each preference has exactly one "applicator": a small function that
//   mutates the DOM (an attribute or an inline CSS custom property) to
//   reflect its current value. styles.css stays the single source of
//   truth for what each value *looks like*; this file only decides
//   *which* value is currently active.
// - initAppearance() applies the saved preferences and is idempotent, so
//   it's safe to call both at module load (before first paint) and again
//   in a mount-time effect (hydration safety net).
// - setAppearance() persists + applies + notifies other mounted
//   consumers in the same tab (e.g. Settings page and root layout).
// - useAppearance() is the React entry point every component should use.
//
// To add a future preference:
//   1. Add the field to AppearancePreferences (and DEFAULT_APPEARANCE).
//   2. Add one applicator function to APPLICATORS.
//   3. Add the CSS that responds to the attribute/variable it sets.
//   4. Build its UI with useAppearance() + setAppearance({ ... }) — no
//      other part of this file changes.

export type ThemeMode = "dark" | "light";

export interface AppearancePreferences {
  theme: ThemeMode;
  soundEnabled: boolean;
  // Reserved for future preferences — each just needs a field here and a
  // matching applicator below:
  // accentColor?: string;
  // amoled?: boolean;
  // highContrast?: boolean;
  // animationSpeed?: "slow" | "normal" | "fast";
  // reduceMotion?: boolean;
  // glassIntensity?: number;
  // borderRadius?: "sharp" | "soft" | "round";
  // backgroundStyle?: "gradient" | "solid" | "wallpaper";
  // wallpaper?: string;
  // fontSize?: "sm" | "md" | "lg";
  // fontFamily?: "sans" | "display";
}

export const DEFAULT_APPEARANCE: AppearancePreferences = {
  theme: "dark",
  soundEnabled: true,
};

const STORAGE_KEY = "upsc_appearance_v1";
const CHANGE_EVENT = "upsc-appearance-change";

// ---------------- persistence ----------------

function readStoredPreferences(): Partial<AppearancePreferences> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeStoredPreferences(prefs: AppearancePreferences) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Quota exceeded / private mode — preference just won't persist.
  }
}

export function getAppearance(): AppearancePreferences {
  return { ...DEFAULT_APPEARANCE, ...readStoredPreferences() };
}

// ---------------- themed asset resolution ----------------
//
// Every wallpaper/background asset in the app is authored under its
// "dark" filename — either bare (e.g. "/background.png", from before
// light mode existed) or explicitly suffixed (e.g. "/history-dark.webp").
// This is the one place that knows how to derive the light counterpart
// from that name, so FixedBackground (or any future background-picking
// component) can resolve the right asset for the active theme without
// any page ever branching on theme itself:
//   • "/background.png"      -> "/background-light.png"
//   • "/history-dark.webp"   -> "/history-light.webp"
// Dark theme always returns the src unchanged.
export function resolveThemedAsset(
  src: string,
  theme: ThemeMode = getAppearance().theme,
): string {
  if (theme !== "light") return src;
  const dot = src.lastIndexOf(".");
  const base = dot === -1 ? src : src.slice(0, dot);
  const ext = dot === -1 ? "" : src.slice(dot);
  const trimmed = base.endsWith("-dark") ? base.slice(0, -"-dark".length) : base;
  return `${trimmed}-light${ext}`;
}

// ---------------- DOM application ----------------

type Applicator<K extends keyof AppearancePreferences> = (
  value: AppearancePreferences[K],
  root: HTMLElement,
) => void;

// One entry per preference. This is the only place in the app that writes
// theme-related attributes/inline styles to the DOM.
const APPLICATORS: { [K in keyof AppearancePreferences]-?: Applicator<K> } = {
  theme: (value, root) => {
    if (value === "light") {
      root.setAttribute("data-theme", "light");
    } else {
      root.removeAttribute("data-theme");
    }
    // Keep native browser UI (scrollbars, form controls, autofill, etc.)
    // in sync immediately, without waiting on the CSS cascade.
    root.style.colorScheme = value;
  },
  // Sound has no DOM/visual representation to apply — sound-manager.ts
  // reads the value directly via getAppearance() at play time instead.
  // Still needs an entry here so every key in AppearancePreferences has
  // one, per the APPLICATORS type.
  soundEnabled: () => {},
};

export function applyAppearance(prefs: AppearancePreferences) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  (Object.keys(APPLICATORS) as (keyof AppearancePreferences)[]).forEach((key) => {
    const applicator = APPLICATORS[key] as Applicator<typeof key>;
    applicator(prefs[key], root);
  });
}

// Reads the saved preferences and applies them in one step. Idempotent —
// safe to call multiple times (module load + mount-time safety net).
export function initAppearance(): AppearancePreferences {
  const prefs = getAppearance();
  applyAppearance(prefs);
  return prefs;
}

// Persists a partial update, applies it immediately (no refresh needed),
// and notifies any other mounted consumers in this tab.
export function setAppearance(
  patch: Partial<AppearancePreferences>,
): AppearancePreferences {
  const next = { ...getAppearance(), ...patch };
  writeStoredPreferences(next);
  applyAppearance(next);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: next }));
  }
  return next;
}

// Runs the instant this module is evaluated on the client — before
// RootComponent (or any route) ever renders — so the saved theme (and any
// future preference) is restored with no flash of the wrong appearance,
// regardless of which page the app boots into.
if (typeof document !== "undefined") {
  initAppearance();
}

// ---------------- cross-consumer sync ----------------

function subscribeAppearance(
  callback: (prefs: AppearancePreferences) => void,
): () => void {
  if (typeof window === "undefined") return () => {};
  const onChange = (e: Event) => {
    callback((e as CustomEvent<AppearancePreferences>).detail ?? getAppearance());
  };
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) callback(getAppearance());
  };
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

// ---------------- React entry point ----------------

export function useAppearance(): [
  AppearancePreferences,
  (patch: Partial<AppearancePreferences>) => void,
] {
  const [prefs, setPrefs] = useState<AppearancePreferences>(() => getAppearance());

  useEffect(() => subscribeAppearance(setPrefs), []);

  const update = (patch: Partial<AppearancePreferences>) => {
    setPrefs(setAppearance(patch));
  };

  return [prefs, update];
}
