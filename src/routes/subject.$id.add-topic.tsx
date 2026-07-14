import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { api } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/subject/$id/add-topic")({
  component: AddTopicPage,
});

function AddTopicPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();

  const [name, setName] = useState("");

  const createTopic = () => {
    if (!name.trim()) {
      toast.error("Enter a topic name.");
      return;
    }

    const existing = api
  .topicsForSubject(id)
  .find(
    (t) => t.name.trim().toLowerCase() === name.trim().toLowerCase(),
  );

const topic = existing ?? api.ensureTopic(id, name.trim());

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
        id === "core-modern-history"
          ? "/backgrounds/modern-history-bg.png"
          : id === "core-medieval-history"
            ? "/backgrounds/medieval-history-bg.png"
            : id === "core-ancient-history"
              ? "/backgrounds/ancient-history-bg.png"
              : id === "core-indian-dances"
                ? "/backgrounds/indian-dances-bg.png"
                : id === "core-indian-temples"
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
      <header className="mb-8 border-b border-border/60 pb-4">
        <Button
          variant="ghost"
          className="-ml-4"
          onClick={() =>
            navigate({
              to: "/subject/$id",
              params: { id },
            })
          }
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
      </header>

      <Card className="p-8 space-y-6 shadow-lg">
        <h1 className="font-display text-3xl font-semibold tracking-tight">New Topic</h1>

        <Input
          autoFocus
          placeholder="Topic name..."
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-12 text-base"
        />

        <Button className="w-full" onClick={createTopic}>
          Create Topic
        </Button>
      </Card>
        </div>
  </div>
);
}