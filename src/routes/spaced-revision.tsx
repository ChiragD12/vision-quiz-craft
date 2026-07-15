import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppBackground } from "@/components/app-background";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarClock, Clock, CheckCircle2, History as HistoryIcon } from "lucide-react";
import {
  api,
  REVISION_SCHEDULE_DAYS,
  type Topic,
  type Subject,
  type TopicRevision,
} from "@/lib/store";
import { todayKey } from "@/domain/streak";

export const Route = createFileRoute("/spaced-revision")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Spaced Revision — UPSC Revision" },
      { name: "description", content: "Revisit what you've learned at the right moment." },
    ],
  }),
  component: SpacedRevisionPage,
});

type Enriched = {
  revision: TopicRevision;
  topic: Topic;
  subject: Subject | undefined;
};

function stageLabel(stage: number): string {
  if (stage < REVISION_SCHEDULE_DAYS.length) return `Day ${REVISION_SCHEDULE_DAYS[stage]}`;
  return "Schedule complete";
}

// Local-date-safe relative label for the History section. dateKey and
// todayKey are both "YYYY-MM-DD" strings produced by todayKey(), so parsing
// them as local (not UTC) dates avoids off-by-one errors near midnight.
function relativeDateLabel(timestamp: number): string {
  const day = todayKey(new Date(timestamp));
  const today = todayKey();
  if (day === today) return "Today";
  const [ty, tm, td] = today.split("-").map(Number);
  const [dy, dm, dd] = day.split("-").map(Number);
  const todayDate = new Date(ty, tm - 1, td);
  const thatDate = new Date(dy, dm - 1, dd);
  const diffDays = Math.round((todayDate.getTime() - thatDate.getTime()) / 86400000);
  if (diffDays === 1) return "Yesterday";
  if (diffDays > 1) return `${diffDays} days ago`;
  return new Date(timestamp).toLocaleDateString();
}

