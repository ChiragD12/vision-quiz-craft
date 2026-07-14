// Unified local store for user-generated AI content (images + videos).
// Separate from `user-media` so the Secret Gallery reward flow is unaffected.
// Records live in IndexedDB; favorites/order/preferences are derived from records.

export type GenerationKind = "image" | "video";

export type Generation = {
  id: string;
  kind: GenerationKind;
  blob: Blob;
  mime: string;
  prompt?: string;
  provider?: string;
  model?: string;
  favorite: boolean;
  created_at: number;
  thumbnail?: Blob; // for videos
  // For image→video: track the source image if it came from a prior generation.
  source_id?: string;
};

const DB_NAME = "upsc_generations";
const STORE = "gens";
const VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const os = db.createObjectStore(STORE, { keyPath: "id" });
        os.createIndex("created_at", "created_at", { unique: false });
        os.createIndex("favorite", "favorite", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function emit() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("upsc-generations-change"));
  }
}

function uid() {
  return "gen_" + crypto.randomUUID();
}

export async function addGeneration(input: {
  kind: GenerationKind;
  blob: Blob;
  mime: string;
  prompt?: string;
  provider?: string;
  model?: string;
  thumbnail?: Blob;
  source_id?: string;
}): Promise<Generation> {
  const rec: Generation = {
    id: uid(),
    kind: input.kind,
    blob: input.blob,
    mime: input.mime,
    prompt: input.prompt,
    provider: input.provider,
    model: input.model,
    favorite: false,
    created_at: Date.now(),
    thumbnail: input.thumbnail,
    source_id: input.source_id,
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

export async function listGenerations(): Promise<Generation[]> {
  const db = await openDB();
  const items = await new Promise<Generation[]>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve((req.result as Generation[]) ?? []);
    req.onerror = () => reject(req.error);
  });
  db.close();
  // Favorites first, then newest first.
  return items.sort((a, b) => {
    if (a.favorite !== b.favorite) return a.favorite ? -1 : 1;
    return b.created_at - a.created_at;
  });
}

export async function getGeneration(id: string): Promise<Generation | null> {
  const db = await openDB();
  const item = await new Promise<Generation | null>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(id);
    req.onsuccess = () => resolve((req.result as Generation) ?? null);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return item;
}

export async function toggleFavorite(id: string): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const os = tx.objectStore(STORE);
    const g = os.get(id);
    g.onsuccess = () => {
      const rec = g.result as Generation | undefined;
      if (rec) {
        rec.favorite = !rec.favorite;
        os.put(rec);
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
  emit();
}

export async function deleteGeneration(id: string): Promise<void> {
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

// Generate a jpeg thumbnail from a video blob (best-effort, non-fatal).
export async function makeVideoThumbnail(videoBlob: Blob): Promise<Blob | undefined> {
  if (typeof document === "undefined") return undefined;
  return new Promise<Blob | undefined>((resolve) => {
    try {
      const url = URL.createObjectURL(videoBlob);
      const v = document.createElement("video");
      v.preload = "metadata";
      v.muted = true;
      v.playsInline = true;
      v.src = url;
      const cleanup = () => URL.revokeObjectURL(url);
      v.onloadeddata = () => {
        try {
          v.currentTime = Math.min(0.1, (v.duration || 1) / 4);
        } catch {
          resolve(undefined);
          cleanup();
        }
      };
      v.onseeked = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = v.videoWidth || 640;
          canvas.height = v.videoHeight || 360;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            resolve(undefined);
            cleanup();
            return;
          }
          ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
          canvas.toBlob(
            (b) => {
              cleanup();
              resolve(b ?? undefined);
            },
            "image/jpeg",
            0.75,
          );
        } catch {
          cleanup();
          resolve(undefined);
        }
      };
      v.onerror = () => {
        cleanup();
        resolve(undefined);
      };
    } catch {
      resolve(undefined);
    }
  });
}
