import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { api, type Quiz } from "@/lib/store";
import { extractNotes, generateMCQs } from "@/lib/gemini";
import { normalizeName } from "@/domain/subjects";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Camera, FileText, ImagePlus, Loader2, Sparkles, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { LoadingScreen } from "@/components/loading-screen";
import { feedback, FEEDBACK } from "@/lib/feedback";

type NewQuizSearch = {
  subjectId?: string;
  topicId?: string;
  autoGenerate?: boolean;
};

export const Route = createFileRoute("/new")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): NewQuizSearch => ({
    subjectId: typeof search.subjectId === "string" ? search.subjectId : undefined,
    topicId: typeof search.topicId === "string" ? search.topicId : undefined,
  }),
  head: () => ({ meta: [{ title: "Generate Quiz — UPSC Revision" }] }),
  component: NewQuizPage,
});

const COUNTS = [10, 25, 50, 100] as const;
type Count = (typeof COUNTS)[number];
const NEW_VALUE = "__new__";

function fileToDataUrl(f: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = () => rej(r.error);
    r.readAsDataURL(f);
  });
}

function NewQuizPage() {
  const { subjectId: initialSubjectId, topicId: initialTopicId } = Route.useSearch();
  const navigate = useNavigate();
  const subjects = api.allSubjects();

  const [subjectId, setSubjectId] = useState<string>(initialSubjectId ?? "");
  const [newSubject, setNewSubject] = useState("");
  const [topicId, setTopicId] = useState<string>(
  initialTopicId === "__new__" ? NEW_VALUE : (initialTopicId ?? ""),
);
  const [newTopic, setNewTopic] = useState("");
  const [images, setImages] = useState<{ url: string; name: string }[]>([]);
  const [pdf, setPdf] = useState<{ url: string; name: string } | null>(null);
  const [textNote, setTextNote] = useState("");
  const [count, setCount] = useState<Count>(25);
  const [busy, setBusy] = useState<string | null>(null);

  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const pdfRef = useRef<HTMLInputElement>(null);

  const topics = useMemo(() => {
  if (!subjectId || subjectId === NEW_VALUE) return [];

  if (subjectId === "core-history") {
    return [
      { id: "core-modern-history", name: "Modern Indian History" },
      { id: "core-medieval-history", name: "Medieval Indian History" },
      { id: "core-ancient-history", name: "Ancient Indian History" },
    ];
  }

  if (subjectId === "core-art-culture") {
    return [
      { id: "core-indian-dances", name: "Indian Classical & Folk Dances" },
      { id: "core-indian-temples", name: "Indian Temples" },
    ];
  }

  return api.topicsForSubject(subjectId);
}, [subjectId]);

  const handleFiles = async (fl: FileList | null) => {
    if (!fl) return;
    const arr = Array.from(fl).slice(0, 8 - images.length);
    const mapped = await Promise.all(
      arr.map(async (f) => ({ url: await fileToDataUrl(f), name: f.name })),
    );
    setImages((prev) => [...prev, ...mapped].slice(0, 8));
  };

  const handlePdf = async (fl: FileList | null) => {
    if (!fl || !fl[0]) return;
    setPdf({ url: await fileToDataUrl(fl[0]), name: fl[0].name });
  };

  const resolveSubject = () => {
    if (subjectId && subjectId !== NEW_VALUE)
      return api.allSubjects().find((s) => s.id === subjectId) ?? null;
    if (newSubject.trim()) return api.ensureSubject(newSubject);
    return null;
  };
  const resolveTopic = (subId: string) => {
    if (topicId && topicId !== NEW_VALUE) {
      const found = api.topicsForSubject(subId).find((t) => t.id === topicId);
      if (found) return found;
    }
    const name = newTopic.trim();
    if (!name) return null;
    // Case-insensitive dedupe: reuse an existing topic with the same normalised name.
    const existing = api
      .topicsForSubject(subId)
      .find((t) => normalizeName(t.name) === normalizeName(name));
    if (existing) return existing;
    return api.ensureTopic(subId, name);
  };

  const generate = async () => {
    if (!api.getApiKey()) {
      toast.error("Add your Gemini API key in Settings first.");
      return;
    }
    const sub = resolveSubject();
    if (!sub) {
      toast.error("Pick or create a subject.");
      return;
    }
    const topic = resolveTopic(sub.id);
    if (!topic) {
      toast.error("Pick or create a topic.");
      return;
    }

    const hasNewMaterial = images.length || pdf || textNote.trim();
    if (!hasNewMaterial && api.notesForTopic(topic.id).length === 0) {
      toast.error("Add photos, a PDF, or text first.");
      return;
    }

    try {
      if (hasNewMaterial) {
        setBusy("Reading your notes with Gemini…");
        feedback(FEEDBACK.LOADING);
        const combined = await extractNotes({
          images: images.length ? images.map((i) => i.url) : undefined,
          pdf: pdf?.url,
          text: textNote.trim() || undefined,
        });
        if (combined.trim()) {
          const src = images.length ? "image" : pdf ? "pdf" : "text";
          api.addNote(topic.id, combined, src);
        }
      }

      const notes = api
        .notesForTopic(topic.id)
        .map((n) => n.content)
        .join("\n\n---\n\n");
      if (!notes.trim()) throw new Error("No notes stored for this topic yet.");

      setBusy(`Generating ${count} UPSC MCQs…`);
      feedback(FEEDBACK.LOADING);
      const questions = await generateMCQs({
        notes,
        count,
        topicName: `${sub.name} — ${topic.name}`,
      });

      const quiz: Quiz = {
        id: crypto.randomUUID(),
        title: `${sub.name} — ${topic.name}`,
        subject_id: sub.id,
        topic_id: topic.id,
        question_count: questions.length,
        questions,
        answers: new Array(questions.length).fill(null),
        per_q_seconds: new Array(questions.length).fill(0),
        current_index: 0,
        status: "in_progress",
        created_at: Date.now(),
      };
      api.saveQuiz(quiz);
      setBusy(null);
      navigate({ to: "/quiz/$id", params: { id: quiz.id } });
    } catch (e) {
      setBusy(null);
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  if (busy) {
  return <LoadingScreen />;
}

return (
  <div className="min-h-screen">
      <header className="mx-auto max-w-3xl px-5 pt-8">
        <h1 className="mt-4 font-display text-3xl font-semibold">Generate quiz</h1>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-8 space-y-5">
        <Card className="p-5 space-y-4">
          <h2 className="font-semibold">Subject &amp; topic</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Subject</label>
              <Select
                value={subjectId}
                onValueChange={(v) => {
                  setSubjectId(v);
                  setTopicId("");
                  setNewTopic("");
                }}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Choose subject" />
                </SelectTrigger>
                <SelectContent>
                  {subjects
  .filter(
    (s) =>
      s.id !== "core-history" &&
      s.id !== "core-art-culture"
  )
  .map((s) => (
    <SelectItem key={s.id} value={s.id}>
      {s.name}
    </SelectItem>
  ))}
                  <SelectItem value={NEW_VALUE}>+ Create new subject…</SelectItem>
                </SelectContent>
              </Select>
              {subjectId === NEW_VALUE && (
                <Input
                  className="mt-2"
                  autoFocus
                  placeholder="New subject name"
                  value={newSubject}
                  onChange={(e) => setNewSubject(e.target.value)}
                />
              )}
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Topic</label>
              <Select value={topicId} onValueChange={(v) => setTopicId(v)} disabled={!subjectId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder={subjectId ? "Choose topic" : "Pick a subject first"} />
                </SelectTrigger>
                <SelectContent>
                  {topics.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                  {subjectId !== "core-history" && subjectId !== "core-art-culture" && (
  <SelectItem value={NEW_VALUE}>+ Create new topic…</SelectItem>
)}
                </SelectContent>
              </Select>
              {topicId === NEW_VALUE && (
                <Input
                  className="mt-2"
                  autoFocus
                  placeholder="New topic name"
                  value={newTopic}
                  onChange={(e) => setNewTopic(e.target.value)}
                />
              )}
            </div>
          </div>
        </Card>

        <Card className="p-5 space-y-4">
          <h2 className="font-semibold">Add notes</h2>
          <div className="grid grid-cols-3 gap-2">
            <Button variant="secondary" onClick={() => cameraRef.current?.click()}>
              <Camera className="h-4 w-4 mr-2" /> Camera
            </Button>
            <Button variant="secondary" onClick={() => galleryRef.current?.click()}>
              <ImagePlus className="h-4 w-4 mr-2" /> Images
            </Button>
            <Button variant="secondary" onClick={() => pdfRef.current?.click()}>
              <FileText className="h-4 w-4 mr-2" /> PDF
            </Button>
          </div>

          {images.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {images.map((img, i) => (
                <div
                  key={i}
                  className="relative aspect-square rounded-lg overflow-hidden border border-border"
                >
                  <img src={img.url} alt={img.name} className="h-full w-full object-cover" />
                  <button
                    className="absolute top-1 right-1 bg-background/90 rounded-full p-0.5"
                    onClick={() => setImages(images.filter((_, idx) => idx !== i))}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {pdf && (
            <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm">
              <FileText className="h-4 w-4" />
              <span className="flex-1 truncate">{pdf.name}</span>
              <button onClick={() => setPdf(null)}>
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          )}

          <div>
            <label className="text-xs text-muted-foreground">Or paste text</label>
            <Textarea
              value={textNote}
              onChange={(e) => setTextNote(e.target.value)}
              placeholder="Paste or type your notes here…"
              rows={5}
              className="mt-1"
            />
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="font-semibold mb-3">Number of questions</h2>
          <div className="flex flex-wrap gap-2 mb-4">
            {COUNTS.map((c) => (
              <Button
                key={c}
                size="sm"
                variant={c === count ? "default" : "secondary"}
                onClick={() => setCount(c)}
              >
                {c}
              </Button>
            ))}
          </div>
          <Button className="w-full" disabled={!!busy} onClick={generate}>
            {busy ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            {busy ?? `Generate ${count} questions`}
          </Button>
          <p className="mt-3 text-xs text-muted-foreground text-center">
            UPSC scoring: +2 correct, −0.66 wrong.
          </p>
        </Card>

        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <input
          ref={galleryRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <input
          ref={pdfRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => handlePdf(e.target.files)}
        />
      </main>
    </div>
  );
}
