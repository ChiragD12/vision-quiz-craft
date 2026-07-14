import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { api, type MCQ, type Quiz } from "@/lib/store";
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

function QuizPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [quiz, setQuiz] = useState<Quiz | undefined>(() => api.getQuiz(id));
  const [idx, setIdx] = useState<number>(() => quiz?.current_index ?? 0);
  const [selected, setSelected] = useState<number | null>(null);
  const [revealed, setRevealed] = useState<boolean>(false);
  const [bmTick, setBmTick] = useState(0);
  const [rewardProgress, setRewardProgress] = useState<number>(() => api.correctSinceReward());
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

  const total = quiz.question_count;
  const prevAnswer = quiz.answers[idx];
  const picked = selected ?? prevAnswer;
  const isRevealed = revealed || prevAnswer != null;

  const pick = (i: number) => {
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
              <QuizTimer seconds={quiz.per_q_seconds?.[idx] ?? 0} />
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
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
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
                  return (
                    <motion.button
                      key={i}
                      onClick={() => pick(i)}
                      disabled={isRevealed}
                      initial={false}
                      animate={
                        showWrong
                          ? { x: [0, -6, 6, -4, 4, -2, 0], scale: 1 }
                          : isPicked && !isRevealed
                          ? { scale: [1, 0.98, 1.02, 1] }
                          : showCorrect
                          ? { scale: 1 }
                          : { scale: 1, x: 0 }
                      }
                      transition={
                        showWrong
                          ? { duration: 0.42, ease: "easeInOut" }
                          : { duration: 0.3, ease: [0.22, 1, 0.36, 1] }
                      }
                      whileTap={!isRevealed ? { scale: 0.985 } : undefined}
                      className={cn(
                        "flex w-full items-start gap-3 rounded-xl border border-border bg-background/30 px-5 py-3.5 text-left shadow-sm transition-colors",
                        !isRevealed && "hover:border-primary/50 hover:bg-muted hover:shadow-md cursor-pointer",
                        showCorrect && "border-success/60 bg-success/10 shadow-[0_0_0_1px_hsl(var(--success)/0.4),0_0_18px_hsl(var(--success)/0.25)]",
                        showWrong && "border-destructive/60 bg-destructive/10",
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-sm font-semibold",
                          !isRevealed && "border-border bg-muted",
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

              <div className="mt-5 mb-5 flex justify-between">
  <Button variant="ghost" onClick={prev} disabled={idx <= 0}>
    <ArrowLeft className="mr-2 h-4 w-4" /> Prev
  </Button>
  <Button onClick={next}>
    {idx + 1 === total ? "Finish quiz" : "Next"}
    <ArrowRight className="ml-2 h-4 w-4" />
  </Button>
</div>

{isRevealed && q.explanation && (
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
