import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { saveSubscription } from "@/lib/upstash.server";

// Client posts here once per app session from ensurePushSubscription()
// (see src/lib/push-client.ts) right after the browser grants Notification
// permission and the service worker's PushManager produces a subscription.
// This is the missing link that let the rest of the pipeline exist without
// ever actually having a subscription to send to: without this route,
// push-client.ts's POST to /api/subscribe 404s silently (its own fetch is
// wrapped in try/catch), so nothing ever reached Upstash and send-quiz.ts
// always had zero subscriptions to notify.
const subscribeSchema = z.object({
  endpoint: z.string(),
  keys: z.object({
    p256dh: z.string(),
    auth: z.string(),
  }),
  // Present on PushSubscriptionJSON but unused here — Upstash only ever
  // needs endpoint + keys to send a notification later.
  expirationTime: z.number().nullable().optional(),
});

export const Route = createFileRoute("/api/subscribe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await request.json().catch(() => null);
        const parsed = subscribeSchema.safeParse(body);
        if (!parsed.success) {
          return Response.json({ error: "Invalid subscription payload" }, { status: 400 });
        }

        await saveSubscription({
          endpoint: parsed.data.endpoint,
          keys: parsed.data.keys,
        });

        return Response.json({ ok: true });
      },
    },
  },
});
