import { createFileRoute } from "@tanstack/react-router";

import { sendToAllSubscriptions } from "@/lib/push.server";
import { getAllTopicRevisions } from "@/lib/upstash.server";

// Set in the environment (e.g. Vercel project settings) and passed by the
// external scheduler (cron-job.org) as `Authorization: Bearer <CRON_SECRET>`.
// Same pattern as the Pregnancy App's send-water.ts / send-medicine.ts.
const CRON_SECRET = process.env.CRON_SECRET;

function isAuthorized(request: Request): boolean {
  if (!CRON_SECRET) return false;
  return request.headers.get("Authorization") === `Bearer ${CRON_SECRET}`;
}

// The synced next_due_date values are "YYYY-MM-DD" strings computed
// client-side from each device's local calendar day (see todayKey() in
// src/domain/streak.ts, used by store.ts). The server has no device
// timezone to match against, so this assumes users are on IST
// (Asia/Kolkata) — adjust here if that's ever not the case.
function todayKeyServer(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
}

export const Route = createFileRoute("/api/send-quiz")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!isAuthorized(request)) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Reads the Upstash snapshot synced by src/lib/revision-sync.ts
        // (client) instead of src/lib/store.ts, since store.ts's load()
        // returns an empty DB when run on the server (no localStorage
        // there). localStorage is still the real source of truth on-device
        // — this snapshot exists only so this endpoint has something to
        // read.
        const snapshot = await getAllTopicRevisions();
        const today = todayKeyServer();
        const due = snapshot.filter((r) => r.next_due_date && r.next_due_date <= today).length;

        if (due === 0) {
          return Response.json({ ok: true, sent: false, due: 0, checked: snapshot.length });
        }

        const result = await sendToAllSubscriptions({
          title: "📚 Time to Study",
          body: `You have ${due} revision quizzes due today.`,
          tag: "quiz-revision-due",
          url: "/",
        }); console.log("[send-result]", result);

        return Response.json({ ok: true, due, checked: snapshot.length, ...result });
      },
    },
  },
});
