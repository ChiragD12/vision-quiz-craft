// User-selectable app background.
//
// Single source of truth for the global app background. The user picks ONE of:
//   - "default":  the shipped "/background.png"
//   - "journey":  an unlocked Journey story image (by story id)
//   - "custom":   a locally-uploaded image (Blob in IndexedDB)
//
// Selection is persistent across restarts. Unlocking new Journey images
// never auto-switches the selection — it only expands the set of choices.

import { useEffect, useState } from "react";

export type BackgroundKind = "default" | "journey" | "custom";

export interface BackgroundSelection {
  kind: BackgroundKind;
  /** 1-based story id when kind === "journey". */
  journeyId?: number;
}

/** Per-route map of background selections, stored under a single key. */
export interface BackgroundSelections {
  routes: Record<string, BackgroundSelection>;
}

const SELECTION_KEY = "upsc_app_background_v1";
const CHANGE_EVENT = "upsc-app-background-change";

const DEFAULT_SRC = "/background.png";

// ---------- IndexedDB for the custom image ----------

const DB_NAME = "upsc_app_background";
const STORE = "custom";
const VERSION = 1;
const CUSTOM_ID = "current";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbPutCustom(blob: Blob, mime: string): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put({ id: CUSTOM_ID, blob, mime, updated_at: Date.now() });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function idbGetCustom(): Promise<Blob | null> {
  const db = await openDB();
  const rec = await new Promise<{ blob: Blob } | undefined>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(CUSTOM_ID);
    req.onsuccess = () => resolve(req.result as { blob: Blob } | undefined);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return rec?.blob ?? null;
}

async function idbDeleteCustom(): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(CUSTOM_ID);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

// ---------- Selection persistence ----------

function readAllSelections(): BackgroundSelections {
  if (typeof window === "undefined") return { routes: {} };
  try {
    const raw = localStorage.getItem(SELECTION_KEY);
    if (!raw) return { routes: {} };
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && parsed.routes && typeof parsed.routes === "object") {
      return parsed as BackgroundSelections;
    }
  } catch {
    // fall through
  }
  return { routes: {} };
}

export function getBackgroundSelection(route: string): BackgroundSelection {
  const all = readAllSelections();
  const sel = all.routes[route];

  console.log("Reading wallpaper:", route, sel);

  if (
    sel &&
    (sel.kind === "default" ||
      sel.kind === "journey" ||
      sel.kind === "custom")
  ) {
    return sel;
  }

  return { kind: "default" };
}

function writeSelection(route: string, sel: BackgroundSelection) {
  if (typeof window === "undefined") return;

  const all = readAllSelections();
  const next: BackgroundSelections = {
    routes: {
      ...all.routes,
      [route]: sel,
    },
  };

  console.log("Writing wallpaper:", route, next);

  try {
    localStorage.setItem(SELECTION_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }

  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: { route, sel } }));
}

export function selectDefaultBackground(route: string) {
  writeSelection(route, { kind: "default" });
}

export function selectJourneyBackground(route: string, journeyId: number) {
  writeSelection(route, { kind: "journey", journeyId });
}

export async function selectCustomBackground(route: string, file: File | Blob): Promise<void> {
  const mime = (file as File).type || "image/png";
  await idbPutCustom(file, mime);
  writeSelection(route, { kind: "custom" });
}

export async function clearCustomBackground(route: string): Promise<void> {
  await idbDeleteCustom();
  const cur = getBackgroundSelection(route);
  if (cur.kind === "custom") writeSelection(route, { kind: "default" });
}

// ---------- URL resolution ----------

// Cache last object URL so we can revoke it when the custom image changes.
let cachedCustomUrl: string | null = null;

async function resolveCustomUrl(): Promise<string | null> {
  const blob = await idbGetCustom();
  if (!blob) return null;
  if (cachedCustomUrl) {
    try {
      URL.revokeObjectURL(cachedCustomUrl);
    } catch {
      // ignore
    }
  }
  cachedCustomUrl = URL.createObjectURL(blob);
  return cachedCustomUrl;
}

/**
 * Resolve the current background to a URL. `journeyResolver` should map a
 * story id to its image URL (we don't import journey/assets here to avoid
 * a circular dep — callers pass `storyImageUrl`).
 */
export async function resolveBackgroundUrl(
  selection: BackgroundSelection,
  journeyResolver: (id: number) => string,
): Promise<string> {

  console.log("Resolving:", selection);

  if (selection.kind === "journey" && selection.journeyId != null) {
    const url = journeyResolver(selection.journeyId);
    console.log("Journey URL:", url);
    return url;
  }

  if (selection.kind === "custom") {
    const url = await resolveCustomUrl();
    console.log("Custom URL:", url);
    if (url) return url;
  }

  console.log("Default URL:", DEFAULT_SRC);
  return DEFAULT_SRC;
}

// ---------- React hooks ----------

function subscribe(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onChange = () => cb();
  const onStorage = (e: StorageEvent) => {
    if (e.key === SELECTION_KEY) cb();
  };
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

export function useBackgroundSelection(route: string): BackgroundSelection {
  const [sel, setSel] = useState<BackgroundSelection>(() => getBackgroundSelection(route));
  useEffect(() => subscribe(() => setSel(getBackgroundSelection(route))), [route]);
  return sel;
}

/**
 * Resolves the current background to a URL and re-resolves when the
 * selection changes (or when a custom image is replaced).
 */
export function useBackgroundUrl(
  route: string,
  journeyResolver: (id: number) => string,
): string {
  const selection = useBackgroundSelection(route);
  const [url, setUrl] = useState<string>(DEFAULT_SRC);

  useEffect(() => {
    let cancelled = false;
    resolveBackgroundUrl(selection, journeyResolver).then((u) => {
  if (!cancelled) setUrl(u);
});
    return () => {
      cancelled = true;
    };
  }, [selection, journeyResolver]);

  return url;
}

export const DEFAULT_BACKGROUND_SRC = DEFAULT_SRC;
