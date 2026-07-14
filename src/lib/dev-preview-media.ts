// Developer Preview media helper.
//
// This module is COMPLETELY ISOLATED from the production reward/unlock
// system. It exists purely to support the Developer Preview testing mode
// inside Secret Gallery:
//
//   - Never preloads the gallery. Callers only ever get lightweight
//     metadata (a key, a label, and the source URL to fetch *if and when*
//     the user interacts with that specific item) until they explicitly
//     request a preview or a download.
//   - Preview fetches exactly one item, shows it, and never writes it to
//     any persistent cache. The object URL is revoked as soon as the
//     preview is dismissed.
//   - Download fetches exactly one item and stores it in a dedicated
//     IndexedDB database (separate from both the reward system and the
//     user-media store) so it is never re-downloaded. If that same reward
//     is later unlocked normally through quiz progression, callers can use
//     getDevCachedMediaUrl() to reuse the cached copy instead of fetching
//     again.
//
// Nothing in here reads or writes reward/unlock state, quiz state, or
// parser/Gemini state. gallery.tsx is the only caller.

const DB_NAME = "upsc_dev_preview_cache";
const STORE = "media";
const VERSION = 1;

export type DevPreviewKind = "image" | "video";

/** Stable identifier for a single reward's media, e.g. "image:5-stars:12". */
export type DevPreviewMediaKey = string;

/** Lightweight metadata only — no bytes, no blob, no fetch yet. */
export type DevPreviewMediaMeta = {
  key: DevPreviewMediaKey;
  kind: DevPreviewKind;
  /** Display label (derived filename) for the tile / download. */
  label: string;
  /** Where to fetch the full media from, only once the user acts. */
  sourceUrl: string;
};

export function buildDevPreviewKey(
  kind: DevPreviewKind,
  group: string,
  index: number,
): DevPreviewMediaKey {
  return `${kind}:${group}:${index}`;
}

export function labelFromUrl(url: string, fallback: string): string {
  const last = url.split("/").pop();
  return last && last.length > 0 ? last : fallback;
}

// ---------------- IndexedDB (download cache only) ----------------

type CachedRecord = {
  key: string;
  blob: Blob;
  mime: string;
  cached_at: number;
};

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "key" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getCachedRecord(key: string): Promise<CachedRecord | null> {
  try {
    const db = await openDB();
    const rec = await new Promise<CachedRecord | null>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(key);
      req.onsuccess = () => resolve((req.result as CachedRecord) ?? null);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return rec;
  } catch {
    return null;
  }
}

async function putCachedRecord(rec: CachedRecord): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(rec);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

// ---------------- Object URL bookkeeping ----------------
// Preview URLs are ephemeral and are revoked as soon as the preview closes.
// Downloaded URLs are backed by the persistent IndexedDB cache above and
// may be reused for the lifetime of the page.

const previewUrlCache = new Map<DevPreviewMediaKey, string>();
const downloadedUrlCache = new Map<DevPreviewMediaKey, string>();

/**
 * Fetch exactly the requested item for temporary display. Never persisted.
 * If the item happens to already be in the permanent download cache, that
 * copy is reused instead of hitting the network a second time — but a
 * fresh preview-only fetch still never *creates* a permanent cache entry.
 */
export async function previewDevMedia(
  meta: DevPreviewMediaMeta,
): Promise<string> {
  const alreadyDownloaded = downloadedUrlCache.get(meta.key);
  if (alreadyDownloaded) return alreadyDownloaded;

  const cachedRecord = await getCachedRecord(meta.key);
  if (cachedRecord) {
    const url = URL.createObjectURL(cachedRecord.blob);
    downloadedUrlCache.set(meta.key, url);
    return url;
  }

  const res = await fetch(meta.sourceUrl);
  if (!res.ok) throw new Error(`Preview fetch failed: ${res.status}`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  previewUrlCache.set(meta.key, url);
  return url;
}

/** Revoke a preview's object URL once dismissed. Safe to call any time. */
export function releaseDevPreview(key: DevPreviewMediaKey): void {
  const url = previewUrlCache.get(key);
  if (!url) return;
  try {
    URL.revokeObjectURL(url);
  } catch {
    // ignore
  }
  previewUrlCache.delete(key);
}

/**
 * Download exactly the requested item and cache it permanently so it is
 * never re-downloaded. Returns a usable object URL.
 */
export async function downloadDevMedia(
  meta: DevPreviewMediaMeta,
): Promise<string> {
  const existingUrl = downloadedUrlCache.get(meta.key);
  if (existingUrl) return existingUrl;

  const existingRecord = await getCachedRecord(meta.key);
  if (existingRecord) {
    const url = URL.createObjectURL(existingRecord.blob);
    downloadedUrlCache.set(meta.key, url);
    return url;
  }

  const res = await fetch(meta.sourceUrl);
  if (!res.ok) throw new Error(`Download fetch failed: ${res.status}`);
  const blob = await res.blob();
  await putCachedRecord({
    key: meta.key,
    blob,
    mime: blob.type,
    cached_at: Date.now(),
  });

  const url = URL.createObjectURL(blob);
  downloadedUrlCache.set(meta.key, url);
  return url;
}

/** Downloads (caching) the item and triggers a browser file-save prompt. */
export async function saveDevMediaToDisk(
  meta: DevPreviewMediaMeta,
): Promise<void> {
  const url = await downloadDevMedia(meta);
  const a = document.createElement("a");
  a.href = url;
  a.download = meta.label;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/**
 * Look up whether this reward's media has already been downloaded/cached
 * via Developer Preview. Used so that if the reward is later unlocked
 * normally through quiz progression, the app can reuse the cached copy
 * instead of re-fetching it. Read-only — never touches unlock state.
 */
export async function getDevCachedMediaUrl(
  key: DevPreviewMediaKey,
): Promise<string | null> {
  const inMemory = downloadedUrlCache.get(key);
  if (inMemory) return inMemory;
  const rec = await getCachedRecord(key);
  if (!rec) return null;
  const url = URL.createObjectURL(rec.blob);
  downloadedUrlCache.set(key, url);
  return url;
}
