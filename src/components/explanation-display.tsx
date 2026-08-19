import { motion } from "framer-motion";
import { CheckCircle2, XCircle, Lightbulb, Link2, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// Recognized explanation sections, in display order. Each entry's `match`
// tests a line to see if it's that section's heading (case-insensitive,
// tolerant of leading numbering like "1." and a trailing colon).
type SectionKey = "correct" | "optionA" | "optionB" | "optionC" | "optionD" | "concept" | "related";

const OPTION_KEYS: SectionKey[] = ["optionA", "optionB", "optionC", "optionD"];

const SECTION_DEFS: {
  key: SectionKey;
  icon: LucideIcon;
  label: string;
  match: RegExp;
}[] = [
  {
    key: "correct",
    icon: CheckCircle2,
    label: "Correct Answer",
    match: /^correct answer\b/i,
  },
  {
    key: "optionA",
    icon: CheckCircle2,
    label: "Option A",
    match: /^option\s*a\b/i,
  },
  {
    key: "optionB",
    icon: CheckCircle2,
    label: "Option B",
    match: /^option\s*b\b/i,
  },
  {
    key: "optionC",
    icon: CheckCircle2,
    label: "Option C",
    match: /^option\s*c\b/i,
  },
  {
    key: "optionD",
    icon: CheckCircle2,
    label: "Option D",
    match: /^option\s*d\b/i,
  },
  {
    key: "concept",
    icon: Lightbulb,
    label: "Concept Tested",
    match: /^concept tested\b/i,
  },
  {
    key: "related",
    icon: Link2,
    label: "Related Topics",
    match: /^related topics?\b/i,
  },
];

const HEADING_STRIP = /^[\s#*_>-]*\d*[.)]?\s*/; // leading list/markdown noise
const TRAILING_COLON = /:\s*$/;
const STATUS_LEADING_SYMBOL_STRIP = /^[\s✓✔✘✗•\-–—*>:.]+/; // leading checkmarks/bullets/punctuation
const STATUS_MATCH = /^(correct|incorrect)\b/i;

type RawSection = { key: SectionKey; heading: string; body: string[] };

type ParsedCorrect = { kind: "correct"; heading: string; body: string };
type ParsedOption = {
  kind: "option";
  heading: string;
  isCorrect: boolean;
  reason: string;
};
type ParsedConcept = { kind: "concept"; heading: string; body: string };
type ParsedRelated = { kind: "related"; heading: string; topics: string[] };

type ParsedSection = ParsedCorrect | ParsedOption | ParsedConcept | ParsedRelated;

/**
 * Splits raw explanation text into the Correct Answer / Option A-D /
 * Concept Tested / Related Topics sections. Falls back to `null` (caller
 * renders the original plain text) if the expected structure isn't found.
 */
function parseExplanation(raw: string): ParsedSection[] | null {
  const lines = raw.replace(/\r\n/g, "\n").split("\n");
  const rawSections: RawSection[] = [];
  let current: RawSection | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    const cleaned = line.replace(HEADING_STRIP, "");
    const def = SECTION_DEFS.find((d) => d.match.test(cleaned.replace(TRAILING_COLON, "")));
    if (def) {
      if (current) rawSections.push(current);
      const remainder = cleaned.replace(def.match, "").replace(/^[:\s-]+/, "").trim();
      current = { key: def.key, heading: def.label, body: remainder ? [remainder] : [] };
    } else if (current) {
      current.body.push(line);
    }
  }
  if (current) rawSections.push(current);

  const hasCorrect = rawSections.some((s) => s.key === "correct");
  const hasAnyOption = rawSections.some((s) => OPTION_KEYS.includes(s.key));
  if (!hasCorrect && !hasAnyOption) return null;

  const parsed: ParsedSection[] = [];
  for (const section of rawSections) {
    if (section.key === "correct") {
      parsed.push({ kind: "correct", heading: section.heading, body: section.body.join(" ") });
    } else if (OPTION_KEYS.includes(section.key)) {
      const [firstLine, ...rest] = section.body;
      const firstLineClean = firstLine ? firstLine.replace(STATUS_LEADING_SYMBOL_STRIP, "") : firstLine;
      const statusMatch = firstLineClean ? STATUS_MATCH.exec(firstLineClean) : null;
      const isCorrect = !!statusMatch && /^correct/i.test(statusMatch[1]);
      const reasonLines = statusMatch
        ? [firstLineClean.replace(STATUS_MATCH, "").replace(/^[:\s.-]+/, "").trim(), ...rest].filter(Boolean)
        : section.body;
      parsed.push({
        kind: "option",
        heading: section.heading,
        isCorrect,
        reason: reasonLines.join(" "),
      });
    } else if (section.key === "concept") {
      parsed.push({ kind: "concept", heading: section.heading, body: section.body.join(" ") });
    } else if (section.key === "related") {
      const topics = section.body
        .flatMap((line) => line.split(/[,;↔→]+/))
        .map((t) => t.replace(/^[\s•\-*]+/, "").trim())
        .filter(Boolean);
      parsed.push({ kind: "related", heading: section.heading, topics });
    }
  }

  return parsed;
}

export function ExplanationDisplay({ text, className }: { text: string; className?: string }) {
  const sections = parseExplanation(text);

  if (!sections || sections.length === 0) {
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
        const delay = i * 0.06;

        if (section.kind === "correct") {
          return (
            <motion.div
              key={`correct-${i}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, delay, ease: "easeOut" }}
              className="rounded-2xl border border-success/30 bg-success/[0.08] backdrop-blur-md px-4 py-3.5 shadow-sm"
            >
              <div className="mb-1.5 flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-success" />
                <span className="text-base font-bold tracking-tight text-success">
                  {section.heading}
                </span>
              </div>
              <p className="pl-7 text-sm leading-relaxed text-foreground/90">{section.body}</p>
            </motion.div>
          );
        }

        if (section.kind === "option") {
          return (
            <motion.div
              key={`${section.heading}-${i}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, delay, ease: "easeOut" }}
              className={cn(
                "rounded-2xl border backdrop-blur-md px-4 py-3 shadow-sm",
                section.isCorrect
                  ? "border-success/25 bg-success/[0.05]"
                  : "border-destructive/20 bg-destructive/[0.04]",
              )}
            >
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="text-sm font-bold tracking-tight text-foreground">
                  {section.heading}
                </span>
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold tracking-wide",
                    section.isCorrect
                      ? "bg-success/15 text-success"
                      : "bg-destructive/15 text-destructive",
                  )}
                >
                  {section.isCorrect ? (
                    <>
                      <CheckCircle2 className="h-3 w-3" /> Correct
                    </>
                  ) : (
                    <>
                      <XCircle className="h-3 w-3" /> Incorrect
                    </>
                  )}
                </span>
              </div>
              {section.reason && (
                <p className="text-xs leading-relaxed text-foreground/70">{section.reason}</p>
              )}
            </motion.div>
          );
        }

        if (section.kind === "concept") {
          return (
            <motion.div
              key={`concept-${i}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, delay, ease: "easeOut" }}
              className="rounded-2xl border border-sky-400/20 bg-sky-400/[0.05] backdrop-blur-md px-4 py-3 shadow-sm"
            >
              <div className="mb-1 flex items-center gap-2">
                <Lightbulb className="h-4 w-4 shrink-0 text-amber-400" />
                <span className="text-xs font-semibold tracking-wide uppercase text-amber-400">
                  {section.heading}
                </span>
              </div>
              <p className="pl-6 text-sm leading-relaxed text-foreground/85">{section.body}</p>
            </motion.div>
          );
        }

        // Related topics — render as chips.
        if (!section.topics.length) return null;
        return (
          <motion.div
            key={`related-${i}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, delay, ease: "easeOut" }}
            className="rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-md px-4 py-3 shadow-sm"
          >
            <div className="mb-2 flex items-center gap-2">
              <Link2 className="h-4 w-4 shrink-0 text-sky-400" />
              <span className="text-xs font-semibold tracking-wide uppercase text-sky-400">
                {section.heading}
              </span>
            </div>
            <div className="flex flex-wrap gap-2 pl-6">
              {section.topics.map((topic, j) => (
                <span
                  key={j}
                  className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs text-foreground/80"
                >
                  {topic}
                </span>
              ))}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}