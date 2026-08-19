import { Timer } from "lucide-react";

// Purely presentational. The quiz page is now the single authoritative
// timer — it owns the active/paused/frozen logic and re-renders this
// component with an up-to-date `seconds` value roughly once a second.
// This component has no clock of its own, so there's no way for it to
// drift from, or double-count against, the value the page is tracking.
export function QuizTimer({ seconds }: { seconds: number }) {
  const total = Math.max(0, Math.floor(seconds));
  const mm = String(Math.floor(total / 60)).padStart(2, "0");
  const ss = String(total % 60).padStart(2, "0");

  return (
    <div className="inline-flex items-center gap-1.5 rounded-full bg-muted/60 px-2.5 py-1 text-xs font-medium tabular-nums text-muted-foreground">
      <Timer className="h-3.5 w-3.5" />
      {mm}:{ss}
    </div>
  );
}
