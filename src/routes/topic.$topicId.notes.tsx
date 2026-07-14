import { useState, useMemo, useRef } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { api } from "@/lib/store";
import { importNotes } from "@/lib/notes-extraction";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Save, Camera, ImagePlus, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { LoadingScreen } from "@/components/loading-screen";

export const Route = createFileRoute("/topic/$topicId/notes")({
  component: TopicNotesPage,
});

function fileToDataUrl(f: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = () => rej(r.error);
    r.readAsDataURL(f);
  });
}

function TopicNotesPage() {
  const { topicId } = Route.useParams();
  const navigate = useNavigate();
  const subjects = api.allSubjects();

  const topic = subjects.flatMap((s) => api.topicsForSubject(s.id)).find((t) => t.id === topicId);
  const subject = topic ? subjects.find((s) => s.id === topic.subject_id) : null;
  const allNotes = api.notesForTopic(topicId);

  const aggregatedContent = useMemo(() => {
    return allNotes.map((n) => n.content).join("\n\n---\n\n");
  }, [allNotes]);

  const [content, setContent] = useState(aggregatedContent);
  const [busy, setBusy] = useState<string | null>(null);

  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const pdfRef = useRef<HTMLInputElement>(null);

  const handleExtraction = async (input: { images?: string[]; pdf?: string }) => {
    setBusy("Extracting text with Gemini…");
    try {
      const extracted = await importNotes(input);
      if (extracted.trim()) {
        setContent((prev) => (prev ? `${prev}\n\n${extracted}` : extracted));
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to extract text");
    } finally {
      setBusy(null);
    }
  };

  const handleFiles = async (fl: FileList | null, type: "image" | "pdf") => {
    if (!fl) return;
    if (type === "image") {
      const urls = await Promise.all(Array.from(fl).map(fileToDataUrl));
      await handleExtraction({ images: urls });
    } else {
      const url = await fileToDataUrl(fl[0]);
      await handleExtraction({ pdf: url });
    }
  };

  const saveNotes = () => {
    setBusy("Saving notes...");
    allNotes.forEach((n) => api.deleteNote(n.id));
    api.addNote(topicId, content, "text");

    toast.success("Notes saved.");
    navigate({ to: "/subject/$id", params: { id: subject?.id || "" }, replace: true });
  };

  if (!topic || !subject) {
    return (
      <div className="min-h-screen p-10 text-center">
        <h1 className="text-2xl font-bold">Topic not found</h1>
        <Button asChild className="mt-4">
          <Link to="/">Back home</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {busy && <LoadingScreen mode="notes" />}
      <header className="border-b border-border/60 bg-card/40">
        <div className="mx-auto max-w-3xl px-5 pt-8 pb-6">
          <Button
            variant="ghost"
            size="sm"
            className="-ml-4 mb-3"
            onClick={() => {
  if (window.history.length > 1) {
    window.history.back();
  } else {
    navigate({
      to: "/subject/$id",
      params: { id: subject.id },
    });
  }
}}
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
          </Button>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {subject.name}
              </p>
              <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight">
                {topic.name}
              </h1>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-8 space-y-6">
        <div className="rounded-xl border border-border/60 bg-card/60 p-3 shadow-sm">
          <p className="mb-2 px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Import notes
          </p>
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
        </div>

        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Enter your notes here..."
          className="min-h-[400px] w-full rounded-xl border-border/60 bg-card/80 p-5 shadow-md"
        />
        <div className="grid grid-cols-2 gap-3 pt-1">
  <Button onClick={saveNotes}>
    <Save className="mr-2 h-4 w-4" />
    Save Notes
  </Button>

  <Button
    onClick={() => {
      saveNotes();
      navigate({
        to: "/new",
        search: {
          subjectId: subject.id,
          topicId: topic.id,
        },
      });
    }}
  >
    Generate Quiz
  </Button>
</div>

        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files, "image")}
        />
        <input
          ref={galleryRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files, "image")}
        />
        <input
          ref={pdfRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files, "pdf")}
        />
      </main>
    </div>
  );
}
