import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { api, type MCQ } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  X,
  Home,
  RotateCw,
  CheckCircle2,
  XCircle,
  MinusCircle,
  Timer,
  Flame,
  BarChart3,
  Trophy,
  ThumbsUp,
  BookOpen,
  Bookmark,
  Target,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { QuestionContent } from "@/components/question-content";
import { QuizCelebration } from "@/components/quiz-celebration";
import { ExplanationDisplay } from "@/components/explanation-display";
import { ProgressRing } from "@/components/progress-ring";
import { useCountUp } from "@/hooks/use-count-up";
import { playSound } from "@/lib/sound-manager";

export const Route = createFileRoute("/result/$id")({
  ssr: false,
  head: () => ({ meta: [{ title: "Result — UPSC Revision" }] }),
  component: ResultPage,
});

function fmtDuration(secs: number): string {
  if (secs < 60) return `${secs}s`;
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return s ? `${m}m ${s}s` : `${m}m`;
}

type PerformanceTier = {
  label: string;
  Icon: LucideIcon;
  accent: string; // text color class
  ring: string; // border/background accent classes for the banner
};

function getPerformanceTier(percent: number): PerformanceTier {
  if (percent >= 90) {
    return {
      label: "Outstanding Performance",
      Icon: Trophy,
      accent: "text-amber-400",
      ring: "border-amber-400/30 bg-amber-400/[0.08]",
    };
  }
  if (percent >= 75) {
    return {
      label: "Excellent Work",
      Icon: Flame,
      accent: "text-orange-400",
      ring: "border-orange-400/30 bg-orange-400/[0.08]",
    };
  }
  if (percent >= 50) {
    return {
      label: "Good Attempt",
      Icon: ThumbsUp,
      accent: "text-sky-400",
      ring: "border-sky-400/30 bg-sky-400/[0.08]",
    };
  }
  return {
    label: "Keep Practicing",
    Icon: BookOpen,
    accent: "text-fuchsia-400",
    ring: "border-fuchsia-400/30 bg-fuchsia-400/[0.08]",
  };
}

function AnimatedNumber({
  value,
  decimals = 0,
  suffix = "",
  durationMs,
  className,
}: {
  value: number;
  decimals?: number;
  suffix?: string;
  durationMs?: number;
  className?: string;
}) {
  const animated = useCountUp(value, durationMs, decimals);
  return (
    <span className={cn("nums", className)}>
      {animated.toFixed(decimals)}
      {suffix}
    </span>
  );
}

