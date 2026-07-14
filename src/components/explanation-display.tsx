import { motion } from "framer-motion";
import { CheckCircle2, XCircle, Lightbulb, Brain, AlertTriangle, Link2, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// Recognized explanation sections, in display order. Each entry's `match`
// tests a line to see if it's that section's heading (case-insensitive,
// tolerant of leading numbering like "1." and a trailing colon).
type SectionKey =
  | "correct"
  | "wrong"
  | "concept"
  | "memory"
  | "trap"
  | "related";

const SECTION_DEFS: {
  key: SectionKey;
  icon: LucideIcon;
  label: string;
  accent: string;
  match: RegExp;
}[] = [
  {
    key: "correct",
    icon: CheckCircle2,
    label: "Correct Answer",
    accent: "text-success",
    match: /^correct answer\b/i,
  },
  {
    key: "wrong",
    icon: XCircle,
    label: "Why the Other Options are Wrong",
    accent: "text-destructive",
    match: /^why (the )?other options? (is|are)? ?wrong\b/i,
  },
  {
    key: "concept",
    icon: Lightbulb,
    label: "UPSC/HPSC Concept",
    accent: "text-amber-400",
    match: /^(upsc\s*\/?\s*hpsc\s*concept|concept)\b/i,
  },
  {
    key: "memory",
    icon: Brain,
    label: "Memory Trick",
    accent: "text-fuchsia-400",
    match: /^memory trick\b/i,
  },
  {
    key: "trap",
    icon: AlertTriangle,
    label: "Common UPSC Trap",
    accent: "text-orange-400",
    match: /^common (upsc\s*\/?\s*hpsc)? ?trap\b/i,
  },
  {
    key: "related",
    icon: Link2,
    label: "Related Topics",
    accent: "text-sky-400",
    match: /^related topics?\b/i,
  },
];

const HEADING_STRIP = /^[\s#*_>-]*\d*[.)]?\s*/; // leading list/markdown noise
const TRAILING_COLON = /:\s*$/;

/**
 * Splits raw explanation text into recognized sections. Falls back to a
 * single unlabelled block if no section headings are detected, so plain
 * explanations still render nicely.
 */
function parseExplanation(raw: string) {
  const lines = raw.replace(/\r\n/g, "\n").split("\n");
  const sections: { key: SectionKey | "intro"; heading: string | null; body: string[] }[] = [];
  let current: { key: SectionKey | "intro"; heading: string | null; body: string[] } = {
    key: "intro",
    heading: null,
    body: [],
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    const cleaned = line.replace(HEADING_STRIP, "");
    const def = SECTION_DEFS.find((d) => d.match.test(cleaned.replace(TRAILING_COLON, "")));
    if (def) {
      if (current.body.length || current.heading) sections.push(current);
      // Anything after the heading on the same line becomes the first line of body.
      const remainder = cleaned.replace(def.match, "").replace(/^[:\s-]+/, "").trim();
      current = { key: def.key, heading: def.label, body: remainder ? [remainder] : [] };
    } else {
      current.body.push(line);
    }
  }
  if (current.body.length || current.heading) sections.push(current);

  const hasStructure = sections.some((s) => s.key !== "intro");
  return { sections, hasStructure };
}

export function ExplanationDisplay({ text, className }: { text: string; className?: string }) {
  const { sections, hasStructure } = parseExplanation(text);

  if (!hasStructure) {
    return (
      <div
        className={cn(
          "rounded-2xl border border-primary/20 bg-primary/[0.06] backdrop-blur-md p-4",
          className,
        )}
      >
        <p className="mb-1.5 text-sm font-semibold tracking-tight text-primary">Explanation</p>
        <p className="text-sm leading-relaxed text-foreground/85">{text}</p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-2.5", className)}>
      {sections.map((section, i) => {
        if (section.key === "intro") {
          if (!section.body.length) return null;
          return (
            <motion.p
              key={`intro-${i}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: i * 0.05 }}
              className="text-sm leading-relaxed text-foreground/80"
            >
              {section.body.join(" ")}
            </motion.p>
          );
        }
        const def = SECTION_DEFS.find((d) => d.key === section.key)!;
        const Icon = def.icon;
        return (
          <motion.div
            key={`${section.key}-${i}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, delay: i * 0.06, ease: "easeOut" }}
            className="rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-md px-4 py-3 shadow-sm"
          >
            <div className="mb-1 flex items-center gap-2">
              <Icon className={cn("h-4 w-4 shrink-0", def.accent)} />
              <span className={cn("text-xs font-semibold tracking-wide uppercase", def.accent)}>
                {def.label}
              </span>
            </div>
            <div className="space-y-1 pl-6 text-sm leading-relaxed text-foreground/85">
              {section.body.map((line, j) => (
                <p key={j}>{line}</p>
              ))}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
