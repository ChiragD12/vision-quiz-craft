import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { api } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Trash2, BookmarkCheck, PlayCircle } from "lucide-react";
import { toast } from "sonner";
import { FixedBackground } from "@/components/fixed-background";

export const Route = createFileRoute("/saved")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Saved Quizzes — UPSC Revision" },
      {
        name: "description",
        content: "Your permanently saved quizzes — resume any of them exactly where you left off.",
      },
    ],
  }),
  component: SavedQuizzesPage,
});

function useTick() {
  const [t, setT] = useState(0);
  useEffect(() => {
    const cb = () => setT((x) => x + 1);
    window.addEventListener("upsc-db-change", cb);
    return () => window.removeEventListener("upsc-db-change", cb);
  }, []);
  return t;
}

function SavedQuizzesPage() {
  useTick();
  const navigate = useNavigate();
  const quizzes = api.savedQuizzes();
  const { subjects, topics } = api.listSubjectsAndTopics();

  const subjectName = (id?: string) =>
    id ? subjects.find((s) => s.id === id)?.name : undefined;
  const topicName = (id?: string) =>
    id ? topics.find((t) => t.id === id)?.name : undefined;

  const remove = (id: string, title: string) => {
    if (!confirm(`Delete saved quiz "${title}"?`)) return;
    api.deleteQuiz(id);
    toast.success("Saved quiz deleted.");
  };

  return (
    <div className="relative min-h-dvh overflow-x-hidden">
      <FixedBackground src="/background.png" opacity={0.4} objectPosition="center center" />
      <header className="mx-auto max-w-3xl px-5 pt-8">
        <Button asChild variant="ghost" size="sm">
          <Link to="/">
            <ArrowLeft className="mr-1 h-4 w-4" /> Home
          </Link>
        </Button>
        <h1 className="mt-4 font-display text-3xl font-semibold flex items-center gap-2">
          <BookmarkCheck className="h-6 w-6 text-primary" /> Saved Quizzes
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Tap a quiz to resume it exactly where it was saved.
        </p>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-8 space-y-3">
        {quizzes.length === 0 ? (
          <Card className="p-6 text-sm text-muted-foreground">
            Nothing saved yet. Open any quiz and tap “Save quiz” to keep it here forever.
          </Card>
        ) : (
          quizzes.map((q) => {
            const answered = q.answers.filter((a) => a != null).length;
            const skipped = q.answers.slice(0, q.current_index + 1).filter((a) => a == null).length;
            const subj = subjectName(q.subject_id);
            const top = topicName(q.topic_id);
            const savedAt = q.saved_at ?? q.created_at;
            return (
              <Card
                key={q.id}
                className="p-4 hover:border-primary/40 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <button
                    className="flex-1 text-left min-w-0"
                    onClick={() => navigate({ to: "/quiz/$id", params: { id: q.id } })}
                  >
                    <div className="font-medium truncate">{q.title}</div>
                    <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                      {subj && <span>{subj}</span>}
                      {top && <span>· {top}</span>}
                      <span>· {q.question_count} Qs</span>
                      <span>
                        · {answered} answered
                        {skipped > 0 ? `, ${skipped} skipped` : ""}
                      </span>
                      <span>
                        · {q.status === "completed" ? "Completed" : "In progress"}
                      </span>
                      <span>· saved {new Date(savedAt).toLocaleDateString()}</span>
                    </div>
                  </button>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Resume"
                      onClick={() => navigate({ to: "/quiz/$id", params: { id: q.id } })}
                    >
                      <PlayCircle className="h-5 w-5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Delete saved quiz"
                      onClick={() => remove(q.id, q.title)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </main>
    </div>
  );
}