function ResultPage() {
  const { id } = Route.useParams();
  const quiz = api.getQuiz(id);
  const prefersReducedMotion = useReducedMotion();
  const [showCelebration, setShowCelebration] = useState(false);
  useEffect(() => {
    if (!quiz) return;
    setShowCelebration(true);
    playSound("quiz-complete");
    const t = setTimeout(() => setShowCelebration(false), 2400);
    return () => clearTimeout(t);
  }, [quiz?.id]);



  if (!quiz) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <Card className="p-6 text-center max-w-md">
          <p className="mb-3">Result not found on this device.</p>
          <Button asChild>
            <Link to="/">Go home</Link>
          </Button>
        </Card>
      </div>
    );
  }

  const questions = quiz.questions as MCQ[];
  const answers = quiz.answers;
  let correct = 0,
    wrong = 0,
    skipped = 0;
  questions.forEach((q, i) => {
    const a = answers[i];
    if (a == null) skipped++;
    else if (a === q.answerIndex) correct++;
    else wrong++;
  });
  const answered = correct + wrong;
  const score = correct * 2 - wrong * 0.66;
  const maxScore = questions.length * 2;
  const accuracy = answered ? (correct / answered) * 100 : 0;
  const totalTime = (quiz.per_q_seconds ?? []).reduce((a, b) => a + (b || 0), 0);
  const bookmarkCount = questions.filter((q) => api.isBookmarked(q)).length;

  const percent = maxScore > 0 ? Math.max(0, Math.min(100, (score / maxScore) * 100)) : 0;
  const avgTimePerQuestion = answered > 0 && totalTime > 0 ? totalTime / answered : null;
  const currentStreak = api.consecutiveDaysActive();
  const diffCounts = questions.reduce(
    (acc, q) => {
      if (q.difficulty === "Easy") acc.easy++;
      else if (q.difficulty === "Medium") acc.medium++;
      else if (q.difficulty === "Hard") acc.hard++;
      return acc;
    },
    { easy: 0, medium: 0, hard: 0 },
  );
  const hasDifficultyData = diffCounts.easy + diffCounts.medium + diffCounts.hard > 0;
  const tier = getPerformanceTier(percent);
  const TierIcon = tier.Icon;

  return (
    <div className="min-h-screen">
      {showCelebration && <QuizCelebration accuracy={accuracy} />}
      <header className="mx-auto max-w-3xl px-5 pt-8">
        <h1 className="mt-4 font-display text-3xl font-semibold text-balance">{quiz.title}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          UPSC scoring · +2 correct · −0.66 wrong
        </p>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-8 space-y-6">
        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0, y: 18, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={
            prefersReducedMotion
              ? { duration: 0 }
              : { type: "spring", stiffness: 260, damping: 24, mass: 0.9 }
          }
        >
          <Card className="overflow-hidden p-8">
            <div className="flex flex-col items-center gap-6 text-center sm:flex-row sm:justify-between sm:text-left">
              <div>
                <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Final Score
                </div>
                <div className="mt-1 flex items-baseline justify-center gap-1.5 sm:justify-start">
                  <AnimatedNumber
                    value={score}
                    decimals={2}
                    durationMs={prefersReducedMotion ? 0 : 1100}
                    className="font-display text-5xl font-semibold text-primary drop-shadow-[0_0_18px_hsl(var(--primary)/0.35)] sm:text-6xl"
                  />
                  <span className="text-lg text-muted-foreground">/ {maxScore}</span>
                </div>
                <div className="mt-3 text-sm text-muted-foreground">
                  <AnimatedNumber value={correct} className="font-semibold text-success" /> correct
                  &nbsp;·&nbsp;
                  <AnimatedNumber value={questions.length} className="font-semibold" /> total
                </div>
                {hasDifficultyData && (
                  <span className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                    <BarChart3 className="h-3.5 w-3.5" />
                    {diffCounts.hard >= diffCounts.medium && diffCounts.hard >= diffCounts.easy
                      ? "Hard-heavy set"
                      : diffCounts.medium >= diffCounts.easy
                        ? "Medium-heavy set"
                        : "Easy-heavy set"}
                  </span>
                )}
              </div>

              <ProgressRing
                percent={percent}
                progressClassName={
                  percent >= 75 ? "stroke-success" : percent >= 50 ? "stroke-primary" : "stroke-destructive"
                }
                glowClassName={
                  percent >= 75 ? "bg-success/20" : percent >= 50 ? "bg-primary/20" : "bg-destructive/20"
                }
              >
                <AnimatedNumber
                  value={percent}
                  decimals={1}
                  suffix="%"
                  className="font-display text-3xl font-semibold"
                />
                <span className="mt-0.5 text-[10px] uppercase tracking-widest text-muted-foreground">
                  Accuracy score
                </span>
              </ProgressRing>
            </div>

            <div className="mt-8 flex flex-wrap justify-center gap-2 sm:justify-start">
              <Button asChild>
                <Link to="/">
                  <Home className="mr-2 h-4 w-4" />
                  Home
                </Link>
              </Button>
              <Button variant="secondary" asChild>
                <Link to="/new">
                  <RotateCw className="mr-2 h-4 w-4" />
                  Generate again
                </Link>
              </Button>
            </div>
          </Card>
        </motion.div>

        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.35, delay: prefersReducedMotion ? 0 : 0.15, ease: "easeOut" }}
          className={cn(
            "flex items-center gap-3 rounded-2xl border px-5 py-4 backdrop-blur-md",
            tier.ring,
          )}
        >
          <TierIcon className={cn("h-6 w-6 shrink-0", tier.accent)} />
          <span className={cn("font-display text-base font-semibold sm:text-lg", tier.accent)}>
            {tier.label}
          </span>
        </motion.div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatCard
            icon={CheckCircle2}
            label="Correct"
            value={correct}
            accent="text-success"
            ring="border-success/25 bg-success/[0.06]"
            delay={0}
          />
          <StatCard
            icon={XCircle}
            label="Wrong"
            value={wrong}
            accent="text-destructive"
            ring="border-destructive/25 bg-destructive/[0.06]"
            delay={0.05}
          />
          <StatCard
            icon={MinusCircle}
            label="Skipped"
            value={skipped}
            accent="text-muted-foreground"
            ring="border-white/10 bg-white/[0.04]"
            delay={0.08}
          />
          {avgTimePerQuestion != null && (
            <StatCard
              icon={Timer}
              label="Avg Time / Q"
              display={fmtDuration(Math.round(avgTimePerQuestion))}
              accent="text-sky-400"
              ring="border-sky-400/25 bg-sky-400/[0.06]"
              delay={0.1}
            />
          )}
          <StatCard
            icon={Flame}
            label="Current Streak"
            display={`${currentStreak} ${currentStreak === 1 ? "day" : "days"}`}
            accent="text-orange-400"
            ring="border-orange-400/25 bg-orange-400/[0.06]"
            delay={0.15}
          />
          <StatCard
            icon={Bookmark}
            label="Bookmarked"
            value={bookmarkCount}
            accent="text-primary"
            ring="border-primary/25 bg-primary/[0.06]"
            delay={0.2}
          />
          {hasDifficultyData && (
            <motion.div
              initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: prefersReducedMotion ? 0 : 0.32, delay: prefersReducedMotion ? 0 : 0.25, ease: "easeOut" }}
              className="col-span-2 rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-md sm:col-span-1"
            >
              <div className="mb-2 flex items-center gap-2 text-muted-foreground">
                <BarChart3 className="h-4 w-4" />
                <span className="text-[11px] font-semibold uppercase tracking-widest">
                  Difficulty
                </span>
              </div>
              <div className="space-y-1.5 text-xs">
                <DifficultyBar label="Easy" count={diffCounts.easy} total={questions.length} color="bg-success" />
                <DifficultyBar
                  label="Medium"
                  count={diffCounts.medium}
                  total={questions.length}
                  color="bg-primary"
                />
                <DifficultyBar label="Hard" count={diffCounts.hard} total={questions.length} color="bg-destructive" />
              </div>
            </motion.div>
          )}
        </div>

        <ReviewPanel questions={questions} answers={answers} />
      </main>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  display,
  accent,
  ring,
  delay = 0,
}: {
  icon: LucideIcon;
  label: string;
  value?: number;
  display?: string;
  accent: string;
  ring: string;
  delay?: number;
}) {
  const prefersReducedMotion = useReducedMotion();
  return (
    <motion.div
      initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={
        prefersReducedMotion
          ? { duration: 0 }
          : { type: "spring", stiffness: 300, damping: 26, delay }
      }
      className={cn("rounded-2xl border p-4 backdrop-blur-md", ring)}
    >
      <Icon className={cn("h-4 w-4", accent)} />
      <div className={cn("mt-2 font-display text-2xl font-semibold nums", accent)}>
        {display ?? (value != null ? <AnimatedNumber value={value} /> : "—")}
      </div>
      <div className="mt-0.5 text-[11px] uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
    </motion.div>
  );
}

