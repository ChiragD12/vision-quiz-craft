// Server-only. Do not import from client components/stores.
import webpush from "web-push";

import {
  getAllSubscriptions,
  removeSubscriptions,
  type StoredPushSubscription,
} from "./upstash.server";

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
// Not in the required env list — falls back to a generic contact if unset.
// Set VAPID_SUBJECT in Vercel if you want push services to see a real contact.
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:notifications@example.com";

let configured = false;
function ensureConfigured() {
  if (configured) return;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    throw new Error("VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY are not configured.");
  }
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  configured = true;
}

export type PushPayload = {
  title: string;
  body: string;
  /** Stable per-slot tag — lets the OS collapse/replace instead of stacking duplicates. */
  tag: string;
  url?: string;
};

/**
 * Sends `payload` to every stored subscription. Any subscription the push
 * service reports as gone (404/410 — how Apple Web Push reports an
 * unsubscribed/uninstalled endpoint) is removed from Upstash automatically.
 */
export async function sendToAllSubscriptions(payload: PushPayload) {
  ensureConfigured();
  const subs = await getAllSubscriptions();
  if (subs.length === 0) return { total: 0, sent: 0, failed: 0 };

  const dead: string[] = [];
  const results = await Promise.allSettled(
    subs.map((sub) => sendToSubscription(sub, payload, dead)),
  );

  if (dead.length > 0) await removeSubscriptions(dead);

  const sent = results.filter((r) => r.status === "fulfilled").length;
  return { total: subs.length, sent, failed: subs.length - sent };
}

async function sendToSubscription(
  sub: StoredPushSubscription,
  payload: PushPayload,
  deadEndpointsOut: string[],
): Promise<void> {
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: sub.keys } as webpush.PushSubscription,
      JSON.stringify({ ...payload, icon: "/apple-touch-icon.png", badge: "/apple-touch-icon.png" }),
    );
  } catch (err: unknown) {
    const statusCode = (err as { statusCode?: number })?.statusCode;
    if (statusCode === 404 || statusCode === 410) {
      deadEndpointsOut.push(sub.endpoint);
      return;
    }
    throw err;
  }
}
