import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AppBackground } from "@/components/app-background";
import { JourneyHero } from "@/components/journey-hero";
import { api, type Quiz } from "@/lib/store";
import { generateFromExisting } from "@/lib/gemini";
import { StreakRing } from "@/components/streak-ring";
import { WallpaperSelector } from "@/components/wallpaper-selector";
import { feedback, FEEDBACK } from "@/lib/feedback";
import { startLoadingSound, stopLoadingSound } from "@/lib/sound-manager";
import {
  currentChapter,
  currentLion,
  storyById,
  chapterProgress,
} from "@/lib/journey";
import { storyImageUrl } from "@/lib/journey/assets";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  PlusCircle,
  Bookmark,
  XCircle,
  PlayCircle,
  Settings,
  Loader2,
  Sparkles,
  KeyRound,
  Layers,
  BarChart3,
  BookmarkCheck,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "UPSC Revision — Dashboard" },
      {
        name: "description",
        content:
          "Premium revision platform for UPSC and HPSC. Local-first, offline-first, private.",
      },
    ],
  }),
  component: HomePage,
});

function useDB() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const cb = () => setTick((t) => t + 1);
    window.addEventListener("upsc-db-change", cb);
    window.addEventListener("storage", cb);
    return () => {
      window.removeEventListener("upsc-db-change", cb);
      window.removeEventListener("storage", cb);
    };
  }, []);
  return tick;
}

