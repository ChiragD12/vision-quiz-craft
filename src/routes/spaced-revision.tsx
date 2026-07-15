import { createFileRoute } from "@tanstack/react-router";
import { AppBackground } from "@/components/app-background";
import { Card } from "@/components/ui/card";
import { CalendarClock, Clock, CheckCircle2, History } from "lucide-react";

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

function SpacedRevisionPage() {
  return (
    <div className="relative min-h-dvh overflow-x-hidden">
      <AppBackground />
      <div className="mx-auto max-w-4xl px-5 pt-20 pb-16 space-y-6">
        <header className="page-header-card">
          <h1 className="font-display text-3xl font-semibold tracking-tight">Spaced Revision</h1>
          <p className="text-sm text-muted-foreground mt-1">
            A future core system. Scheduling engine coming soon.
          </p>
        </header>

        <Section icon={<CalendarClock className="h-4 w-4 text-primary" />} title="Today's Revision">
          <Placeholder body="Cards scheduled for today will appear here." />
        </Section>

        <Section icon={<Clock className="h-4 w-4 text-primary" />} title="Upcoming Revision">
          <Placeholder body="A preview of the next 7 days." />
        </Section>

        <Section icon={<CheckCircle2 className="h-4 w-4 text-primary" />} title="Completed Today">
          <Placeholder body="Everything you revised today." />
        </Section>

        <Section icon={<History className="h-4 w-4 text-primary" />} title="Recent Activity">
          <Placeholder body="Your last few revision sessions." />
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
      <div className="mt-2 text-[10px] uppercase tracking-[0.18em] text-primary/70">Coming soon</div>
    </Card>
  );
}
