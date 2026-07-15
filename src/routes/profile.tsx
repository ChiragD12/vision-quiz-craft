import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppBackground } from "@/components/app-background";
import { Card } from "@/components/ui/card";
import { api } from "@/lib/store";
import {
  currentChapter,
  currentLion,
  storyById,
  chapterProgress,
  TOTAL_STORY_IMAGES,
  JOURNEY_ACHIEVEMENTS,
  unlockedWallpapers,
} from "@/lib/journey";
import { lionAvatarUrl, storyImageUrl } from "@/lib/journey/assets";
import { Trophy, Sparkles, Award, BookOpen, Image as ImageIcon } from "lucide-react";

export const Route = createFileRoute("/profile")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Profile — UPSC Revision" },
      { name: "description", content: "Your hero, journey, achievements and progress." },
    ],
  }),
  component: ProfilePage,
});

function useDBTick() {
  const [, setT] = useState(0);
  useEffect(() => {
    const cb = () => setT((n) => n + 1);
    window.addEventListener("upsc-db-change", cb);
    return () => window.removeEventListener("upsc-db-change", cb);
  }, []);
}

function ProfilePage() {
  useDBTick();
  const unlockCount = api.unlockedImageCount();
  const rewardProgress = api.correctSinceReward();
  const lion = currentLion(unlockCount);
  const chapter = currentChapter(unlockCount);
  const story = unlockCount > 0 ? storyById(unlockCount) : undefined;
  const heroUrl = story ? storyImageUrl(story.id) : undefined;
  const progress = chapter
    ? chapterProgress(chapter, unlockCount)
    : { unlocked: 0, total: 0, complete: false };
  const wallpapers = unlockedWallpapers(unlockCount);
  const unlockedAch = api.getAchievements();

  // Aggregate lifetime correct answers from all quizzes.
  const quizzes = api.recentQuizzes(9999);
  const lifetimeCorrect = quizzes.reduce((sum, q) => {
    return (
      sum +
      q.questions.reduce(
        (n, qq, i) => n + (q.answers[i] === qq.answerIndex ? 1 : 0),
        0,
      )
    );
  }, 0);
  const lifetimeAttempted = quizzes.reduce((sum, q) => {
    return sum + q.answers.filter((a) => a != null).length;
  }, 0);
  const accuracy =
    lifetimeAttempted > 0
      ? Math.round((lifetimeCorrect / lifetimeAttempted) * 100)
      : 0;

  return (
    <div className="relative min-h-dvh overflow-x-hidden">
      <AppBackground />
      <div className="mx-auto max-w-4xl px-5 pt-20 pb-16 space-y-6">
        <header className="page-header-card">
          <h1 className="font-display text-3xl font-semibold tracking-tight">Profile</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Your hero, your journey, your milestones.
          </p>
        </header>

        {/* Hero panel */}
        <Card className="p-6 shadow-sm overflow-hidden relative">
          {heroUrl && (
            <div
              className="absolute inset-0 opacity-30"
              style={{
                backgroundImage: `url(${heroUrl})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                filter: "blur(2px)",
              }}
            />
          )}
          <div className="relative flex items-center gap-5">
            <img
              src={lionAvatarUrl(lion.id)}
              alt={lion.name}
              className="h-24 w-24 rounded-full object-cover border border-primary/40 shadow-lg"
              draggable={false}
            />
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-[0.2em] text-primary/80">Current Lion</div>
              <div className="font-display text-2xl font-semibold mt-0.5">{lion.name}</div>
              <div className="text-sm text-muted-foreground">{lion.english}</div>
            </div>
          </div>
        </Card>

        {/* Stats grid */}
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatTile label="Correct" value={lifetimeCorrect} />
          <StatTile label="Accuracy" value={`${accuracy}%`} />
          <StatTile label="Story Images" value={`${unlockCount}/${TOTAL_STORY_IMAGES}`} />
          <StatTile label="Next Reward" value={`${rewardProgress}/125`} />
        </section>

        {/* Chapter progress */}
        <Card className="p-5 shadow-sm">
          <div className="flex items-baseline justify-between">
            <div>
              <div className="text-[11px] uppercase tracking-[0.2em] text-primary/80">Current Chapter</div>
              <div className="font-display text-lg font-semibold mt-0.5">{chapter?.title ?? "—"}</div>
            </div>
            <div className="font-display text-sm nums text-muted-foreground">
              {progress.unlocked}/{progress.total}
            </div>
          </div>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-primary/10">
            <div
              className="h-full rounded-full bg-primary"
              style={{
                width: `${progress.total > 0 ? (progress.unlocked / progress.total) * 100 : 0}%`,
              }}
            />
          </div>
        </Card>

        {/* Achievements */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Award className="h-4 w-4 text-primary" />
            <h2 className="font-display text-lg font-semibold">Achievements</h2>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
            {JOURNEY_ACHIEVEMENTS.map((a) => {
              const unlocked = !!unlockedAch[a.id];
              return (
                <div
                  key={a.id}
                  className={`aspect-square rounded-2xl border p-3 flex flex-col items-center justify-center text-center ${
                    unlocked
                      ? "border-primary/40 bg-primary/5"
                      : "border-border/40 bg-muted/40 opacity-60"
                  }`}
                >
                  <Trophy className={`h-5 w-5 ${unlocked ? "text-primary" : "text-muted-foreground"}`} />
                  <div className="mt-1.5 text-[11px] font-semibold truncate w-full">{a.title}</div>
                  <div className="text-[9px] text-muted-foreground">Ch {a.chapterId}</div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Wallpapers */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <ImageIcon className="h-4 w-4 text-primary" />
            <h2 className="font-display text-lg font-semibold">Wallpapers</h2>
            <span className="ml-auto text-xs text-muted-foreground">
              {wallpapers.length} unlocked
            </span>
          </div>
          <Card className="p-4 text-sm text-muted-foreground shadow-sm">
            Manage active wallpaper in{" "}
            <Link to="/settings" className="text-primary hover:underline">
              Settings
            </Link>
            .
          </Card>
        </section>

        {/* Journey & Gallery quick links */}
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Link to="/gallery">
            <Card className="p-5 shadow-sm hover:border-primary/40 transition-all">
              <Sparkles className="h-5 w-5 text-primary mb-2" />
              <div className="font-semibold">Journey Gallery</div>
              <div className="text-xs text-muted-foreground mt-1">Every unlocked chapter scene</div>
            </Card>
          </Link>
          <Link to="/stats">
            <Card className="p-5 shadow-sm hover:border-primary/40 transition-all">
              <BookOpen className="h-5 w-5 text-primary mb-2" />
              <div className="font-semibold">Statistics</div>
              <div className="text-xs text-muted-foreground mt-1">Time & accuracy breakdown</div>
            </Card>
          </Link>
        </section>
      </div>
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string | number }) {
  return (
    <Card className="p-4 shadow-sm">
      <div className="text-[10px] uppercase tracking-[0.18em] text-primary/80">{label}</div>
      <div className="font-display text-xl font-semibold nums mt-1">{value}</div>
    </Card>
  );
}
