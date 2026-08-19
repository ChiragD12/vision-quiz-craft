// Server-only. Do not import from client components/stores.
//
// Deliberately minimal: this app stores exactly two things remotely —
// (1) push subscriptions and (2) a spaced-revision due-date snapshot —
// each under a SINGLE Redis key as a JSON array. No per-record keys.
// Everything else the app knows about stays on-device and is never
// touched here. localStorage (src/lib/store.ts) remains the single
// source of truth; the revision snapshot below exists only so the
// server-side send-quiz cron endpoint has something to read.

import type { SyncedTopicRevision } from "./revision-sync";

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

function assertConfigured() {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) {
    throw new Error(
      "Upstash is not configured: UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN are missing.",
    );
  }
}

async function redisCommand<T = unknown>(command: (string | number)[]): Promise<T> {
  assertConfigured();
  const res = await fetch(UPSTASH_URL!, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${UPSTASH_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Upstash command failed (${res.status}): ${text}`);
  }
  const data = (await res.json()) as { result: T; error?: string };
  if (data.error) throw new Error(`Upstash error: ${data.error}`);
  return data.result;
}

async function getJsonArray<T>(key: string): Promise<T[]> {
  const raw = await redisCommand<string | null>(["GET", key]);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

async function setJsonArray<T>(key: string, value: T[]): Promise<void> {
  await redisCommand(["SET", key, JSON.stringify(value)]);
}

// ---------- Push subscriptions ----------
// Single key, JSON array of subscriptions. Keyed internally by `endpoint`.

const SUBSCRIPTIONS_KEY = "push:subscriptions";
const DEBUG = true;

export type StoredPushSubscription = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

export async function getAllSubscriptions(): Promise<StoredPushSubscription[]> {
  const subs = await getJsonArray<StoredPushSubscription>(SUBSCRIPTIONS_KEY);
  console.log("[upstash-subscriptions]", subs.length);
  return subs;
}

/** Upserts by endpoint — re-subscribing the same device never creates a duplicate entry. */
export async function saveSubscription(sub: StoredPushSubscription): Promise<void> {
  const all = await getAllSubscriptions();
  const next = [...all.filter((s) => s.endpoint !== sub.endpoint), sub];
  await setJsonArray(SUBSCRIPTIONS_KEY, next);
}

export async function removeSubscription(endpoint: string): Promise<void> {
  const all = await getAllSubscriptions();
  const next = all.filter((s) => s.endpoint !== endpoint);
  if (next.length !== all.length) {
    await setJsonArray(SUBSCRIPTIONS_KEY, next);
  }
}

export async function removeSubscriptions(endpoints: string[]): Promise<void> {
  if (endpoints.length === 0) return;
  const all = await getAllSubscriptions();
  const drop = new Set(endpoints);
  const next = all.filter((s) => !drop.has(s.endpoint));
  if (next.length !== all.length) {
    await setJsonArray(SUBSCRIPTIONS_KEY, next);
  }
}

// ---------- Spaced revision due-date snapshot ----------
// Single key, JSON array of { topic_id, next_due_date }. Overwritten
// wholesale on every sync (the client always sends its full current
// snapshot, not a delta), unlike the upsert-by-endpoint pattern above —
// there's no need to merge since the client is the only writer and always
// has the complete picture.

const REVISIONS_KEY = "revision:topic_revisions";

export async function getAllTopicRevisions(): Promise<SyncedTopicRevision[]> {
  return getJsonArray<SyncedTopicRevision>(REVISIONS_KEY);
}

export async function setTopicRevisionsSnapshot(
  revisions: SyncedTopicRevision[],
): Promise<void> {
  await setJsonArray(REVISIONS_KEY, revisions);
}

// ---------- Duplicate-send locks ----------
// SET key NX EX <ttl> — true means "you got the lock, go ahead and send";
// false means something already sent for this exact slot.
// Not used by anything in this phase (no scheduling/sending is implemented
// yet), but kept since it's generic, harmless, and a future manually- or
// cron-triggered send endpoint would reuse it as-is.

export async function acquireSendLock(key: string, ttlSeconds: number): Promise<boolean> {
  const result = await redisCommand<string | null>(["SET", key, "1", "NX", "EX", ttlSeconds]);
  return result === "OK";
}