function HomePage() {
  useDB();
  const navigate = useNavigate();

  const hasKey = !!api.getApiKey();
  const subjects = api.visibleSubjects();
  const counts = api.counts();
  const inProg = api.inProgressQuiz();
  const recent = api.recentQuizzes(5).filter((q) => q.status === "completed");
  const rewardProgress = api.correctSinceReward();
  const solvedToday = api.solvedToday();

// Journey selectors
const unlockCount = api.unlockedImageCount();

const lion = currentLion(unlockCount);
const chapter = currentChapter(unlockCount);
const journeyImage = unlockCount > 0 ? storyById(unlockCount) : undefined;
const journeyImageUrl = journeyImage
  ? storyImageUrl(journeyImage.id)
  : undefined;
const progress = chapter
  ? chapterProgress(chapter, unlockCount)
  : { unlocked: 0, total: 0, complete: false };

  const [journeyExpanded, setJourneyExpanded] = useState(false);
  const [practiceMode, setPracticeMode] = useState<"bookmarks" | "wrong" | null>(null);
  const [busy, setBusy] = useState(false);

  const startPractice = async () => {
    if (!practiceMode) return;
    setBusy(true);
    startLoadingSound();
    try {
      const pool = practiceMode === "bookmarks" ? api.bookmarkQuestions() : api.wrongQuestions();
      if (pool.length === 0)
        throw new Error(
          `No ${practiceMode === "bookmarks" ? "bookmarked" : "wrong"} questions yet.`,
        );
      const questions = await generateFromExisting({
        existing: pool,
        count: pool.length,
        mode: practiceMode,
      });
      const quiz: Quiz = {
        id: crypto.randomUUID(),
        title: practiceMode === "bookmarks" ? "Bookmarked practice" : "Wrong-answer revision",
        question_count: questions.length,
        questions,
        answers: new Array(questions.length).fill(null),
        per_q_seconds: new Array(questions.length).fill(0),
        current_index: 0,
        status: "in_progress",
        created_at: Date.now(),
      };
      api.saveQuiz(quiz);
      navigate({ to: "/quiz/$id", params: { id: quiz.id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      stopLoadingSound();
      setBusy(false);
    }
  };

  return (
    <div className="relative min-h-dvh overflow-x-hidden">
      <AppBackground
        objectPosition="center center"
        style={{ transform: "scale(0.96)", transformOrigin: "center center" }}
      />
      <header className="mx-auto max-w-4xl px-5 pt-8 sm:pt-12 pb-4">
  <div className="flex justify-end items-center gap-3 sm:gap-4">
    <Link
      to="/rewards"
      className="flex items-center gap-3 transition-opacity hover:opacity-75 cursor-pointer"
    >
      <StreakRing rewardProgress={rewardProgress} size={68} flameScale={0.5} />
      <div className="hidden sm:block">
        <div className="font-display text-2xl nums leading-none">{solvedToday}</div>
        <div className="text-[10px] uppercase tracking-[0.18em] text-amber-200/80 font-semibold mt-1">
          solved today
        </div>
      </div>
    </Link>

    <span className="hidden sm:block h-8 w-px bg-border/60" aria-hidden="true" />

    <div className="flex items-center gap-1">
      <Button asChild variant="ghost" size="icon" aria-label="Time statistics">
        <Link to="/stats">
          <BarChart3 className="h-5 w-5" />
        </Link>
      </Button>

      <Button asChild variant="ghost" size="icon" aria-label="Settings">
        <Link to="/settings">
          <Settings className="h-5 w-5" />
        </Link>
      </Button>
    </div>
  </div>
</header>

      <main className="mx-auto max-w-4xl px-5 pt-2 pb-10 space-y-8">
        <section>
          <JourneyHero
            expanded={journeyExpanded}
            onToggle={() =>
              setJourneyExpanded((v) => {
                const next = !v;
                if (next) feedback(FEEDBACK.LION_OPEN); // only on expand, not collapse
                return next;
              })
            }
            onDismiss={() => setJourneyExpanded(false)}
            lion={lion}
            chapter={chapter}
            unlockCount={unlockCount}
            progress={progress}
            rewardProgress={rewardProgress}
          />
        </section>

        {!hasKey && (
          <Card className="p-6 border-primary/30 bg-primary/5 shadow-sm">
            <div className="flex items-start gap-3">
              <KeyRound className="h-5 w-5 text-primary mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold">Add your Gemini API key to get started</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Free key at aistudio.google.com/apikey. It stays on this device — nothing leaves
                  without your key.
                </p>
                <Button asChild size="sm" className="mt-3">
                  <Link to="/settings">Open settings</Link>
                </Button>
              </div>
            </div>
          </Card>
        )}

        <section>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ActionCard
              onClick={() => {
                if (inProg) navigate({ to: "/quiz/$id", params: { id: inProg.id } });
                else toast.info("No quiz in progress.");
              }}
              icon={<PlayCircle className="h-5 w-5" />}
              title="Continue quiz"
              body={
                inProg
                  ? `${inProg.title} · Q${inProg.current_index + 1}/${inProg.question_count}`
                  : "Nothing paused right now."
              }
              accent={!!inProg}
            />
            <ActionCard
              to="/quiz-modes"
              icon={<PlusCircle className="h-5 w-5" />}
              title="Generate quiz"
              body="From your notes, or add new ones."
            />
            <ActionCard
              to="/saved"
              icon={<BookmarkCheck className="h-5 w-5" />}
              title="Saved Quizzes"
              body={`${api.savedQuizzes().length} in your library`}
            />
            <PracticeCard
              mode="bookmarks"
              icon={<Bookmark className="h-5 w-5" />}
              title="Bookmarks"
              body={`${counts.bookmarks} saved`}
              count={counts.bookmarks}
              active={practiceMode === "bookmarks"}
              busy={busy}
              onActivate={() => setPracticeMode("bookmarks")}
              onCancel={() => setPracticeMode(null)}
              onRetry={startPractice}
            />
            <PracticeCard
              mode="wrong"
              icon={<XCircle className="h-5 w-5" />}
              title="Wrong answers"
              body={`${counts.wrong} to revise`}
              count={counts.wrong}
              active={practiceMode === "wrong"}
              busy={busy}
              onActivate={() => setPracticeMode("wrong")}
              onCancel={() => setPracticeMode(null)}
              onRetry={startPractice}
            />
          </div>
        </section>

        <section>
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="font-display text-xl font-semibold">Subjects</h2>
            <Link
              to="/subjects"
              className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            >
              <Layers className="h-3.5 w-3.5" /> All subjects
            </Link>
          </div>
          {subjects.length === 0 ? (
            <Card className="p-6 text-sm text-muted-foreground shadow-sm">
              No subjects visible. Manage them in{" "}
              <Link to="/subjects" className="text-primary hover:underline">
                All subjects
              </Link>
              .
            </Card>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {subjects.map((s) => {
                const topics = api.topicsForSubject(s.id);
                return (
                  <Link key={s.id} to="/subject/$id" params={{ id: s.id }}>
                    <Card className="p-5 h-full shadow-sm hover:border-primary/40 hover:shadow-md transition-all">
                      <div className="font-medium truncate">{s.name}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {topics.length} topic{topics.length === 1 ? "" : "s"}
                      </div>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        {recent.length > 0 && (
          <section>
            <h2 className="font-display text-xl font-semibold mb-4">Recent</h2>
            <div className="space-y-3">
              {recent.map((q) => {
                const correct = q.questions.reduce(
                  (n, qq, i) => n + (q.answers[i] === qq.answerIndex ? 1 : 0),
                  0,
                );
                const wrong = q.questions.reduce(
                  (n, qq, i) =>
                    n + (q.answers[i] != null && q.answers[i] !== qq.answerIndex ? 1 : 0),
                  0,
                );
                const score = correct * 2 - wrong * 0.66;
                return (
                  <Link key={q.id} to="/result/$id" params={{ id: q.id }} className="block">
                    <Card className="p-5 shadow-sm hover:border-primary/40 hover:shadow-md transition-all">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-medium truncate">{q.title}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {q.question_count} Qs · {correct}✓ {wrong}✗
                          </div>
                        </div>
                        <div className="font-display text-lg nums text-primary">
                          {score.toFixed(1)}
                        </div>
                      </div>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        
      </main>

      <footer className="mx-auto max-w-4xl px-5 py-10 text-center text-xs text-muted-foreground">
        UPSC scoring: +2 correct · −0.66 wrong · Local-first · Offline-ready
      </footer>
    </div>
  );
}

function ActionCard({
  to,
  onClick,
  icon,
  title,
  body,
  accent,
}: {
  to?: string;
  onClick?: () => void;
  icon: React.ReactNode;
  title: string;
  body: string;
  accent?: boolean;
}) {
  const inner = (
    <Card
      className={`p-5 h-full shadow-sm transition-all hover:border-primary/40 hover:shadow-md hover:-translate-y-0.5 ${accent ? "border-primary/30" : ""}`}
    >
      <div className="flex items-center gap-2.5 mb-2 text-primary">
        {icon}
        <h3 className="font-semibold text-foreground">{title}</h3>
      </div>
      <p className="text-sm text-muted-foreground">{body}</p>
    </Card>
  );
  if (to)
    return (
      <Link to={to as any} className="block">
        {inner}
      </Link>
    );
  return (
    <button className="text-left w-full block" onClick={onClick}>
      {inner}
    </button>
  );
}

function PracticeCard({
  mode,
  icon,
  title,
  body,
  count,
  active,
  busy,
  onActivate,
  onCancel,
  onRetry,
}: {
  mode: "bookmarks" | "wrong";
  icon: React.ReactNode;
  title: string;
  body: string;
  count: number;
  active: boolean;
  busy: boolean;
  onActivate: () => void;
  onCancel: () => void;
  onRetry: () => void;
}) {
  return (
    <Card
      className={`p-5 h-full shadow-sm transition-all overflow-hidden ${active ? "border-primary/40" : "hover:border-primary/40 hover:shadow-md hover:-translate-y-0.5"}`}
    >
      <motion.div layout="position" transition={{ duration: 0.2 }}>
        <AnimatePresence mode="wait" initial={false}>
          {!active ? (
            <motion.button
              key="default"
              type="button"
              className="text-left w-full block"
              onClick={onActivate}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <div className="flex items-center gap-2.5 mb-2 text-primary">
                {icon}
                <h3 className="font-semibold text-foreground">{title}</h3>
              </div>
              <p className="text-sm text-muted-foreground">{body}</p>
            </motion.button>
          ) : (
            <motion.div
              key="confirm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <h3 className="font-semibold text-foreground">
                Retry {mode === "bookmarks" ? "bookmarked" : "wrong"} questions
              </h3>
              <p className="text-sm text-muted-foreground mt-1 mb-4">
                {mode === "bookmarks"
                  ? `${count} bookmarked questions available`
                  : `${count} wrong questions available`}
              </p>
              <div className="flex gap-2">
                <Button onClick={onRetry} disabled={busy || count === 0}>
                  {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <Sparkles className="mr-2 h-4 w-4" />
                  Retry
                </Button>
                <Button variant="ghost" onClick={onCancel}>
                  Cancel
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </Card>
  );
}