function DifficultyBar({
  label,
  count,
  total,
  color,
}: {
  label: string;
  count: number;
  total: number;
  color: string;
}) {
  const prefersReducedMotion = useReducedMotion();
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div>
      <div className="mb-0.5 flex items-center justify-between text-foreground/80">
        <span>{label}</span>
        <span className="nums">{count}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.6, ease: "easeOut", delay: prefersReducedMotion ? 0 : 0.2 }}
          className={cn("h-full rounded-full", color)}
        />
      </div>
    </div>
  );
}

type QuestionStatus = "correct" | "wrong" | "skipped";

function statusOf(answer: number | null | undefined, answerIndex: number): QuestionStatus {
  if (answer == null) return "skipped";
  return answer === answerIndex ? "correct" : "wrong";
}

const statusStyles: Record<
  QuestionStatus,
  { dot: string; badge: string; accent: string; icon: LucideIcon; label: string }
> = {
  correct: {
    dot: "bg-success",
    badge: "border-success/40 bg-success/15 text-success",
    accent: "text-success",
    icon: CheckCircle2,
    label: "Correct",
  },
  wrong: {
    dot: "bg-destructive",
    badge: "border-destructive/40 bg-destructive/15 text-destructive",
    accent: "text-destructive",
    icon: XCircle,
    label: "Wrong",
  },
  skipped: {
    dot: "bg-muted-foreground",
    badge: "border-border bg-muted/40 text-muted-foreground",
    accent: "text-muted-foreground",
    icon: MinusCircle,
    label: "Skipped",
  },
};

