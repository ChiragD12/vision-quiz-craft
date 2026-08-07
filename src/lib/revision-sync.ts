// Client-only. Do not import from server-only modules.
//
// store.ts (localStorage) is the single source of truth for spaced
// revision — this file never reads Upstash back into the app, and nothing
// here changes how the schedule itself works. It only mirrors the minimum
// needed for the server to know which topics are due: whenever the local
// topic_revisions change, push a small snapshot (topic_id + next_due_date)
// to Upstash so the send-quiz cron endpoint has something to read, since
// it runs server-side and store.ts's load() returns an empty DB there
// (no localStorage on the server).
//
// Mirrors the Pregnancy App's medicine-reminder sync: same shape of
// "sync just the due-relevant fields on every local change" idea, just
// for topic_revisions instead of medicine reminders.

import { api, type TopicRevision } from "@/lib/store";

export type SyncedTopicRevision = {
  topic_id: string;
  next_due_date: string;
};

function toSyncedSnapshot(revisions: TopicRevision[]): SyncedTopicRevision[] {
  // Entries with no next_due_date have finished the whole schedule and can
  // never be "due" again, so there's nothing useful to sync for them.
  return revisions
    .filter((r): r is TopicRevision & { next_due_date: string } => !!r.next_due_date)
    .map((r) => ({ topic_id: r.topic_id, next_due_date: r.next_due_date }));
}

let pendingSync: number | undefined;

/**
 * Debounced (2s), best-effort sync — safe to call as often as you like.
 * Several rapid local writes (e.g. a burst of quiz completions) collapse
 * into a single request instead of one per write.
 */
export function scheduleRevisionSync(): void {
  if (typeof window === "undefined") return;
  if (pendingSync) window.clearTimeout(pendingSync);
  pendingSync = window.setTimeout(() => {
    pendingSync = undefined;
    void syncRevisionsNow();
  }, 2000);
}

/**
 * Sends the current snapshot right away. Any failure (offline, server
 * down, Upstash not configured, etc.) is swallowed — this must never
 * block or break the rest of the app, and the next successful sync (on
 * the next local change, or next app open) catches up automatically.
 */
export async function syncRevisionsNow(): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const revisions = toSyncedSnapshot(api.allTopicRevisions());
    await fetch("/api/sync-revisions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ revisions }),
    });
  } catch (err) {
    console.error("syncRevisionsNow failed", err);
  }
}
