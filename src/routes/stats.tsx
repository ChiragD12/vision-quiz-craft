import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { api, evaluateAchievementsNow, type Quiz } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Clock, Target, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { todayKey } from "@/domain/streak";

export const Route = createFileRoute("/stats")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Time Statistics — UPSC Revision" },
      {
        name: "description",
        content: "Time and accuracy analytics from your local quiz history.",
      },
    ],
  }),
  component: StatsPage,
});

function useTick() {
  const [t, setT] = useState(0);
  useEffect(() => {
    const cb = () => setT((x) => x + 1);
    window.addEventListener("upsc-db-change", cb);
    window.addEventListener("storage", cb);
    return () => {
      window.removeEventListener("upsc-db-change", cb);
      window.removeEventListener("storage", cb);
    };
  }, []);
  return t;
}

function fmt(secs: number): string {
  if (!secs || secs < 1) return "—";
  if (secs < 60) return `${Math.round(secs)}s`;
  const m = Math.floor(secs / 60);
  const s = Math.round(secs % 60);
  return s ? `${m}m ${s}s` : `${m}m`;
}

function pct(n: number) {
  return `${Math.round(n)}%`;
}

type QuizAgg = {
  quiz: Quiz;
  answered: number;
  correct: number;
  totalTime: number;
  avgTime: number;
  accuracy: number;
};

function aggregate(quizzes: Quiz[]): QuizAgg[] {
  return quizzes
    .filter((q) => q.status === "completed")
    .map((q) => {
      let correct = 0,
        answered = 0;
      q.questions.forEach((qq, i) => {
        const a = q.answers[i];
        if (a != null) {
          answered++;
          if (a === qq.answerIndex) correct++;
        }
      });
      const totalTime = (q.per_q_seconds ?? []).reduce((a, b) => a + (b || 0), 0);
      const avgTime = answered ? totalTime / answered : 0;
      const accuracy = answered ? (correct / answered) * 100 : 0;
      return { quiz: q, answered, correct, totalTime, avgTime, accuracy };
    });
}

