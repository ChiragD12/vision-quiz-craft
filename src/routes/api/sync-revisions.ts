import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { setTopicRevisionsSnapshot } from "@/lib/upstash.server";

const syncSchema = z.object({
  revisions: z.array(
    z.object({
      topic_id: z.string(),
      next_due_date: z.string(),
    }),
  ),
});

export const Route = createFileRoute("/api/sync-revisions")({
  server: {
    handlers: {
      // Only the minimal due-date snapshot (topic_id + next_due_date) is
      // uploaded — no quiz content, notes, subjects, streaks, or full
      // revision history ever leaves the device. This is a notification
      // snapshot only, always overwritten wholesale from the client's
      // current local state; it is never read back into the app.
      POST: async ({ request }) => {
        const body = await request.json().catch(() => null);
        const parsed = syncSchema.safeParse(body);
        if (!parsed.success) {
          return Response.json({ error: "Invalid payload" }, { status: 400 });
        }
        await setTopicRevisionsSnapshot(parsed.data.revisions);
        return Response.json({ ok: true });
      },
    },
  },
});
