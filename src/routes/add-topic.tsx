import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { api } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/add-topic")({
  validateSearch: (search: Record<string, unknown>) => ({
    subjectId: String(search.subjectId ?? ""),
  }),
  component: AddTopicPage,
});

function AddTopicPage() {
  const { subjectId } = Route.useSearch();
  const navigate = useNavigate();

  const [name, setName] = useState("");

  const createTopic = () => {
    if (!name.trim()) {
      toast.error("Enter a topic name.");
      return;
    }

    const existing = api
  .topicsForSubject(subjectId)
  .find(
    (t) => t.name.trim().toLowerCase() === name.trim().toLowerCase(),
  );

const topic = existing ?? api.ensureTopic(subjectId, name.trim());

    toast.success("Topic created.");

navigate({
  to: "/topic/$topicId/notes",
  params: {
    topicId: topic.id,
  },
});
  };

  return (
  <div className="relative min-h-dvh overflow-x-hidden">
    <img
      src={
        subjectId === "core-modern-history"
          ? "/backgrounds/modern-history-bg.png"
          : subjectId === "core-medieval-history"
            ? "/backgrounds/medieval-history-bg.png"
            : subjectId === "core-ancient-history"
              ? "/backgrounds/ancient-history-bg.png"
              : subjectId === "core-indian-dances"
                ? "/backgrounds/indian-dances-bg.png"
                : subjectId === "core-indian-temples"
                  ? "/backgrounds/indian-temples-bg.png"
                  : "/background.png"
      }
      alt=""
      aria-hidden="true"
      className="fixed inset-0 h-full w-full object-cover pointer-events-none opacity-40"
      style={{
        objectPosition: "center center",
        transform: "scale(0.96)",
        transformOrigin: "center center",
        zIndex: -1,
      }}
    />

    <div className="mx-auto max-w-3xl px-5 py-8">
      <Button
        variant="ghost"
        onClick={() =>
          navigate({
  to: "/subject/$id",
  params: { id: subjectId },
  replace: true,
})
        }
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back
      </Button>

      <Card className="mt-6 p-6 space-y-4">
        <h1 className="font-display text-3xl">New Topic</h1>

        <Input
          autoFocus
          placeholder="Topic name..."
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <Button className="w-full" onClick={createTopic}>
          Create Topic
        </Button>
      </Card>
        </div>
  </div>
);
}