function AnswerSummaryCard({
  icon: Icon,
  label,
  value,
  accent,
  ring,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  accent: string;
  ring: string;
}) {
  return (
    <div className={cn("rounded-2xl border p-3 text-center backdrop-blur-md", ring)}>
      <Icon className={cn("mx-auto h-4 w-4", accent)} />
      <div className={cn("mt-1.5 font-display text-lg font-semibold nums", accent)}>{value}</div>
      <div className="mt-0.5 text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

const reviewSlideVariants = {
  enter: (dir: number) => ({ opacity: 0, x: dir >= 0 ? 28 : -28, scale: 0.98 }),
  center: { opacity: 1, x: 0, scale: 1 },
  exit: (dir: number) => ({ opacity: 0, x: dir >= 0 ? -28 : 28, scale: 0.98 }),
};

function ReviewPanel({
  questions,
  answers,
}: {
  questions: MCQ[];
  answers: (number | null)[];
}) {
  const prefersReducedMotion = useReducedMotion();
  const total = questions.length;
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(0);

  const go = (next: number) => {
    const clamped = Math.max(0, Math.min(total - 1, next));
    if (clamped === index) return;
    setDirection(clamped > index ? 1 : -1);
    setIndex(clamped);
  };

  if (total === 0) return null;

  const q = questions[index];
  const a = answers[index];
  const status = statusOf(a, q.answerIndex);
  const style = statusStyles[status];
  const StatusIcon = style.icon;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-xl font-semibold">Review</h2>
        <span className="text-sm text-muted-foreground nums">
          Question {index + 1} of {total}
        </span>
      </div>

      {/* Progress bar */}
      <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-white/10">
        <motion.div
          className="h-full rounded-full bg-primary"
          animate={{ width: `${((index + 1) / total) * 100}%` }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.3, ease: "easeOut" }}
        />
      </div>

      {/* Compact jump-to-question selector */}
      <div className="mb-4">
        <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          Jump to question
        </div>
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {questions.map((qq, i) => {
            const st = statusOf(answers[i], qq.answerIndex);
            const s = statusStyles[st];
            const active = i === index;
            return (
              <motion.button
                key={i}
                type="button"
                onClick={() => go(i)}
                aria-label={`Jump to question ${i + 1} (${s.label})`}
                aria-current={active}
                whileTap={prefersReducedMotion ? undefined : { scale: 0.92 }}
                transition={{ type: "spring", stiffness: 420, damping: 26 }}
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-xs font-semibold nums",
                  s.badge,
                  active && "scale-110 ring-2 ring-primary ring-offset-2 ring-offset-background",
                )}
              >
                {i + 1}
              </motion.button>
            );
          })}
        </div>
      </div>

      <div className="relative overflow-hidden">
        <AnimatePresence mode="wait" custom={direction} initial={false}>
          <motion.div
            key={index}
            custom={direction}
            variants={reviewSlideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={
              prefersReducedMotion
                ? { duration: 0 }
                : { type: "spring", stiffness: 320, damping: 30, mass: 0.9 }
            }
          >
            <Card className="p-5">
              <div className="mb-4 flex items-start gap-3">
                <span
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold nums",
                    status === "correct" && "bg-success text-success-foreground",
                    status === "wrong" && "bg-destructive text-destructive-foreground",
                    status === "skipped" && "bg-muted text-muted-foreground",
                  )}
                >
                  {status === "skipped" ? index + 1 : <StatusIcon className="h-4 w-4" />}
                </span>
                <div className="flex-1 text-base font-medium">
                  <QuestionContent text={q.question} />
                </div>
              </div>

              <div className="mb-4 space-y-1.5 text-sm">
                {q.options.map((opt, j) => (
                  <div
                    key={j}
                    className={cn(
                      "flex gap-2 rounded-xl border px-3 py-2",
                      j === q.answerIndex
                        ? "border-success/40 bg-success/10 text-success"
                        : j === a
                          ? "border-destructive/40 bg-destructive/10 text-destructive"
                          : "border-white/10 bg-white/[0.02]",
                    )}
                  >
                    <span className="font-semibold">{String.fromCharCode(65 + j)}.</span>
                    <span>{opt}</span>
                  </div>
                ))}
              </div>

              <div className="mb-4 grid grid-cols-3 gap-2">
                <AnswerSummaryCard
                  icon={Target}
                  label="Your Answer"
                  value={a != null ? String.fromCharCode(65 + a) : "—"}
                  accent={style.accent}
                  ring={style.badge}
                />
                <AnswerSummaryCard
                  icon={CheckCircle2}
                  label="Correct Answer"
                  value={String.fromCharCode(65 + q.answerIndex)}
                  accent="text-success"
                  ring="border-success/40 bg-success/10"
                />
                <AnswerSummaryCard
                  icon={StatusIcon}
                  label="Result"
                  value={style.label}
                  accent={style.accent}
                  ring={style.badge}
                />
              </div>

              {q.explanation && <ExplanationDisplay text={q.explanation} />}
            </Card>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <motion.div
          className="flex-1"
          whileTap={prefersReducedMotion ? undefined : { scale: 0.97 }}
          transition={{ type: "spring", stiffness: 420, damping: 26 }}
        >
          <Button
            variant="secondary"
            size="lg"
            className="h-12 w-full"
            onClick={() => go(index - 1)}
            disabled={index === 0}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Previous
          </Button>
        </motion.div>
        <motion.div
          className="flex-1"
          whileTap={prefersReducedMotion ? undefined : { scale: 0.97 }}
          transition={{ type: "spring", stiffness: 420, damping: 26 }}
        >
          <Button size="lg" className="h-12 w-full" onClick={() => go(index + 1)} disabled={index === total - 1}>
            Next
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </motion.div>
      </div>
    </div>
  );
}
