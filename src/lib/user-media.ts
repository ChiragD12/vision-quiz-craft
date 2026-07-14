// Local-first user media store backed by IndexedDB.
//
// Stores user-added images/videos (and AI-generated images) as Blobs so
// large files don't bloat localStorage. Everything stays on the device.

export type UserMediaTier = "3-stars" | "4-stars" | "5-stars" | "videos";

export type UserMedia = {
  id: string;
  tier: UserMediaTier;
  type: "image" | "video";
  blob: Blob;
  mime: string;
  created_at: number;
  source: "upload" | "generated";
  prompt?: string;
  provider?: string;
};

const DB_NAME = "upsc_user_media";
const STORE = "media";
const VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const os = db.createObjectStore(STORE, { keyPath: "id" });
        os.createIndex("tier", "tier", { unique: false });
        os.createIndex("created_at", "created_at", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function uid() {
  return "um_" + crypto.randomUUID();
}

function emit() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("upsc-user-media-change"));
  }
}

export async function addUserMedia(input: {
  tier: UserMediaTier;
  type: "image" | "video";
  blob: Blob;
  mime: string;
  source?: "upload" | "generated";
  prompt?: string;
  provider?: string;
}): Promise<UserMedia> {
  const rec: UserMedia = {
    id: uid(),
    tier: input.tier,
    type: input.type,
    blob: input.blob,
    mime: input.mime,
    created_at: Date.now(),
    source: input.source ?? "upload",
    prompt: input.prompt,
    provider: input.provider,
  };
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(rec);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
  emit();
  return rec;
}

export async function deleteUserMedia(id: string): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
  emit();
}

export async function listUserMedia(): Promise<UserMedia[]> {
  const db = await openDB();
  const items = await new Promise<UserMedia[]>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve((req.result as UserMedia[]) ?? []);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return items.sort((a, b) => b.created_at - a.created_at);
}

// ---------- URL cache ----------
// Blob URLs must be revoked to prevent memory leaks. We keep a per-id
// cache and refresh it whenever the underlying list changes.
export type UserMediaWithUrl = UserMedia & { url: string };

export function toObjectUrl(m: UserMedia): string {
  return URL.createObjectURL(m.blob);
}

export function revokeAll(items: UserMediaWithUrl[]) {
  for (const it of items) {
    try {
      URL.revokeObjectURL(it.url);
    } catch {
      // ignore
    }
  }
}