import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { api } from "@/lib/store";
import { isCoreSubjectId } from "@/domain/subjects";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  ArrowLeft,
  Plus,
  Eye,
  EyeOff,
  Pencil,
  Trash2,
  ChevronDown,
  FileText,
  Check,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { FixedBackground } from "@/components/fixed-background";

export const Route = createFileRoute("/subjects")({
  ssr: false,
  head: () => ({ meta: [{ title: "All Subjects — UPSC Revision" }] }),
  component: SubjectsPage,
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

function SubjectsPage() {
  useTick();
  const subjects = api.allSubjects();
  const [newName, setNewName] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [editingSubject, setEditingSubject] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const addSubject = () => {
    if (!newName.trim()) return;
    api.ensureSubject(newName);
    setNewName("");
    toast.success("Subject added.");
  };

  return (
  <div className="relative min-h-dvh overflow-x-hidden">
    <FixedBackground
      src="/background.png"
      opacity={0.4}
      objectPosition="center center"
    />
      <header className="mx-auto max-w-3xl px-5 pt-8">
  <h1 className="mt-4 font-display text-3xl font-semibold">All subjects</h1>
  <p className="text-sm text-muted-foreground mt-1">
    Core subjects stay forever — they can be hidden but not deleted. Custom subjects are fully
    yours.
  </p>
</header>

      <main className="mx-auto max-w-3xl px-5 py-8 space-y-6">
        <Card className="p-4 flex gap-2">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Create a custom subject…"
            onKeyDown={(e) => e.key === "Enter" && addSubject()}
          />
          <Button onClick={addSubject}>
            <Plus className="h-4 w-4 mr-1" /> Add
          </Button>
        </Card>

        <div className="space-y-2">
          {subjects.map((s) => {
            const topics = api.topicsForSubject(s.id);
            const isOpen = openId === s.id;
            const isCore = isCoreSubjectId(s.id);
            const isEditing = editingSubject === s.id;
            return (
              <Card key={s.id} id={s.id} className="overflow-hidden">
                <Collapsible open={isOpen} onOpenChange={(o) => setOpenId(o ? s.id : null)}>
                  <div className="flex items-center gap-2 p-4">
                    <CollapsibleTrigger className="flex-1 flex items-center gap-3 text-left cursor-pointer">
                      <ChevronDown
                        className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`}
                      />
                      {isEditing ? (
                        <Input
                          autoFocus
                          value={editName}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => {
                            e.stopPropagation();
                            if (e.key === "Enter") {
                              api.renameSubject(s.id, editName);
                              setEditingSubject(null);
                            }
                            if (e.key === "Escape") setEditingSubject(null);
                          }}
                          className="h-8"
                        />
                      ) : (
                        <div>
                          <div className="font-medium">{s.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {isCore ? "Core" : "Custom"} · {topics.length} topic
                            {topics.length === 1 ? "" : "s"}
                            {s.hidden ? " · hidden from home" : ""}
                          </div>
                        </div>
                      )}
                    </CollapsibleTrigger>

                    <div className="flex items-center gap-1">
                      {isEditing ? (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              api.renameSubject(s.id, editName);
                              setEditingSubject(null);
                            }}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setEditingSubject(null)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={s.hidden ? "Unhide" : "Hide"}
                            onClick={() => api.toggleSubjectHidden(s.id)}
                          >
                            {s.hidden ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Rename"
                            onClick={() => {
                              setEditingSubject(s.id);
                              setEditName(s.name);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          {!isCore && (
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label="Delete"
                              onClick={() => {
                                if (confirm(`Delete "${s.name}" with all its topics and notes?`)) {
                                  try {
                                    api.deleteSubject(s.id);
                                    toast.success("Deleted.");
                                  } catch (e) {
                                    toast.error(e instanceof Error ? e.message : "Failed");
                                  }
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  <CollapsibleContent>
                    <div className="border-t border-border px-4 py-3 bg-background/40">
                      {topics.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-2">
                          No topics yet. Create a quiz from this subject to start adding knowledge.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {topics.map((t) => (
                            <TopicRow key={t.id} topicId={t.id} name={t.name} />
                          ))}
                        </div>
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            );
          })}
        </div>
      </main>
    </div>
  );
}

function TopicRow({ topicId, name }: { topicId: string; name: string }) {
  const notes = api.notesForTopic(topicId);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(name);

  return (
    <div className="rounded-lg border border-border bg-card/60">
      <div className="flex items-center gap-2 px-3 py-2">
        <button
          className="flex-1 flex items-center gap-2 text-left cursor-pointer"
          onClick={() => setOpen((o) => !o)}
        >
          <ChevronDown
            className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
          />
          {editing ? (
            <Input
              autoFocus
              value={val}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => setVal(e.target.value)}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Enter") {
                  api.renameTopic(topicId, val);
                  setEditing(false);
                }
                if (e.key === "Escape") setEditing(false);
              }}
              className="h-7"
            />
          ) : (
            <div className="text-sm">
              <span className="font-medium">{name}</span>
              <span className="ml-2 text-xs text-muted-foreground">
                {notes.length} note{notes.length === 1 ? "" : "s"}
              </span>
            </div>
          )}
        </button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            setEditing(true);
            setVal(name);
          }}
          aria-label="Rename topic"
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            if (confirm(`Delete topic "${name}" and its notes?`)) {
              api.deleteTopic(topicId);
              toast.success("Deleted.");
            }
          }}
          aria-label="Delete topic"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      {open && (
        <div className="border-t border-border px-3 py-2 space-y-2">
          {notes.length === 0 ? (
            <p className="text-xs text-muted-foreground">No notes stored yet.</p>
          ) : (
            notes.map((n) => (
              <div key={n.id} className="rounded-md bg-muted/40 p-2.5">
                <div className="flex items-center justify-between mb-1">
                  <span className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
                    <FileText className="h-3 w-3" /> {n.source} ·{" "}
                    {new Date(n.created_at).toLocaleDateString()}
                  </span>
                  <button
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => {
                      if (confirm("Delete this note?")) api.deleteNote(n.id);
                    }}
                    aria-label="Delete note"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <p className="text-xs whitespace-pre-wrap line-clamp-6 text-foreground/80">
                  {n.content}
                </p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
