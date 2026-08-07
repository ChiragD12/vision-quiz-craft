import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { removeSubscription } from "@/lib/upstash.server";

const unsubscribeSchema = z.object({
  endpoint: z.string().url(),
});

export const Route = createFileRoute("/api/unsubscribe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await request.json().catch(() => null);
        const parsed = unsubscribeSchema.safeParse(body);
        if (!parsed.success) {
          return Response.json({ error: "Invalid payload" }, { status: 400 });
        }
        await removeSubscription(parsed.data.endpoint);
        return Response.json({ ok: true });
      },
    },
  },
});
