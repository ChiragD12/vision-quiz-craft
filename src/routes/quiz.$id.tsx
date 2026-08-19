import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { api, REVISION_SCHEDULE_DAYS, type MCQ, type Quiz, type TopicRevision } from "@/lib/store";
import { QuizTimer } from "@/components/quiz-timer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ArrowRight, ArrowLeft, Bookmark, Check, X, Save } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { QuestionContent } from "@/components/question-content";
import { StreakRing } from "@/components/streak-ring";
import { ExplanationDisplay } from "@/components/explanation-display";
import { playSound } from "@/lib/sound-manager";

export const Route = createFileRoute("/quiz/$id")({
  ssr: false,
  component: QuizPage,
});

// Local-date-safe day count from today to a "YYYY-MM-DD" due date (same
// format todayKey() produces), used only for the Revision Complete card.
function daysUntil(dateKey: string): number {
  const [y, m, d] = dateKey.split("-").map(Number);
  const target = new Date(y, m - 1, d);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

function QuizPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const prefersReducedMotion = useReducedMotion();
  const [quiz, setQuiz] = useState<Quiz | undefined>(() => api.getQuiz(id));
  const [idx, setIdx] = useState<number>(() => quiz?.current_index ?? 0);
  const [selected, setSelected] = useState<number | null>(null);
  const [revealed, setRevealed] = useState<boolean>(false);
  const [bmTick, setBmTick] = useState(0);
  const [rewardProgress, setRewardProgress] = useState<number>(() => api.correctSinceReward());
  // Survival Mode: the quiz engine checks quiz.mode (one centralized flag)
  // rather than scattering mode checks across files. Classic quizzes have
  // mode "classic" (or undefined) and are completely unaffected below.
  const [survivalOver, setSurvivalOver] = useState(false);
  const [survivalResult, setSurvivalResult] = useState<{
    run: number;
    best: number;
    isNewBest: boolean;
  } | null>(null);
  // Timed UPSC Exam: countdown driven off the fixed deadline stored on the
  // Quiz object itself (quiz.timed_deadline) — no global/module variables.
  const [secondsLeft, setSecondsLeft] = useState(0);
  // Spaced Revision: after a revisionReview quiz completes, hold the
  // updated schedule here instead of navigating immediately, so a
  // "Revision Complete" card can be shown first (Continue proceeds to the
  // existing results page, unchanged).
  const [revisionResult, setRevisionResult] = useState<TopicRevision | null>(null);
  const submittedRef = useRef(false);
  useEffect(() => {
    const cb = () => setRewardProgress(api.correctSinceReward());
    window.addEventListener("upsc-db-change", cb);
    return () => window.removeEventListener("upsc-db-change", cb);
  }, []);

  // ---------- Timing model ----------
  // Every unanswered question that has ever been shown keeps accruing real
  // (active, foreground) time in parallel — it does NOT pause just because
  // a different question is on screen. Answering a question removes it
  // from this set forever, freezing its recorded total at exactly that
  // instant. `lastSyncRef` is the single shared wall-clock checkpoint: any
  // time we account for elapsed real time, we credit the slice since
  // `lastSyncRef` to every index still in `activeIndicesRef`, then advance
  // `lastSyncRef` to now. Both refs are scoped to this component instance,
  // so each quiz page mount owns a completely independent clock — opening
  // a different quiz mounts a fresh instance with its own refs, and this
  // one simply stops accruing (its interval/listeners are torn down) the
  // moment it unmounts.
  const activeIndicesRef = useRef<Set<number>>(new Set());
  const lastSyncRef = useRef<number>(Date.now());
  const quizRef = useRef<Quiz | undefined>(quiz);
  quizRef.current = quiz;

  // Credits elapsed wall-clock time (since the last checkpoint) to every
  // question still in the active set, then advances the checkpoint. Pure
  // aside from the checkpoint/active-set bookkeeping — safe to call as
  // often as needed; calling it with no time passed or no active questions
  // is a no-op that returns the same object reference.
  const flushElapsed = (currentQuiz: Quiz): Quiz => {
    const now = Date.now();
    const elapsedSec = (now - lastSyncRef.current) / 1000;
    lastSyncRef.current = now;
    if (elapsedSec <= 0 || activeIndicesRef.current.size === 0) return currentQuiz;
    const perQ = [
      ...(currentQuiz.per_q_seconds ?? new Array(currentQuiz.question_count).fill(0)),
    ];
    for (const i of activeIndicesRef.current) {
      perQ[i] = (perQ[i] ?? 0) + elapsedSec;
    }
    return { ...currentQuiz, per_q_seconds: perQ };
  };

  // Timed UPSC Exam flag, computed early (before any early return) so the
  // countdown effect below can use it safely on every render.
  const isTimed = quiz?.mode === "timed";

  // Flush-and-persist helper for call sites that only need to sync time
  // (no accompanying answer/index change): the periodic tick, tab
  // visibility changes, navigation, and unmount.
  const syncNow = () => {
    const cq = quizRef.current;
    if (!cq) return;
    const flushed = flushElapsed(cq);
    if (flushed !== cq) {
      api.saveQuiz(flushed);
      setQuiz(flushed);
    }
  };

  // Grades every answered question at once, applies the same negative
  // marking / wrong-answer / streak bookkeeping Classic Quiz uses per pick,
  // marks the quiz completed, then hands off to the existing results page —
  // which is the only place explanations/correct answers are revealed.
  const submitExam = () => {
    if (submittedRef.current) return;
    const cq = quizRef.current;
    if (!cq) return;
    submittedRef.current = true;
    syncNow();
    let correctCount = 0;
    cq.questions.forEach((qq, i) => {
      const ans = cq.answers[i];
      if (ans == null) return;
      if (ans === qq.answerIndex) {
        correctCount++;
        api.clearWrong(qq);
      } else {
        api.recordWrong(qq, cq.title);
      }
    });
    if (correctCount > 0) api.bumpSolved(correctCount);
    playSound("quiz-complete");
    const done: Quiz = {
      ...cq,
      status: "completed",
      completed_at: Date.now(),
    };
    api.saveQuiz(done);
    // Spaced Revision: only a quiz launched from the Review button on the
    // Spaced Revision page (revisionReview === true) advances the topic's
    // revision schedule. A Timed exam is never the "first Classic Quiz
    // completion" that starts a schedule, so no begin-schedule call here.
    if (cq.topic_id && cq.revisionReview && cq.status !== "completed") {
      const tr = api.markTopicRevised(cq.topic_id);
      if (tr) {
        setRevisionResult(tr);
        return;
      }
    }
    navigate({ to: "/result/$id", params: { id } });
  };

  // (Re)build the active set whenever a genuinely different quiz loads:
  // every question from 0 up to the furthest one reached that's still
  // unanswered has "started" and should keep accruing, exactly as if the
  // quiz had never been left (rule 5 — skipped questions keep running).
  // The clock itself starts fresh at mount time, so any time spent away
  // from this quiz before (re)opening it is correctly excluded.
  useEffect(() => {
    const cq = quizRef.current;
    if (!cq) return;
    const initial = new Set<number>();
    const maxReached = cq.current_index ?? 0;
    for (let i = 0; i <= maxReached && i < cq.answers.length; i++) {
      if (cq.answers[i] == null) initial.add(i);
    }
    activeIndicesRef.current = initial;
    lastSyncRef.current = Date.now();
  }, [quiz?.id]);

  // The moment a not-yet-tracked, unanswered question comes into view for
  // the first time, its clock starts now — but only after crediting the
  // time already accrued so far to the questions that were active before
  // it, so the newcomer doesn't retroactively absorb time it was never
  // shown for.
  useEffect(() => {
    const cq = quizRef.current;
    if (!cq) return;
    if (cq.answers[idx] != null) return;
    if (activeIndicesRef.current.has(idx)) return;
    const flushed = flushElapsed(cq);
    if (flushed !== cq) {
      api.saveQuiz(flushed);
      setQuiz(flushed);
    }
    activeIndicesRef.current.add(idx);
  }, [idx]);

  // Resets the answer-selection UI whenever the displayed question changes.
  useEffect(() => {
    setSelected(null);
    const answered = quiz?.answers[idx] != null;
    setRevealed(!!answered);
  }, [idx, quiz?.id]);

  // The one recurring tick: while this tab is in the foreground, credit
  // real elapsed time to every active question roughly once a second, so
  // the on-screen clock (and persisted totals) stay live. Skipped entirely
  // while hidden — see the visibility effect for how the hidden gap itself
  // is excluded.
  useEffect(() => {
    const t = window.setInterval(() => {
      if (document.hidden) return;
      syncNow();
    }, 1000);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Timed UPSC Exam: a hard wall-clock countdown to quiz.timed_deadline,
  // independent of tab visibility (a real exam clock doesn't pause). Once
  // it reaches zero, the exam is auto-submitted exactly once.
  useEffect(() => {
    if (!isTimed) return;
    const tick = () => {
      const dl = quizRef.current?.timed_deadline;
      if (!dl) return;
      const remaining = Math.max(0, Math.round((dl - Date.now()) / 1000));
      setSecondsLeft(remaining);
      if (remaining <= 0) submitExam();
    };
    tick();
    const t = window.setInterval(tick, 1000);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTimed, quiz?.id]);

  // Rule 3: time only counts while the user is actively inside this quiz.
  // Going hidden (switching tabs, backgrounding the app/PWA) flushes
  // whatever's accrued up to that instant and then the interval above
  // stops crediting further time. Coming back resets the checkpoint to
  // "now" — excluding the entire hidden gap — before ticking resumes.
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) {
        syncNow();
      } else {
        lastSyncRef.current = Date.now();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Best-effort flush on an outright close/reload — pagehide fires
  // reliably before the page is torn down, and localStorage writes are
  // synchronous, so this reliably persists the final slice.
  useEffect(() => {
    const onPageHide = () => syncNow();
    window.addEventListener("pagehide", onPageHide);
    return () => window.removeEventListener("pagehide", onPageHide);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Flush on unmount — e.g. navigating back to the homepage or into a
  // different quiz. This is what makes quizzes independent: this quiz's
  // clock simply stops the moment its page is gone.
  useEffect(() => {
    return () => {
      syncNow();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const q: MCQ | undefined = quiz?.questions[idx];
  const bookmarked = useMemo(() => (q ? api.isBookmarked(q) : false), [q, bmTick]);

  if (!quiz || !q) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <Card className="p-6 text-center max-w-md">
          <p className="mb-3">Quiz not found on this device.</p>
          <Button asChild>
            <Link to="/">Go home</Link>
          </Button>
        </Card>
      </div>
    );
  }

  const isSurvival = quiz.mode === "survival";

  if (revisionResult) {
    const stage = revisionResult.stage;
    const nextStageLabel =
      stage < REVISION_SCHEDULE_DAYS.length
        ? `Day ${REVISION_SCHEDULE_DAYS[stage]}`
        : "Schedule complete";
    const dueInDays = revisionResult.next_due_date
      ? daysUntil(revisionResult.next_due_date)
      : null;
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0, y: 14, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="max-w-md w-full"
        >
        <Card className="p-8 w-full text-center">
          <h1 className="font-display text-3xl font-semibold mb-2">Revision Complete</h1>
          <div className="my-6">
            <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Next Review
            </div>
            <div className="font-display text-2xl mt-1">{nextStageLabel}</div>
            {dueInDays !== null && (
              <div className="text-sm text-muted-foreground mt-1">
                Due in {dueInDays} day{dueInDays === 1 ? "" : "s"}
              </div>
            )}
          </div>
          <Button
            className="w-full"
            onClick={() => navigate({ to: "/result/$id", params: { id } })}
          >
            Continue
          </Button>
        </Card>
        </motion.div>
      </div>
    );
  }

  if (isSurvival && survivalOver && survivalResult) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0, y: 14, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="max-w-md w-full"
        >
        <Card className="p-8 w-full text-center">
          <h1 className="font-display text-3xl font-semibold mb-2">Game Over</h1>
          {survivalResult.isNewBest && (
            <p className="text-primary font-semibold mb-2">New Best!</p>
          )}
          <div className="grid grid-cols-2 gap-4 my-6">
            <div>
              <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                Current Run
              </div>
              <div className="font-display text-3xl nums mt-1">{survivalResult.run}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                Best Run
              </div>
              <div className="font-display text-3xl nums mt-1">{survivalResult.best}</div>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Button onClick={() => navigate({ to: "/new", search: { mode: "survival" } })}>
              Play Again
            </Button>
            <Button variant="ghost" onClick={() => navigate({ to: "/quiz-modes" })}>
              Back to Quiz Modes
            </Button>
          </div>
        </Card>
        </motion.div>
      </div>
    );
  }

  const total = quiz.question_count;
  const prevAnswer = quiz.answers[idx];
  const picked = selected ?? prevAnswer;
  // Timed exam: never reveal correctness while the exam is in progress, so
  // options stay clickable (the answer can be changed) with no colour cues.
  const isRevealed = isTimed ? false : revealed || prevAnswer != null;

  // Centralized Survival Mode handling: one dispatch point, one place that
  // knows the Survival rules. Classic's pick() below is untouched.
  const endSurvivalRun = (run: number) => {
    const { best, isNewBest } = api.recordSurvivalRun(run);
    setSurvivalResult({ run, best, isNewBest });
    setSurvivalOver(true);
  };

  const survivalPick = (i: number) => {
    if (isRevealed || survivalOver) return;
    const flushed = flushElapsed(quiz);
    activeIndicesRef.current.delete(idx);

    setSelected(i);

    const alreadyAnswered = flushed.answers[idx] != null;
    const nextAnswers = [...flushed.answers];
    nextAnswers[idx] = i;
    const updated: Quiz = {
      ...flushed,
      answers: nextAnswers,
      current_index: Math.max(flushed.current_index, idx),
    };
    api.saveQuiz(updated);
    setQuiz(updated);

    const correct = i === q.answerIndex;

    // Wrong answer is immediate failure — one life, no continuing.
    if (!correct) {
      playSound("wrong");
      api.recordWrong(q, quiz.title);
      endSurvivalRun(idx);
      return;
    }

    playSound("correct");
    api.clearWrong(q);
    if (!alreadyAnswered) api.bumpSolved(1);

    // Correct answers transition directly to the next question — no
    // reveal state, no explanation, no Next button, no delay.
    if (idx + 1 >= total) {
      endSurvivalRun(idx + 1);
      return;
    }
    syncNow();
    const nx = idx + 1;
    const upd = { ...updated, current_index: Math.max(updated.current_index, nx) };
    api.saveQuiz(upd);
    setQuiz(upd);
    setIdx(nx);
  };

  // Timed UPSC Exam: selecting an option only records the answer — no
  // reveal, no correct/wrong sound, no explanation, and it can be changed
  // freely before moving on, exactly like a real exam. Wrong/streak
  // bookkeeping is deferred entirely to submitExam() so nothing about
  // correctness leaks while the exam is in progress.
  const timedPick = (i: number) => {
    if (submittedRef.current) return;
    const flushed = flushElapsed(quiz);
    setSelected(i);
    const nextAnswers = [...flushed.answers];
    nextAnswers[idx] = i;
    const updated: Quiz = {
      ...flushed,
      answers: nextAnswers,
      current_index: Math.max(flushed.current_index, idx),
    };
    api.saveQuiz(updated);
    setQuiz(updated);
  };

  // Grades every answered question at once, applies the same negative
  // marking / wrong-answer / streak bookkeeping Classic Quiz uses per pick,
  // marks the quiz completed, then hands off to the existing results page —
  // which is the only place explanations/correct answers are revealed.
  // (submitExam itself is defined earlier, before the early-return guards,
  // so the countdown effect can call it safely.)

  const pick = (i: number) => {
    if (isSurvival) {
      survivalPick(i);
      return;
    }
    if (isTimed) {
      timedPick(i);
      return;
    }
    if (isRevealed) return;
    // Credit every active question (including this one) up to this exact
    // instant, then remove this question from the active set — its
    // recorded time is now frozen forever and will never change again,
    // regardless of future navigation.
    const flushed = flushElapsed(quiz);
    activeIndicesRef.current.delete(idx);

    setSelected(i);
    setRevealed(true);
    const alreadyAnswered = flushed.answers[idx] != null;
    const nextAnswers = [...flushed.answers];
    nextAnswers[idx] = i;
    const next: Quiz = {
      ...flushed,
      answers: nextAnswers,
      current_index: Math.max(flushed.current_index, idx),
    };
    if (i !== q.answerIndex) {
      playSound("wrong");
      api.recordWrong(q, quiz.title);
    } else {
      playSound("correct");
      api.clearWrong(q);
    }
    // Streak only on first-attempt correct.
    if (!alreadyAnswered && i === q.answerIndex) api.bumpSolved(1);
    api.saveQuiz(next);
    setQuiz(next);
  };

  const toggleBookmark = () => {
    // No dedicated bookmark sound exists yet — reusing click.mp3.
    playSound("click");
    api.toggleBookmark(q, quiz.title);
    setBmTick((t) => t + 1);
  };

  const saveToLibrary = () => {
    if (quiz.saved) {
      toast.info("This is already a saved quiz.");
      return;
    }
    syncNow();
    const snap = api.saveQuizToLibrary(quiz.id);
    if (snap) toast.success("Quiz saved to your library.");
    else toast.error("Couldn't save this quiz.");
  };

  const next = () => {
    // Sync before leaving, so the question we're leaving (if still
    // unanswered) reflects an up-to-the-second total rather than waiting
    // for the next periodic tick.
    syncNow();
    const cq = quizRef.current!;
    if (idx + 1 >= total) {
      playSound("quiz-complete");
      const done: Quiz = {
        ...cq,
        status: "completed",
        completed_at: Date.now(),
        current_index: total - 1,
      };
      api.saveQuiz(done);
      // Spaced Revision: a quiz launched from the Review button on the
      // Spaced Revision page (revisionReview === true) advances the
      // topic's revision schedule. Otherwise, the first successful
      // completion of a normal Classic Quiz for a topic that hasn't yet
      // entered the revision system starts its schedule (Day 1 due) —
      // this never happens for Marathon/Daily, and never re-triggers for
      // a topic that already has a TopicRevision.
      if (cq.topic_id && cq.status !== "completed") {
        if (cq.revisionReview) {
          const tr = api.markTopicRevised(cq.topic_id);
          if (tr) {
            setRevisionResult(tr);
            return;
          }
        } else if (cq.mode === "classic" || cq.mode == null) {
          api.beginTopicRevisionSchedule(cq.topic_id);
        }
      }
      navigate({ to: "/result/$id", params: { id } });
    } else {
      playSound("click");
      const nx = idx + 1;
      const upd = { ...cq, current_index: Math.max(cq.current_index, nx) };
      api.saveQuiz(upd);
      setQuiz(upd);
      setIdx(nx);
    }
  };

  const prev = () => {
    if (idx <= 0) return;
    syncNow();
    setIdx(idx - 1);
  };
  const answerIndex = q.answerIndex;

  return (
    <div className="min-h-screen">
      <header className="border-b border-border/60 bg-card/40">
        <div className="mx-auto max-w-3xl px-5 pt-6 pb-5">
          <div className="flex items-center justify-between gap-3">
            <Link
              to="/rewards"
              aria-label="Reward progress"
              className="inline-flex items-center gap-2.5 hover:opacity-80 transition"
            >
              <StreakRing rewardProgress={Math.min(rewardProgress, 125)} size={64} flameScale={0.5} />
              <span className="hidden sm:block font-display text-sm nums text-muted-foreground">
                {Math.min(rewardProgress, 125)}<span className="opacity-50">/125</span>
              </span>
            </Link>
            <div className="flex items-center gap-2 sm:gap-3">
              {isTimed ? (
                <span className="font-display text-sm nums text-muted-foreground">
                  {String(Math.floor(secondsLeft / 60)).padStart(2, "0")}:
                  {String(secondsLeft % 60).padStart(2, "0")}
                </span>
              ) : (
                <QuizTimer seconds={quiz.per_q_seconds?.[idx] ?? 0} />
              )}
              <span className="hidden sm:block h-5 w-px bg-border" aria-hidden="true" />
              <Button
                variant="ghost"
                size="sm"
                onClick={saveToLibrary}
                disabled={!!quiz.saved}
                aria-label="Save quiz"
                className="gap-1.5"
              >
                <Save className="h-4 w-4" />
                <span className="hidden sm:inline text-xs">
                  {quiz.saved ? "Saved" : "Save quiz"}
                </span>
              </Button>
            </div>
          </div>
          <div className="mt-5 flex items-baseline justify-between gap-3">
            <p className="text-primary font-display font-semibold tracking-tight truncate">
              {quiz.title}
            </p>
            <p className="text-sm text-muted-foreground shrink-0 nums font-medium">
              Q {idx + 1} / {total}
            </p>
          </div>
          <Progress value={((idx + (isRevealed ? 1 : 0)) / total) * 100} className="mt-3 h-1.5" />
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={`${quiz.id}:${idx}`}
            initial={prefersReducedMotion ? false : { opacity: 0, y: 10, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -10, scale: 0.99 }}
            transition={
              prefersReducedMotion
                ? { duration: 0 }
                : { type: "spring", stiffness: 300, damping: 30, mass: 0.9 }
            }
          >
            <Card className="p-6 sm:p-8">
              {q.difficulty && (
                <span
                  className={cn(
                    "mb-4 inline-block rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wide",
                    q.difficulty === "Easy" && "border-success/40 bg-success/10 text-success",
                    q.difficulty === "Medium" && "border-primary/40 bg-primary/10 text-primary",
                    q.difficulty === "Hard" &&
                      "border-destructive/40 bg-destructive/10 text-destructive",
                  )}
                >
                  {q.difficulty}
                </span>
              )}
              <div className="flex items-start justify-between gap-3">
                <div className="text-lg font-medium flex-1 font-display leading-snug">
                  <QuestionContent text={q.question} />
                </div>
                <Button size="icon" variant="ghost" onClick={toggleBookmark} aria-label="Bookmark">
                  <Bookmark className={cn("h-5 w-5", bookmarked && "fill-primary text-primary")} />
                </Button>
              </div>

              <div className="mt-8 space-y-3">
                {q.options.map((opt, i) => {
                  const isCorrect = i === answerIndex;
                  const isPicked = i === picked;
                  const showCorrect = isRevealed && isCorrect;
                  const showWrong = isRevealed && isPicked && !isCorrect;
                  // Timed UPSC Exam: never reveal correct/incorrect, but keep
                  // the user's chosen option highlighted (orange
                  // selected-answer styling) until they move to another
                  // question. `picked` already tracks per-question answers
                  // via quiz.answers[idx], so this persists across Prev/Next.
                  const showTimedPicked = isTimed && isPicked;
                  return (
                    <motion.button
                      key={i}
                      onClick={() => pick(i)}
                      disabled={isRevealed}
                      initial={false}
                      animate={
                        prefersReducedMotion
                          ? { scale: 1, x: 0 }
                          : showWrong
                          ? { x: [0, -6, 6, -4, 4, -2, 0], scale: 1 }
                          : isPicked && !isRevealed
                          ? { scale: [1, 0.98, 1.02, 1] }
                          : showCorrect
                          ? { scale: 1 }
                          : { scale: 1, x: 0 }
                      }
                      transition={
                        prefersReducedMotion
                          ? { duration: 0 }
                          : showWrong
                          ? { duration: 0.42, ease: "easeInOut" }
                          : { type: "spring", stiffness: 420, damping: 26 }
                      }
                      whileTap={!isRevealed && !prefersReducedMotion ? { scale: 0.985 } : undefined}
                      className={cn(
                        "flex w-full items-start gap-3 rounded-xl border border-border bg-background/30 px-5 py-3.5 text-left shadow-sm",
                        !isRevealed && "hover:border-primary/50 hover:bg-muted hover:shadow-md cursor-pointer",
                        showCorrect && "border-success/60 bg-success/10 shadow-[0_0_0_1px_hsl(var(--success)/0.4),0_0_18px_hsl(var(--success)/0.25)]",
                        showWrong && "border-destructive/60 bg-destructive/10",
                        showTimedPicked && "border-primary/60 bg-primary/10 shadow-[0_0_0_1px_hsl(var(--primary)/0.4),0_0_18px_hsl(var(--primary)/0.25)]",
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-sm font-semibold",
                          !isRevealed && !showTimedPicked && "border-border bg-muted",
                          showTimedPicked && "border-primary bg-primary/15 text-primary",
                          showCorrect && "border-success bg-success text-success-foreground",
                          showWrong &&
                            "border-destructive bg-destructive text-destructive-foreground",
                        )}
                      >
                        {showCorrect ? (
                          <Check className="h-4 w-4" />
                        ) : showWrong ? (
                          <X className="h-4 w-4" />
                        ) : (
                          String.fromCharCode(65 + i)
                        )}
                      </span>
                      <span className="text-sm leading-relaxed">{opt}</span>
                    </motion.button>
                  );
                })}
              </div>

              {/* Survival Mode has no Prev/Skip/Next controls at all — the
                  Skip action is fully disabled, not just guarded, so a run
                  can never end from an accidental tap. */}
              {!isSurvival && (
                <div className="mt-5 mb-5 flex justify-between">
  <motion.div whileTap={prefersReducedMotion ? undefined : { scale: 0.96 }} className="inline-block">
    <Button variant="ghost" onClick={prev} disabled={idx <= 0}>
      <ArrowLeft className="mr-2 h-4 w-4" /> Prev
    </Button>
  </motion.div>
  <motion.div whileTap={prefersReducedMotion ? undefined : { scale: 0.96 }} className="inline-block">
    <Button onClick={isTimed && idx + 1 === total ? submitExam : next}>
      {isTimed && idx + 1 === total ? "Submit Exam" : idx + 1 === total ? "Finish quiz" : "Next"}
      <ArrowRight className="ml-2 h-4 w-4" />
    </Button>
  </motion.div>
</div>
              )}

{!isSurvival && isRevealed && q.explanation && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25 }}
                  className="mt-5"
                >
                  <ExplanationDisplay text={q.explanation} />
                </motion.div>
              )}
            </Card>
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}