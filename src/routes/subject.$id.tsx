import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, FileText, PlusCircle, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { FixedBackground } from "@/components/fixed-background";

export const Route = createFileRoute("/subject/$id")({
  component: SubjectPage,
});

function SubjectPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const subjects = api.allSubjects();
  const subject = subjects.find((s) => s.id === id);
  const historySections = [
  { id: "core-modern-history", name: "Modern Indian History" },
  { id: "core-medieval-history", name: "Medieval Indian History" },
  { id: "core-ancient-history", name: "Ancient Indian History" },
];

const artCultureSections = [
  { id: "core-indian-dances", name: "Indian Classical & Folk Dances" },
  { id: "core-indian-temples", name: "Indian Temples" },
];

const isHistoryHub = id === "core-history";
const isArtCultureHub = id === "core-art-culture";

const hubBuiltinIds = new Set([
  ...historySections.map((s) => s.id),
  ...artCultureSections.map((s) => s.id),
]);

const topics = isHistoryHub
  ? [...historySections, ...api.topicsForSubject(id)]
  : isArtCultureHub
    ? [...artCultureSections, ...api.topicsForSubject(id)]
    : api.topicsForSubject(id);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (!subject) {
    return (
      <div className="min-h-screen p-10 text-center">
        <h1 className="text-2xl font-bold">Subject not found</h1>
        <Button asChild className="mt-4">
          <Link to="/">Back home</Link>
        </Button>
      </div>
    );
  }

  const toggleTopic = (topicId: string) => {
    setExpandedId(expandedId === topicId ? null : topicId);
  };
  const goBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      window.history.back();
    } else {
      navigate({ to: "/" });
    }
  };
const backgroundSrc =
  id === "core-history"
    ? "/backgrounds/indian-history-bg.png"
    : id === "core-modern-history"
      ? "/backgrounds/modern-history-bg.png"
      : id === "core-medieval-history"
        ? "/backgrounds/medieval-history-bg.png"
        : id === "core-ancient-history"
          ? "/backgrounds/ancient-history-bg.png"
          : id === "core-indian-dances"
            ? "/backgrounds/indian-dances-bg.png"
            : id === "core-indian-temples"
              ? "/backgrounds/indian-temples-bg.png"
              : id === "core-polity"
                ? "/backgrounds/polity-bg.png"
                : id === "core-geography"
                  ? "/backgrounds/geo-bg.png"
                  : id === "core-economy"
                    ? "/backgrounds/econ-bg.png"
                    : id === "core-general-science"
                      ? "/backgrounds/st-bg.png"
                      : id === "core-art-culture"
                        ? "/backgrounds/artncul-bg.png"
                        : id === "core-current-affairs"
                          ? "/backgrounds/current-affairs-bg.png"
                          : "/background.png";
  return (
  <div className="relative min-h-dvh overflow-x-hidden">
  <FixedBackground
  src={backgroundSrc}
  opacity={0.4}
  objectPosition={
    backgroundSrc === "/background.png"
      ? "center center"
      : "center 10%"
  }
/>
      <header className="mx-auto max-w-4xl px-5 pt-8 sm:pt-12">
        <Button
          variant="ghost"
          size="sm"
          className="-ml-4 mb-2"
          onClick={goBack}
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <h1 className="font-display text-3xl font-semibold">
  {subject.name}
</h1>

        <Button
  className="mt-4"
  onClick={() =>
    navigate({
      to: "/add-topic",
      search: {
        subjectId: id,
      },
    })
  }
>
  + Add Topic
</Button>
      </header>

      <main className="mx-auto max-w-4xl px-5 py-10 space-y-10">
        {topics.length === 0 && id !== "core-history" && id !== "core-art-culture" ? (
          <Card className="p-6 text-sm text-muted-foreground">No topics yet.</Card>
        ) : (
          <div className="space-y-3">
            {topics.map((t) => {
              const isExpanded = expandedId === t.id;
              const isSubHistory =
  id === "core-modern-history" ||
  id === "core-medieval-history" ||
  id === "core-ancient-history" ||
  id === "core-indian-dances" ||
  id === "core-indian-temples";
              const isHubItem =
                (isHistoryHub || isArtCultureHub) && hubBuiltinIds.has(t.id);
              const notesCount = isHubItem ? 0 : api.notesForTopic(t.id).length;
              return (
                <div key={t.id} className="space-y-1">
                  <Card
  className={cn(
    "p-4 transition-colors cursor-pointer hover:border-primary/40",
    isExpanded && "border-primary/50",
  )}
  onClick={() => {
  if (isHubItem) {
    navigate({
  to: "/subject/$id",
  params: { id: t.id },
});
    return;
  }

  if (isSubHistory) {
    toggleTopic(t.id);
    return;
  }

  toggleTopic(t.id);
}}
>
                    <div className="font-medium">{t.name}</div>
                    <div className="text-xs text-muted-foreground mt-1">
  {isHubItem
    ? "Open"
    : isSubHistory
      ? "Manage topics"
      : `${notesCount} note${notesCount === 1 ? "" : "s"}`}
</div>
                  </Card>

                  <AnimatePresence>
                    {!isHubItem && isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25, ease: "easeInOut" }}
                        className="overflow-hidden"
                      >
                        <Card className="p-3 border-t-0 rounded-t-none bg-muted/20">
                          <div className="grid grid-cols-2 gap-2">
                            <Button asChild variant="outline" className="h-16 flex flex-col gap-1">
                              <Link
  to="/topic/$topicId/notes"
  params={{ topicId: t.id }}
>
                                <Pencil className="h-5 w-5" />
                                <span className="text-xs">Edit Notes</span>
                              </Link>
                            </Button>
                            <Button asChild variant="outline" className="h-16 flex flex-col gap-1">
                              <Link
  to="/new"
  search={{
    subjectId: id,
    topicId: t.id,
  }}
>
                                <PlusCircle className="h-5 w-5" />
                                <span className="text-xs">Generate New Quiz</span>
                              </Link>
                            </Button>
                          </div>
                        </Card>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