function StatsPage() {
  useTick();
  useEffect(() => {
    evaluateAchievementsNow();
  }, []);
  const { subjects } = api.listSubjectsAndTopics();
  const quizzes = api.recentQuizzes(50);
  const aggs = useMemo(() => aggregate(quizzes), [quizzes]);

  const totalQuizzes = aggs.length;
  const totalTime = aggs.reduce((a, x) => a + x.totalTime, 0);
  const totalAnswered = aggs.reduce((a, x) => a + x.answered, 0);
  const totalCorrect = aggs.reduce((a, x) => a + x.correct, 0);
  const avgTimePerQ = totalAnswered ? totalTime / totalAnswered : 0;
  const overallAccuracy = totalAnswered ? (totalCorrect / totalAnswered) * 100 : 0;

  // Accuracy-vs-time correlation (Pearson) over per-quiz avg time & accuracy.
  const correlation = useMemo(() => {
    const pts = aggs.filter((a) => a.answered > 0);
    if (pts.length < 3) return null;
    const xs = pts.map((p) => p.avgTime);
    const ys = pts.map((p) => p.accuracy);
    const mean = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
    const mx = mean(xs),
      my = mean(ys);
    let num = 0,
      dx2 = 0,
      dy2 = 0;
    for (let i = 0; i < xs.length; i++) {
      const dx = xs[i] - mx;
      const dy = ys[i] - my;
      num += dx * dy;
      dx2 += dx * dx;
      dy2 += dy * dy;
    }
    const denom = Math.sqrt(dx2 * dy2);
    return denom === 0 ? 0 : num / denom;
  }, [aggs]);

  // Per subject
  const bySubject = useMemo(() => {
    const map = new Map<string, { name: string; answered: number; time: number; correct: number; quizCount: number; recentAvg: number[] }>();
    for (const a of aggs) {
      const sid = a.quiz.subject_id ?? "unknown";
      const name = subjects.find((s) => s.id === sid)?.name ?? a.quiz.title ?? "Other";
      const cur =
        map.get(sid) ?? { name, answered: 0, time: 0, correct: 0, quizCount: 0, recentAvg: [] };
      cur.answered += a.answered;
      cur.time += a.totalTime;
      cur.correct += a.correct;
      cur.quizCount += 1;
      if (a.answered > 0) cur.recentAvg.push(a.avgTime);
      map.set(sid, cur);
    }
    return Array.from(map.values())
      .map((s) => {
        // Trend: compare first-half vs second-half average time.
        // Newer quizzes come first in recentAvg (recentQuizzes is desc).
        const half = Math.floor(s.recentAvg.length / 2);
        const recent = s.recentAvg.slice(0, half);
        const older = s.recentAvg.slice(half);
        const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
        const trend = older.length && recent.length ? avg(recent) - avg(older) : 0;
        return { ...s, trend };
      })
      .sort((a, b) => b.time - a.time);
  }, [aggs, subjects]);

  // Weekly comparison (last 7 days vs previous 7).
  const weekly = useMemo(() => {
    const now = new Date();
    const dayMs = 24 * 60 * 60 * 1000;
    const cutoffCurrent = new Date(now.getTime() - 7 * dayMs);
    const cutoffPrev = new Date(now.getTime() - 14 * dayMs);
    const bucket = (from: Date, to: Date) => {
      let time = 0,
        answered = 0,
        correct = 0;
      for (const a of aggs) {
        const ts = a.quiz.completed_at ?? a.quiz.created_at;
        if (ts >= from.getTime() && ts < to.getTime()) {
          time += a.totalTime;
          answered += a.answered;
          correct += a.correct;
        }
      }
      const avgTime = answered ? time / answered : 0;
      const accuracy = answered ? (correct / answered) * 100 : 0;
      return { time, answered, correct, avgTime, accuracy };
    };
    return {
      current: bucket(cutoffCurrent, now),
      previous: bucket(cutoffPrev, cutoffCurrent),
    };
  }, [aggs]);

  const speedDelta = weekly.current.avgTime - weekly.previous.avgTime;
  const accDelta = weekly.current.accuracy - weekly.previous.accuracy;

  return (
    <div className="relative min-h-screen z-10">
      <img
        src="/background.png"
        alt=""
        aria-hidden="true"
        className="fixed inset-0 h-full w-full object-cover pointer-events-none opacity-40"
        style={{ objectPosition: "center 50%", zIndex: -1 }}
      />
      <header className="mx-auto max-w-4xl px-5 pt-8 sm:pt-12">
        <div className="flex items-center justify-between">
          <Link to="/" className="inline-flex items-center hover:opacity-90 transition-opacity">
            <img src="/header-logo-a.png" alt="Home" className="h-10 w-auto" />
          </Link>
          <Button asChild variant="ghost" size="sm">
            <Link to="/">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Home
            </Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-5 py-8 space-y-8">
        <div>
          <h1 className="font-display text-3xl font-semibold">Time Statistics</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {totalQuizzes === 0
              ? "Complete a quiz to see your time analytics."
              : `Based on your last ${totalQuizzes} completed ${totalQuizzes === 1 ? "quiz" : "quizzes"}.`}
          </p>
        </div>

        {totalQuizzes === 0 ? (
          <Card className="p-6 text-sm text-muted-foreground">
            No completed quizzes yet.{" "}
            <Link to="/new" className="text-primary hover:underline">
              Generate one
            </Link>{" "}
            to start tracking.
          </Card>
        ) : (
          <>
            <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard icon={<Clock className="h-4 w-4" />} label="Total time" value={fmt(totalTime)} />
              <StatCard icon={<Clock className="h-4 w-4" />} label="Avg / question" value={fmt(avgTimePerQ)} />
              <StatCard icon={<Target className="h-4 w-4" />} label="Overall accuracy" value={pct(overallAccuracy)} />
              <StatCard
                icon={<TrendingUp className="h-4 w-4" />}
                label="Time ↔ accuracy"
                value={
                  correlation == null
                    ? "—"
                    : correlation > 0.2
                      ? "Slower = better"
                      : correlation < -0.2
                        ? "Faster = better"
                        : "No clear link"
                }
                hint={correlation == null ? undefined : `r = ${correlation.toFixed(2)}`}
              />
            </section>

            <section>
              <h2 className="font-display text-xl font-semibold mb-3">Weekly comparison</h2>
              <Card className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <WeeklyRow
                  label="Speed (avg / question)"
                  current={fmt(weekly.current.avgTime)}
                  delta={
                    weekly.previous.answered === 0
                      ? null
                      : {
                          // Lower time = better
                          text: `${speedDelta >= 0 ? "+" : ""}${fmt(Math.abs(speedDelta))}`,
                          better: speedDelta < 0,
                          same: Math.abs(speedDelta) < 1,
                        }
                  }
                />
                <WeeklyRow
                  label="Accuracy"
                  current={pct(weekly.current.accuracy)}
                  delta={
                    weekly.previous.answered === 0
                      ? null
                      : {
                          text: `${accDelta >= 0 ? "+" : ""}${accDelta.toFixed(1)}%`,
                          better: accDelta > 0,
                          same: Math.abs(accDelta) < 0.5,
                        }
                  }
                />
                <WeeklyRow
                  label="Questions answered"
                  current={String(weekly.current.answered)}
                  delta={
                    weekly.previous.answered === 0
                      ? null
                      : {
                          text: `${weekly.current.answered - weekly.previous.answered >= 0 ? "+" : ""}${weekly.current.answered - weekly.previous.answered}`,
                          better: weekly.current.answered > weekly.previous.answered,
                          same: weekly.current.answered === weekly.previous.answered,
                        }
                  }
                />
                <WeeklyRow
                  label="Time invested"
                  current={fmt(weekly.current.time)}
                  delta={
                    weekly.previous.time === 0
                      ? null
                      : {
                          text: `${weekly.current.time - weekly.previous.time >= 0 ? "+" : ""}${fmt(Math.abs(weekly.current.time - weekly.previous.time))}`,
                          better: weekly.current.time > weekly.previous.time,
                          same: Math.abs(weekly.current.time - weekly.previous.time) < 2,
                        }
                  }
                />
              </Card>
            </section>

            <section>
              <h2 className="font-display text-xl font-semibold mb-3">By subject</h2>
              {bySubject.length === 0 ? (
                <Card className="p-4 text-sm text-muted-foreground">No subject data yet.</Card>
              ) : (
                <div className="space-y-2">
                  {bySubject.map((s, i) => {
                    const avgQ = s.answered ? s.time / s.answered : 0;
                    const acc = s.answered ? (s.correct / s.answered) * 100 : 0;
                    return (
                      <Card key={i} className="p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="font-medium truncate">{s.name}</div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {s.quizCount} quiz{s.quizCount === 1 ? "" : "zes"} · {s.answered} answered · {pct(acc)} accuracy
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-display nums text-lg">{fmt(avgQ)}</div>
                            <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
                              avg/Q
                            </div>
                          </div>
                          <TrendBadge trendSeconds={s.trend} />
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}

        <div className="text-xs text-muted-foreground text-center pt-4">
          Data is computed from your local quiz history — nothing leaves this device.
          <br />
          Today ({todayKey()}): {api.solvedToday()} correct answers.
        </div>
      </main>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-primary text-xs uppercase tracking-widest">
        {icon}
        {label}
      </div>
      <div className="font-display text-2xl nums mt-2">{value}</div>
      {hint && <div className="text-[11px] text-muted-foreground mt-1">{hint}</div>}
    </Card>
  );
}

function WeeklyRow({
  label,
  current,
  delta,
}: {
  label: string;
  current: string;
  delta: { text: string; better: boolean; same: boolean } | null;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <div>
        <div className="text-xs uppercase tracking-widest text-muted-foreground">{label}</div>
        <div className="font-display text-xl nums">{current}</div>
      </div>
      {delta ? (
        <div
          className={
            "inline-flex items-center gap-1 text-xs font-medium " +
            (delta.same
              ? "text-muted-foreground"
              : delta.better
                ? "text-success"
                : "text-destructive")
          }
        >
          {delta.same ? (
            <Minus className="h-3 w-3" />
          ) : delta.better ? (
            <TrendingUp className="h-3 w-3" />
          ) : (
            <TrendingDown className="h-3 w-3" />
          )}
          {delta.text}
        </div>
      ) : (
        <span className="text-xs text-muted-foreground">no prior week</span>
      )}
    </div>
  );
}

function TrendBadge({ trendSeconds }: { trendSeconds: number }) {
  if (Math.abs(trendSeconds) < 1) {
    return (
      <div className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Minus className="h-3 w-3" />
        steady
      </div>
    );
  }
  const faster = trendSeconds < 0;
  return (
    <div
      className={
        "inline-flex items-center gap-1 text-xs font-medium " +
        (faster ? "text-success" : "text-destructive")
      }
    >
      {faster ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {faster ? "faster" : "slower"}
    </div>
  );
}
