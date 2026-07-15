import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AppBackground } from "@/components/app-background";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, Flame, Shield, Infinity as InfinityIcon, Clock3 } from "lucide-react";
import type { ReactNode } from "react";

export const Route = createFileRoute("/quiz-modes")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Quiz Modes — UPSC Revision" },
      { name: "description", content: "Choose how you want to be tested." },
    ],
  }),
  component: QuizModesPage,
});

type QuizMode = {
  id: string;
  title: string;
  description: string;
  icon: ReactNode;
  enabled: boolean;
  route: string;
  search?: Record<string, string>;
  needsSelection?: boolean;
};

const MARATHON_COUNTS = [100, 250, 500, 1000] as const;

const QUIZ_MODES: QuizMode[] = [
  {
    id: "classic",
    title: "Classic Quiz",
    description: "Standard UPSC-style MCQs generated from your notes.",
    icon: <PlusCircle className="h-5 w-5" />,
    enabled: true,
    route: "/new",
  },
  {
    id: "daily",
    title: "Daily Challenge",
    description: "20 questions, refreshed every day.",
    icon: <Flame className="h-5 w-5" />,
    enabled: true,
    route: "/new",
    search: { mode: "daily" },
  },
  {
    id: "survival",
    title: "Survival Mode",
    description: "One life. Answer wrong and the run ends.",
    icon: <Shield className="h-5 w-5" />,
    enabled: true,
    route: "/new",
    search: { mode: "survival" },
  },
  {
    id: "marathon",
    title: "Marathon Mode",
    description: "A long-form run across every subject you've built.",
    icon: <InfinityIcon className="h-5 w-5" />,
    enabled: true,
    route: "/new",
    needsSelection: true,
  },
  {
    id: "timed",
    title: "Timed UPSC Exam",
    description: "Full-length, timed, exam-grade simulation.",
    icon: <Clock3 className="h-5 w-5" />,
    enabled: true,
    route: "/new",
    search: { mode: "timed" },
  },
];

function QuizModesPage() {
  const navigate = useNavigate();
  const [showMarathonPicker, setShowMarathonPicker] = useState(false);

  if (showMarathonPicker) {
    return (
      <div className="relative min-h-dvh overflow-x-hidden">
        <AppBackground />
        <div className="mx-auto max-w-4xl px-5 pt-20 pb-16 space-y-6">
          <header className="page-header-card">
            <h1 className="font-display text-3xl font-semibold tracking-tight">Marathon Mode</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Choose how many questions you want in this run.
            </p>
          </header>

          <Card className="p-5 space-y-4">
            <h2 className="font-semibold">Number of questions</h2>
            <div className="grid grid-cols-2 gap-3">
              {MARATHON_COUNTS.map((c) => (
                <Button
                  key={c}
                  variant="secondary"
                  onClick={() =>
                    navigate({
                      to: "/new",
                      search: { mode: "marathon", marathonCount: String(c) },
                    })
                  }
                >
                  {c} Questions
                </Button>
              ))}
            </div>
            <Button variant="ghost" className="w-full" onClick={() => setShowMarathonPicker(false)}>
              Back to Quiz Modes
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-dvh overflow-x-hidden">
      <AppBackground />
      <div className="mx-auto max-w-4xl px-5 pt-20 pb-16 space-y-6">
        <header className="page-header-card">
          <h1 className="font-display text-3xl font-semibold tracking-tight">Quiz Modes</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Pick a format. Only Classic is live today — more coming soon.
          </p>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {QUIZ_MODES.map((m) => {
            const Wrapper: any = m.enabled ? "button" : "div";
            return (
              <Wrapper
                key={m.id}
                onClick={
                  m.enabled
                    ? () =>
                        m.needsSelection
                          ? setShowMarathonPicker(true)
                          : navigate({ to: m.route, search: m.search })
                    : undefined
                }
                className="text-left w-full"
              >
                <Card
                  className={`p-5 h-full shadow-sm transition-all ${
                    m.enabled
                      ? "hover:border-primary/40 hover:shadow-md hover:-translate-y-0.5 cursor-pointer"
                      : "opacity-70"
                  }`}
                >
                  <div className="flex items-center gap-2.5 mb-2 text-primary">
                    {m.icon}
                    <h3 className="font-semibold text-foreground">{m.title}</h3>
                    {!m.enabled && (
                      <span className="ml-auto text-[10px] uppercase tracking-[0.18em] rounded-full border border-border/60 px-2 py-0.5 text-muted-foreground">
                        Coming soon
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{m.description}</p>
                </Card>
              </Wrapper>
            );
          })}
        </div>

        <div className="text-center text-xs text-muted-foreground">
          Want the classic flow?{" "}
          <Link to="/new" className="text-primary hover:underline">
            Generate a new quiz
          </Link>
          .
        </div>
      </div>
    </div>
  );
}