function SpacedRevisionPage() {
  const navigate = useNavigate();
  const today = todayKey();

  const enriched: Enriched[] = api
    .allTopicRevisions()
    .map((revision) => {
      const topic = api.getTopic(revision.topic_id);
      if (!topic) return null;
      return { revision, topic, subject: api.getSubject(topic.subject_id) };
    })
    .filter((e): e is Enriched => e !== null);

  const dueToday = enriched
    .filter((e) => e.revision.next_due_date && e.revision.next_due_date <= today)
    .sort((a, b) => {
      const dateCompare = (a.revision.next_due_date ?? "").localeCompare(
        b.revision.next_due_date ?? "",
      );
      if (dateCompare !== 0) return dateCompare;
      return a.topic.name.localeCompare(b.topic.name);
    });

  const completedToday = enriched
    .filter((e) => e.revision.last_revised_date === today)
    .sort((a, b) => (b.revision.last_revised_at ?? 0) - (a.revision.last_revised_at ?? 0));

  const upcoming = enriched.filter(
    (e) => e.revision.next_due_date && e.revision.next_due_date > today,
  );
  const upcomingByDate = new Map<string, Enriched[]>();
  for (const e of upcoming) {
    const key = e.revision.next_due_date!;
    const list = upcomingByDate.get(key) ?? [];
    list.push(e);
    upcomingByDate.set(key, list);
  }
  const upcomingDates = Array.from(upcomingByDate.keys()).sort();

  type HistoryEntry = {
    topic: Topic;
    subject: Subject | undefined;
    stage: number;
    completed_at: number;
  };
  const historyEntries: HistoryEntry[] = enriched
    .flatMap((e) =>
      e.revision.history.map((h) => ({
        topic: e.topic,
        subject: e.subject,
        stage: h.stage,
        completed_at: h.completed_at,
      })),
    )
    .sort((a, b) => b.completed_at - a.completed_at)
    .slice(0, 30);

  // Review: launches the existing quiz generation flow (/new), pre-filled
  // to this topic's subject/topic so only that topic's notes are used.
  // No second quiz engine — this reuses the Classic generation flow as-is,
  // just stamping the resulting quiz with revisionReview so completing it
  // (and only it) advances this topic's revision schedule.
  const startReview = (topic: Topic) => {
    navigate({
      to: "/new",
      search: { subjectId: topic.subject_id, topicId: topic.id, revisionReview: true },
    });
  };

  return (
    <div className="relative min-h-dvh overflow-x-hidden">
      <AppBackground />
      <div className="mx-auto max-w-4xl px-5 pt-20 pb-16 space-y-6">
        <header className="page-header-card">
          <h1 className="font-display text-3xl font-semibold tracking-tight">Spaced Revision</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Revisit what you've learned at the right moment.
          </p>
          {dueToday.length > 0 && (
            <p className="text-sm font-semibold text-primary mt-3">
              {dueToday.length} {dueToday.length === 1 ? "Topic" : "Topics"} Due Today
            </p>
          )}
        </header>

        <Section icon={<CalendarClock className="h-4 w-4 text-primary" />} title="Due Today">
          {dueToday.length === 0 ? (
            <Placeholder body="Nothing due today. Finish a topic quiz to start its revision schedule." />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {dueToday.map((e) => {
                const isOverdue = (e.revision.next_due_date ?? "") < today;
                return (
                  <Card
                    key={e.topic.id}
                    className={
                      isOverdue
                        ? "p-5 shadow-sm border-destructive/40 bg-destructive/10"
                        : "p-5 shadow-sm"
                    }
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-semibold">{e.topic.name}</div>
                      {isOverdue && (
                        <span className="shrink-0 text-[10px] uppercase tracking-[0.14em] font-semibold text-destructive">
                          Overdue
                        </span>
                      )}
                    </div>
                    {e.subject && (
                      <div className="text-xs text-muted-foreground mt-0.5">{e.subject.name}</div>
                    )}
                    <div className="mt-2 text-[10px] uppercase tracking-[0.18em] text-primary/70">
                      {stageLabel(e.revision.stage)}
                    </div>
                    <Button size="sm" className="mt-3 w-full" onClick={() => startReview(e.topic)}>
                      Review
                    </Button>
                  </Card>
                );
              })}
            </div>
          )}
        </Section>

        <Section icon={<Clock className="h-4 w-4 text-primary" />} title="Upcoming">
          {upcomingDates.length === 0 ? (
            <Placeholder body="No upcoming revisions scheduled yet." />
          ) : (
            <div className="space-y-4">
              {upcomingDates.map((date) => (
                <div key={date}>
                  <div className="text-xs font-semibold text-muted-foreground mb-2">{date}</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {upcomingByDate.get(date)!.map((e) => (
                      <Card key={e.topic.id} className="p-4 shadow-sm">
                        <div className="text-sm font-semibold">{e.topic.name}</div>
                        {e.subject && (
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {e.subject.name}
                          </div>
                        )}
                        <div className="mt-2 text-[10px] uppercase tracking-[0.18em] text-primary/70">
                          {stageLabel(e.revision.stage)}
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section icon={<CheckCircle2 className="h-4 w-4 text-primary" />} title="Completed Today">
          {completedToday.length === 0 ? (
            <Placeholder body="Everything you revise today will show up here." />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {completedToday.map((e) => (
                <Card key={e.topic.id} className="p-4 shadow-sm">
                  <div className="text-sm font-semibold">{e.topic.name}</div>
                  {e.subject && (
                    <div className="text-xs text-muted-foreground mt-0.5">{e.subject.name}</div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </Section>

        <Section icon={<HistoryIcon className="h-4 w-4 text-primary" />} title="History">
          {historyEntries.length === 0 ? (
            <Placeholder body="Your last few revision sessions will appear here." />
          ) : (
            <div className="space-y-2">
              {historyEntries.map((h, i) => (
                <Card key={i} className="p-4 shadow-sm flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium">{h.topic.name}</div>
                    {h.subject && (
                      <div className="text-xs text-muted-foreground">{h.subject.name}</div>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs text-muted-foreground">{stageLabel(h.stage)}</div>
                    <div className="text-[10px] text-muted-foreground/70">
                      {relativeDateLabel(h.completed_at)}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h2 className="font-display text-lg font-semibold">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Placeholder({ body }: { body: string }) {
  return (
    <Card className="p-5 shadow-sm border-dashed">
      <div className="text-sm text-muted-foreground">{body}</div>
    </Card>
  );
}
