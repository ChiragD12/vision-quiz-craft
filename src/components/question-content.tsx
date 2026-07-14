// Detects and renders structured UPSC-style question stems:
//   - Match the Following / List I – List II
//   - Consider the following pairs
//   - Consider the following statements (numbered)
//   - Assertion – Reason
// Falls back to whitespace-preserving text if nothing matches.
//
// The detector is intentionally forgiving: LLM output varies in punctuation,
// bullet style, and column separators. When in doubt, we defer to the plain
// renderer so no existing quiz is broken.

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

type Parsed =
  | { kind: "plain"; text: string }
  | { kind: "statements"; intro: string; items: { label: string; text: string }[]; outro: string }
  | {
      kind: "pairs";
      intro: string;
      headerA: string;
      headerB: string;
      rows: { a: string; b: string }[];
      outro: string;
      // Presentational hint only (not used by any matching/scoring logic):
      // "table" for List I/List II or Column I/Column II style matching,
      // "rows" for "Consider the following pairs" style item:fact rows.
      variant: "table" | "rows";
    }
  | { kind: "assertion"; intro: string; assertion: string; reason: string; outro: string }
  | {
      kind: "chronology";
      intro: string;
      items: { label: string; text: string }[];
      outro: string;
    };

// Used for numbered statements / "consider the following pairs" items.
// Intentionally excludes bare A-D letters so answer options (A./B./C./D.)
// appearing after such a block are never mistaken for statements.
const NUM_LINE = /^\s*(?:\(?([0-9]+|[IVXivx]+)[.)\]])\s+(.+?)\s*$/;
const ANY_LABEL_LINE =
  /^\s*(?:\(?([0-9]+|[A-Za-z]+|[IVXivx]+)[.)\]])\s+(.+?)\s*$/;
const COLON_SPLIT = /\s*[-–—:|]\s+|\s{2,}/;

function splitLines(s: string): string[] {
  return s
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

// Conservatively insert newlines before numbered list markers or section headers
// (e.g., "List I", "1.", "A.") to improve parser robustness for continuous text.
function normalizeQuestionText(text: string): string {
  let s = text.replace(/\r\n?/g, "\n");

  // Split side-by-side columns onto separate lines FIRST, before any other
  // marker splitting. LLM output for two-column tables often collapses to a
  // single physical line separated by a run of spaces/tabs, e.g.:
  //   "A. Item one     1. Match one"
  // Without this, later marker-insertion rules would keep both labels glued
  // to the same line, and the row would get mis-parsed as a single
  // "statement" — producing the interwoven A./1./B./2. bug.
  s = s.replace(
    /[ \t]{2,}(?=\(?(?:[0-9]{1,3}|[A-Da-d]|[IVXivx]+)[.)\]]\s)/g,
    "\n",
  );

  // Put major section headers on their own line.
  const headers = ["List I", "List II", "Column I", "Column II", "Code:", "Codes:"];
  for (const h of headers) {
    const escaped = h.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    s = s.replace(new RegExp(`\\s*${escaped}`, "gi"), `\n${h}`);
  }

  // Put numeric list markers ("1.", "2." ...) on a new line.
  // Markers are 1-2 digits and must not be adjacent to other digits, so we
  // don't split years (e.g. "1935.") or other multi-digit numbers.
  s = s.replace(/(?<![\n\d])(\d{1,2}\.)(?=\s)/g, "\n$1");

  // Handle OCR/LLM formatting like:
  // 2016.2. Foo  -> 2016.\n2. Foo
  s = s.replace(
    /(\d{4}\.)(\d{1,2}\.\s*)/g,
    "$1\n$2",
  );

  // Separate the final question prompt.
  s = s.replace(
    /(\d+\.\s+[^\n]+?)(Select\s+the\s+correct|Choose\s+the\s+correct|Which\s+of\s+the|How\s+many)/gi,
    "$1\n$2",
  );

  // Put alphabetic list/option markers ("A.", "b)" ...) on a new line.
  // Must not be preceded by a letter, or we'd split ordinary words like
  // "India." (the "a." inside "India") onto their own line.
  s = s.replace(/(?<![\nA-Za-z])([A-Da-d]\.)(?=\s)/g, "\n$1");

  // Put roman-numeral list markers ("I.", "ii)", "III." ...) on a new line
  // when they're clearly acting as list labels (followed by a space and not
  // glued to a preceding word character).
  s = s.replace(/(?<![\nA-Za-z])([IVXivx]{1,4}[.)\]])(?=\s)/g, "\n$1");

  // Remove accidental blank lines.
  s = s.replace(/\n{3,}/g, "\n\n");

  // Remove leading blank lines.
  s = s.replace(/^\n+/, "");

  return s.trim();
}

// Classifies a list-item label into a "column type" so that interleaved or
// blocked matching items (e.g. A,1,B,2,C,3 or A,B,C,1,2,3) can be grouped
// back into their original two columns regardless of how the source text
// ordered them.
function classifyLabel(label: string): "alpha" | "numeric" | "roman" {
  if (/^[0-9]+$/.test(label)) return "numeric";
  // Single letters that double as roman numerals (I, V, X) are treated as
  // roman first, since in matching questions List I items are far more
  // commonly labelled with roman numerals than the single letters I/V/X.
  if (/^[A-Za-z]$/.test(label) && !/^[ivx]$/i.test(label)) return "alpha";
  if (/^[ivxlcdm]+$/i.test(label)) return "roman";
  return "alpha";
}

// Builds the display header for a "List I" / "List II" (or "Column I" /
// "Column II") line. Accepts headers with an optional trailing subtitle in
// parentheses, e.g. "List I (Warm Winds)" or "List I: (Warm Winds)" — when a
// subtitle is present, it is shown on its own (e.g. "Warm Winds") instead of
// the raw "List I (Warm Winds)" text. When no subtitle is present, the
// canonical "List I" / "List II" (or "Column I" / "Column II") label is
// used, exactly as before.
function headerLabelFromLine(line: string, romanNumeral: "I" | "II", kwCased: string): string {
  const subtitleMatch = line.match(/\(([^)]+)\)\s*$/);
  if (subtitleMatch && subtitleMatch[1].trim()) {
    return subtitleMatch[1].trim();
  }
  return `${kwCased} ${romanNumeral}`;
}

// Unified detector for all two-column matching-style questions: List I/List
// II, Column I/Column II, "Match the following", "Consider the following
// pairs" (when genuinely presented as two lists), regardless of whether the
// source text places the two lists one after another (blocked) or
// interleaves them line-by-line or row-by-row. Returns null if no confident
// two-column structure is found, so the caller can fall back to simpler
// renderers.
function tryParseMatchingTable(lines: string[]): {
  intro: string;
  headerA: string;
  headerB: string;
  rows: { a: string; b: string }[];
  outro: string;
  variant: "table" | "rows";
} | null {
  const headerIdx = lines.findIndex(
    (l) =>
      /^(list|column)\s*[-–—]?\s*i\b/i.test(l) ||
      /match\s+the\s+following/i.test(l) ||
      /consider\s+the\s+following\s+pairs?/i.test(l),
  );
  if (headerIdx === -1) return null;

  const isListStyle = /^(list|column)\s*[-–—]?\s*i\b/i.test(lines[headerIdx]);
  const listIIIdx = isListStyle
    ? lines.findIndex(
        (l, i) => i > headerIdx && /^(list|column)\s*[-–—]?\s*ii\b/i.test(l),
      )
    : -1;

  const stopMarkers =
    /^(codes?)\s*:|select\s+the\s+correct|choose\s+the\s+correct|which\s+of\s+the|how\s+many/i;

  const scanStart = headerIdx + 1;
  let scanEnd = lines.length;
  for (let i = scanStart; i < lines.length; i++) {
    if (stopMarkers.test(lines[i])) {
      scanEnd = i;
      break;
    }
  }

  // Gather every labelled item in the scan range, skipping the standalone
  // "List II"/"Column II" header token (it's just a divider, not an item).
  const rawItems: { label: string; text: string; type: string }[] = [];
  for (let i = scanStart; i < scanEnd; i++) {
    const line = lines[i];
    if (/^(list|column)\s*[-–—]?\s*ii\b/i.test(line)) continue;
    const m = line.match(ANY_LABEL_LINE);
    if (m) {
      rawItems.push({ label: m[1], text: m[2], type: classifyLabel(m[1]) });
    } else if (rawItems.length > 0) {
      // Continuation line of a multiline cell.
      rawItems[rawItems.length - 1].text += " " + line;
    }
  }

  // Group items by label "type" in order of first appearance, so it doesn't
  // matter whether the source blocked the two lists together or interleaved
  // them row by row — both collapse to the same two ordered groups.
  const typeOrder: string[] = [];
  for (const it of rawItems) if (!typeOrder.includes(it.type)) typeOrder.push(it.type);
  if (typeOrder.length < 2) return null;

  const typeA = typeOrder[0];
  const typeB = typeOrder.find((t) => t !== typeA)!;
  const itemsA = rawItems.filter((it) => it.type === typeA);
  const itemsB = rawItems.filter((it) => it.type === typeB);

  if (itemsA.length < 2 || itemsA.length !== itemsB.length) return null;

  const rows = itemsA.map((a, i) => ({
    a: `${a.label}. ${a.text.trim()}`,
    b: `${itemsB[i].label}. ${itemsB[i].text.trim()}`,
  }));

  let headerA = "List I";
  let headerB = "List II";
  let introEnd = headerIdx; // exclude the "Match the following" / "List I" line by default
  if (isListStyle) {
    const kw = lines[headerIdx].match(/^(list|column)/i)?.[1] ?? "List";
    const kwCased = kw[0].toUpperCase() + kw.slice(1).toLowerCase();
    headerA = headerLabelFromLine(lines[headerIdx], "I", kwCased);
    headerB =
      listIIIdx >= 0
        ? headerLabelFromLine(lines[listIIIdx], "II", kwCased)
        : `${kwCased} II`;
  } else {
    // "Match the following" / "Consider the following pairs" style intro
    // line is genuine lead-in text, so keep it in the intro paragraph.
    introEnd = headerIdx + 1;
  }

  const intro = lines.slice(0, introEnd).join("\n");
  const outro = lines
    .slice(scanEnd)
    .join("\n")
    .replace(/^[A-Da-d][.)]\s*$/m, "")
    .trim();

  return { intro, headerA, headerB, rows, outro, variant: isListStyle ? "table" : "rows" };
}

// ======================================================================
// Recovery parser for malformed Match the Following questions.
//
// tryParseMatchingTable() above is intentionally strict, so it never
// mis-renders a question that isn't confidently a two-column match. That
// strictness means a slightly malformed List I / List II question (odd
// separators, an unexpected label range, stray punctuation on the header
// line, etc.) can fall straight through to null and end up as plain text.
//
// This function is purely additive recovery: it is only ever consulted
// after tryParseMatchingTable() has already returned null, it does not
// alter tryParseMatchingTable() in any way, and on success it returns the
// exact same shape tryParseMatchingTable() returns so the caller renders it
// through the same "pairs"/MatchingTable path.
// ======================================================================
// Chronology cue phrases that mark a single-list ordering question rather
// than a two-column match (e.g. "Arrange the following ... in chronological
// order"). Recovery must never intercept these — tryParseChronology() is
// the correct handler for them.
const CHRONOLOGY_CUES =
  /\barrange\s+(?:the\s+following|in\s+(?:the\s+)?correct\s+order)\b|\bcorrect\s+chronological\s+order\b|\bchronological\s+order\b/i;

// Header line detectors, shared across recovery paths. The (list|column)
// alternation plus the /i flag and optional "[-–—:]?" separator already
// normalize casing/punctuation variants — "LIST I:", "List I -", "list i",
// "Column I:", "COLUMN II -" — to the same match, so no separate handling
// is needed per variant.
const HEADER_I_RE = /^(list|column)\s*[-–—:]?\s*i\b/i;
const HEADER_II_RE = /^(list|column)\s*[-–—:]?\s*ii\b/i;

const RECOVERY_STOP_MARKERS =
  /^(codes?)\s*:|select\s+the\s+correct|choose\s+the\s+correct|which\s+of\s+the|how\s+many/i;

// Broadened label patterns used only by recovery (kept separate from the
// primary parser's stricter patterns so tryParseMatchingTable()'s behavior
// never changes): any single letter A-Z, multi-character roman numerals,
// and 1-2 digit numbers.
const RECOVERY_ALPHA_LABEL = /^\s*(?:\(?([A-Za-z])[.)\]])\s+(.+?)\s*$/;
const RECOVERY_ROMAN_LABEL = /^\s*(?:\(?([IVXivx]{2,4})[.)\]])\s+(.+?)\s*$/;
const RECOVERY_NUMERIC_LABEL = /^\s*(?:\(?([0-9]{1,2})[.)\]])\s+(.+?)\s*$/;

type MatchRecovery = {
  intro: string;
  headerA: string;
  headerB: string;
  rows: { a: string; b: string }[];
  outro: string;
  variant: "table" | "rows";
};

// Path A: "List I" / "List II" (or "Column I" / "Column II") headers are
// present, in any of their tolerated casing/punctuation forms. Collects
// every labelled entry between/after the headers, allowing multiline
// continuation cells, and pairs the two lists positionally.
function tryRecoverWithHeaders(lines: string[]): MatchRecovery | null {
  // STEP 1: locate "List I" / "Column I" (this also matches malformed
  // variants like "List I:", "List-I", "LIST I WITH", since they all start
  // with the keyword followed by an optional separator and "I" as a whole
  // word).
  const headerIIdx = lines.findIndex((l) => HEADER_I_RE.test(l));
  if (headerIIdx === -1) return null;

  // STEP 2: locate "List II" / "Column II" after the List I header.
  const headerIIIdx = lines.findIndex((l, i) => i > headerIIdx && HEADER_II_RE.test(l));
  if (headerIIIdx === -1) return null;

  let scanEnd = lines.length;
  for (let i = headerIIIdx + 1; i < lines.length; i++) {
    if (RECOVERY_STOP_MARKERS.test(lines[i])) {
      scanEnd = i;
      break;
    }
  }

  // STEP 3: collect every labelled entry belonging to List I — supported
  // labels are any single letter A-Z and multi-character roman numerals —
  // allowing multiline continuation cells, between the List I and List II
  // headers.
  const itemsA: { label: string; text: string }[] = [];
  for (let i = headerIIdx + 1; i < headerIIIdx; i++) {
    const line = lines[i];
    const m = line.match(RECOVERY_ALPHA_LABEL) || line.match(RECOVERY_ROMAN_LABEL);
    if (m) {
      itemsA.push({ label: m[1], text: m[2] });
    } else if (itemsA.length > 0) {
      itemsA[itemsA.length - 1].text += " " + line;
    }
  }

  // STEP 4: collect every labelled entry belonging to List II — supported
  // labels are 1-2 digit numbers — allowing multiline continuation cells,
  // after the List II header.
  const itemsB: { label: string; text: string }[] = [];
  for (let i = headerIIIdx + 1; i < scanEnd; i++) {
    const line = lines[i];
    const m = line.match(RECOVERY_NUMERIC_LABEL);
    if (m) {
      itemsB.push({ label: m[1], text: m[2] });
    } else if (itemsB.length > 0) {
      itemsB[itemsB.length - 1].text += " " + line;
    }
  }

  // STEP 5: only recover into a table when both lists are non-trivial and
  // have equal row counts, then pair them up positionally — exactly the
  // same way tryParseMatchingTable() already does.
  if (itemsA.length < 2 || itemsB.length < 2 || itemsA.length !== itemsB.length) return null;

  const rows = itemsA.map((a, i) => ({
    a: `${a.label}. ${a.text.trim()}`,
    b: `${itemsB[i].label}. ${itemsB[i].text.trim()}`,
  }));

  const kw = lines[headerIIdx].match(/^(list|column)/i)?.[1] ?? "List";
  const kwCased = kw[0].toUpperCase() + kw.slice(1).toLowerCase();
  const headerA = headerLabelFromLine(lines[headerIIdx], "I", kwCased);
  const headerB = headerLabelFromLine(lines[headerIIIdx], "II", kwCased);

  const intro = lines.slice(0, headerIIdx).join("\n");
  const outro = lines
    .slice(scanEnd)
    .join("\n")
    .replace(/^[A-Da-d][.)]\s*$/m, "")
    .trim();

  return { intro, headerA, headerB, rows, outro, variant: "table" };
}

// Path B: no "List I" / "List II" (or "Column I" / "Column II") headers are
// present at all. Infers the two columns purely from labelled entries:
// every alphabetic-labelled line becomes a List I row, every
// numeric-labelled line becomes a List II row, collected in the order each
// first appears. This handles both a "blocked" layout (all letters, then
// all numbers) and an interleaved/OCR layout (letters and numbers mixed
// line by line) identically — rows are paired positionally within each
// group, e.g. the 1st letter seen pairs with the 1st number seen.
function tryRecoverHeaderless(lines: string[]): MatchRecovery | null {
  let scanEnd = lines.length;
  for (let i = 0; i < lines.length; i++) {
    if (RECOVERY_STOP_MARKERS.test(lines[i])) {
      scanEnd = i;
      break;
    }
  }

  const itemsA: { label: string; text: string }[] = [];
  const itemsB: { label: string; text: string }[] = [];
  let lastGroup: "alpha" | "numeric" | null = null;
  let firstLabelIdx = -1;

  for (let i = 0; i < scanEnd; i++) {
    const line = lines[i];
    const numMatch = line.match(RECOVERY_NUMERIC_LABEL);
    const alphaMatch = !numMatch ? line.match(RECOVERY_ALPHA_LABEL) : null;

    if (numMatch) {
      if (firstLabelIdx === -1) firstLabelIdx = i;
      itemsB.push({ label: numMatch[1], text: numMatch[2] });
      lastGroup = "numeric";
    } else if (alphaMatch) {
      if (firstLabelIdx === -1) firstLabelIdx = i;
      itemsA.push({ label: alphaMatch[1], text: alphaMatch[2] });
      lastGroup = "alpha";
    } else if (lastGroup === "alpha" && itemsA.length > 0) {
      // Continuation line of a multiline List I cell.
      itemsA[itemsA.length - 1].text += " " + line;
    } else if (lastGroup === "numeric" && itemsB.length > 0) {
      // Continuation line of a multiline List II cell.
      itemsB[itemsB.length - 1].text += " " + line;
    }
  }

  // Only recover when there's a genuine, evenly-matched two-column
  // structure: at least 2 alphabetic entries, at least 2 numeric entries,
  // and identical row counts.
  if (itemsA.length < 2 || itemsB.length < 2 || itemsA.length !== itemsB.length) {
    return null;
  }

  const rows = itemsA.map((a, i) => ({
    a: `${a.label}. ${a.text.trim()}`,
    b: `${itemsB[i].label}. ${itemsB[i].text.trim()}`,
  }));

  const intro = firstLabelIdx > 0 ? lines.slice(0, firstLabelIdx).join("\n") : "";
  const outro = lines
    .slice(scanEnd)
    .join("\n")
    .replace(/^[A-Da-d][.)]\s*$/m, "")
    .trim();

  return { intro, headerA: "List I", headerB: "List II", rows, outro, variant: "table" };
}

function tryRecoverMatchingTable(lines: string[]): MatchRecovery | null {
  // SAFETY: never recover a chronology / "arrange in order" question as a
  // matching table — let tryParseChronology() handle those instead.
  if (lines.some((l) => CHRONOLOGY_CUES.test(l))) return null;

  // Path A (headers present, possibly malformed) takes priority since it's
  // the more confident signal; Path B (no headers) is the broader fallback.
  return tryRecoverWithHeaders(lines) ?? tryRecoverHeaderless(lines);
}

// Detects single-list chronology / "arrange in order" questions (a lone List
// I of events, with orderings supplied as the four MCQ options rather than a
// second list). Purely additive: only reached when tryParseMatchingTable
// already returned null (i.e. no two-column structure was found), so it
// never changes the outcome for any question that already parsed as a
// matching table, statement set, or assertion-reason pair.
function tryParseChronology(lines: string[]): {
  intro: string;
  items: { label: string; text: string }[];
  outro: string;
} | null {
  const cueIdx = lines.findIndex((l) =>
    /chronological\s+order|correct\s+order|arrange\s+the\s+following/i.test(l),
  );
  if (cueIdx === -1) return null;

  const headerIdx = lines.findIndex(
    (l, i) => i >= cueIdx && /^(list|column)\s*[-–—]?\s*i\b/i.test(l),
  );
  const scanStart = headerIdx >= 0 ? headerIdx + 1 : cueIdx + 1;

  const stopMarkers =
    /^(codes?)\s*:|select\s+the\s+correct|choose\s+the\s+correct|which\s+of\s+the|how\s+many/i;

  let scanEnd = lines.length;
  for (let i = scanStart; i < lines.length; i++) {
    if (stopMarkers.test(lines[i])) {
      scanEnd = i;
      break;
    }
  }

  const items: { label: string; text: string }[] = [];
  for (let i = scanStart; i < scanEnd; i++) {
    const line = lines[i];
    if (/^(list|column)\s*[-–—]?\s*ii\b/i.test(line)) continue;
    const m = line.match(ANY_LABEL_LINE);
    if (m) {
      items.push({ label: m[1], text: m[2] });
    } else if (items.length > 0) {
      items[items.length - 1].text += " " + line;
    }
  }

  if (items.length < 2) return null;

  // A genuine single-list chronology has one label type throughout (e.g. all
  // roman numerals). If two label types are present it's actually a
  // two-column matching table that tryParseMatchingTable should have caught
  // (or a different structure entirely) — defer to the plain renderer.
  const types = new Set(items.map((it) => classifyLabel(it.label)));
  if (types.size > 1) return null;

  const intro = lines.slice(0, scanStart).join("\n");
  const outro = lines.slice(scanEnd).join("\n").trim();
  return { intro, items, outro };
}

function parse(text: string): Parsed {
  const raw = text ?? "";
  const lower = raw.toLowerCase();
  const normalized = normalizeQuestionText(raw);
  const lines = splitLines(normalized);



  // ---------- Match / List I – List II / Column I – Column II / Consider the following pairs ----------
  // A single, unified detector handles blocked lists (List I ... List II ...),
  // interleaved rows (A. .. 1. .. B. .. 2. ..), and side-by-side single-line
  // rows (A. foo    1. bar) — see tryParseMatchingTable for details.
  const matchTable = tryParseMatchingTable(lines);
  if (matchTable) {
    return { kind: "pairs", ...matchTable };
  }

  // ---------- Recovery for malformed Match the Following questions ----------
  // Only consulted when tryParseMatchingTable() above returned null. See
  // tryRecoverMatchingTable() for details.
  const recoveredMatchTable = tryRecoverMatchingTable(lines);
  if (recoveredMatchTable) {
    return { kind: "pairs", ...recoveredMatchTable };
  }

  // ---------- Chronology / "arrange in order" (single List I, no List II) ----------
  const chronology = tryParseChronology(lines);
  if (chronology) {
    return { kind: "chronology", ...chronology };
  }

  // ---------- Malformed matching-table fallback guard ----------
  // If the text is clearly a List I / Column I style matching question but
  // tryParseMatchingTable() (and tryParseChronology()) couldn't confidently
  // structure it, stop here rather than letting the numbered-statements /
  // pairs parsers below pick up its leftover A./1./B./2. labels, which
  // produces broken, interleaved statement cards.
  if (lines.some((l) => /^(list|column)\s*[-–—]?\s*i\b/i.test(l))) {
    return { kind: "plain", text: raw };
  }

  // ---------- Assertion / Reason ----------
  const assertionIdx = lines.findIndex((l) => /^\s*(assertion|assertion\s*\(a\))\b/i.test(l));
  const reasonIdx = lines.findIndex((l) => /^\s*(reason|reason\s*\(r\))\b/i.test(l));
  if (assertionIdx >= 0 && reasonIdx >= 0 && reasonIdx > assertionIdx) {
    const intro = lines.slice(0, assertionIdx).join("\n");
    const assertion = lines
      .slice(assertionIdx, reasonIdx)
      .join(" ")
      .replace(/^\s*(assertion\s*\(a\)|assertion)\s*[:\-–—]?\s*/i, "");
    const reason = lines
      .slice(reasonIdx)
      .join(" ")
      .replace(/^\s*(reason\s*\(r\)|reason)\s*[:\-–—]?\s*/i, "");
    return { kind: "assertion", intro, assertion, reason, outro: "" };
  }
// ---------- Consider the following pairs ----------
if (/consider\s+the\s+following\s+pairs?/i.test(lower)) {
  const introEnd = lines.findIndex((l) =>
    /consider\s+the\s+following\s+pairs?/i.test(l),
  );

  const items: { label: string; text: string }[] = [];

  let end = introEnd + 1;

  const outroStarters =
    /^(which\b|how\s+many\b|select\b|choose\b|code:)/i;

  for (let i = introEnd + 1; i < lines.length; i++) {
    let line = lines[i];

    if (outroStarters.test(line)) {
      break;
    }

    const m = line.match(NUM_LINE);

    if (m) {
      items.push({
        label: m[1],
        text: m[2],
      });
      end = i + 1;
    } else if (items.length > 0) {
      // Continuation line of a multiline statement.
      items[items.length - 1].text += " " + line;
      end = i + 1;
    } else {
      break;
    }
  }

  if (items.length >= 2) {
    const intro = lines.slice(0, introEnd + 1).join("\n");
    const outro = lines
  .slice(end)
  .join("\n")
  .replace(/^[A-Da-d][.)]\s*$/m, "")
  .trim();

    return {
      kind: "statements",
      intro,
      items,
      outro,
    };
  }
}
  // ---------- Numbered statements ----------
  if (
  /consider\s+the\s+following\s+statements?/i.test(lower) ||
  (
    lines.filter((l) => NUM_LINE.test(l)).length >= 2 &&
    /select\s+the\s+correct|choose\s+the\s+correct|code\s+given\s+below|which\s+of\s+the|how\s+many/i.test(lower)
  )
) {
    let introEnd = lines.findIndex((l) =>
  /consider\s+the\s+following\s+statements?/i.test(l)
);

// Generic UPSC format:
// Intro text
// 1.
// 2.
// 3.
// Select the correct answer...
if (introEnd === -1) {
  introEnd = lines.findIndex((l) => NUM_LINE.test(l)) - 1;
}

if (introEnd < 0) {
  introEnd = 0;
}
    const items: { label: string; text: string }[] = [];
    let end = introEnd + 1;
   const outroStarters =
  /^(which\b|how\s+many\b|select\b|choose\b|code:)/i;

for (let i = introEnd + 1; i < lines.length; i++) {
  let line = lines[i];

  // Detect lines like:
  // d. Which...
  // a. How many...
  // B. Select...
  const cleanedLine = line.replace(/^[A-Da-d][.)]\s*/i, "");

if (
  /^(which\b|how\s+many\b|select\b|choose\b|code:)/i.test(cleanedLine)
) {
  lines[i] = cleanedLine;
  break;
}
// Ignore orphan labels like "a.", "b.", "c.", "d."
if (/^[A-Da-d][.)]\s*$/.test(line)) {
  continue;
}
  const m = line.match(NUM_LINE);

  if (m) {
    items.push({
      label: m[1],
      text: m[2],
    });
    end = i + 1;
  } else if (items.length > 0) {
    // Continuation line of a multiline statement.
    items[items.length - 1].text += " " + line;
    end = i + 1;
  } else {
    break;
  }
}
    if (items.length >= 2) {
      const intro = lines.slice(0, introEnd + 1).join("\n");
      const outro = lines
  .slice(end)
  .join("\n")
  .replace(/^[A-Da-d][.)]\s*$/m, "")
  .trim();
      return { kind: "statements", intro, items, outro };
    }
  }

  return { kind: "plain", text: raw };
}

// Helper to safely separate the label (e.g., "1.") from the statement text
function splitMatchRow(s: string): { label: string; text: string } {
  const match = s.match(/^([0-9IVXivx]+|[A-Da-d])\.\s+(.+)$/);
  if (match) {
    return { label: `${match[1]}.`, text: match[2] };
  }
  return { label: "", text: s };
}

// Presentational-only helper: a "statements" block's intro can end with a
// fully-formed second labelled group (e.g. "A. .. \nB. .. \nC. .. \nD. ..")
// that belongs together with the statement items as a two-column matching
// question (List I / List II), rather than being a separate lead-in
// paragraph. This does not change parse()/detection or the "kind" that was
// already assigned — it only decides, at render time, whether the existing
// intro text should be split so it can be laid out side-by-side with the
// items. Returns null whenever the intro doesn't cleanly resolve to such a
// group, in which case the caller falls back to the original layout.
function extractMatchingIntroGroup(
  intro: string,
  itemCount: number,
): { plainIntro: string; group: { label: string; text: string }[] } | null {
  if (!intro) return null;
  const introLines = intro
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (introLines.length < 2) return null;

  // Walk backwards from the end of the intro, collecting consecutive
  // labelled lines that all share the same label "type" (e.g. all alpha).
  const collected: { label: string; text: string; type: string }[] = [];
  let cursor = introLines.length - 1;
  while (cursor >= 0) {
    const m = introLines[cursor].match(ANY_LABEL_LINE);
    if (!m) break;
    const type = classifyLabel(m[1]);
    if (collected.length > 0 && collected[0].type !== type) break;
    collected.unshift({ label: m[1], text: m[2], type });
    cursor--;
  }

  if (collected.length < 2 || collected.length !== itemCount) return null;

  return {
    plainIntro: introLines.slice(0, cursor + 1).join("\n"),
    group: collected,
  };
}

// Shared two-column matching layout (List I / List II style): two
// responsive columns, rows aligned, equal spacing, collapsing to a single
// column only on very narrow screens. Extracted so both the "table" variant
// of a genuine matching question and a "statements" block whose intro
// contains an embedded matching group render identically.
function MatchingTable({
  headerA,
  headerB,
  rows,
}: {
  headerA: string;
  headerB: string;
  rows: { a: string; b: string }[];
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-md"
    >
      <div className="grid grid-cols-2">
        <div className="border-r border-white/10 bg-primary/10 px-4 py-2.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-primary">
            {headerA}
          </span>
        </div>
        <div className="bg-primary/10 px-4 py-2.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-primary">
            {headerB}
          </span>
        </div>
      </div>
      <div className="divide-y divide-white/5">
        {rows.map((r, i) => {
          const rowA = splitMatchRow(r.a);
          const rowB = splitMatchRow(r.b);
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.24, delay: i * 0.05, ease: "easeOut" }}
              className={cn(
                "grid grid-cols-2 items-stretch transition-colors",
                i % 2 === 1 && "bg-white/[0.02]",
                "hover:bg-white/[0.06]",
              )}
            >
              <div className="border-r border-white/5 px-4 py-2.5">
                <span className="mr-2 font-semibold text-primary nums">{rowA.label}</span>
                <span className="text-sm leading-relaxed text-foreground/90">{rowA.text}</span>
              </div>
              <div className="px-4 py-2.5">
                <span className="mr-2 font-semibold text-primary nums">{rowB.label}</span>
                <span className="text-sm leading-relaxed text-foreground/90">{rowB.text}</span>
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}

export function QuestionContent({ text, className }: { text: string; className?: string }) {
  const parsed = parse(text);

  if (parsed.kind === "plain") {
    return <p className={cn("whitespace-pre-wrap leading-snug", className)}>{parsed.text}</p>;
  }

  // ---------- Consider the following statements ----------
  if (parsed.kind === "statements") {
    // Purely presentational: if the intro already ends with a fully-formed
    // second labelled group (e.g. A./B./C./D. immediately preceding the
    // 1./2./3./4. items), this is really a two-column matching question.
    // Render it side-by-side instead of the label group and the item list
    // stacking as two separate vertical blocks.
    const introGroup = extractMatchingIntroGroup(parsed.intro, parsed.items.length);
    if (introGroup) {
      const itemsType = classifyLabel(parsed.items[0].label);
      const groupType = classifyLabel(introGroup.group[0].label);
      if (groupType !== itemsType) {
        const rows = introGroup.group.map((g, i) => ({
          a: `${g.label}. ${g.text}`,
          b: `${parsed.items[i].label}. ${parsed.items[i].text}`,
        }));
        return (
          <div className={cn("space-y-4", className)}>
            {introGroup.plainIntro && (
              <p className="whitespace-pre-wrap leading-snug">{introGroup.plainIntro}</p>
            )}
            <MatchingTable headerA="List I" headerB="List II" rows={rows} />
            {parsed.outro && <p className="whitespace-pre-wrap leading-snug">{parsed.outro}</p>}
          </div>
        );
      }
    }

    return (
      <div className={cn("space-y-3", className)}>
        {parsed.intro && <p className="whitespace-pre-wrap leading-snug">{parsed.intro}</p>}
        <ol className="list-none space-y-2">
          {parsed.items.map((s, i) => (
            <motion.li
              key={s.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, delay: i * 0.06, ease: "easeOut" }}
              className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 backdrop-blur-md"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-primary/40 bg-primary/10 text-sm font-semibold text-primary nums">
                {s.label}
              </span>
              <span className="pt-0.5 text-sm leading-relaxed text-foreground/90">{s.text}</span>
            </motion.li>
          ))}
        </ol>
        {parsed.outro && <p className="whitespace-pre-wrap leading-snug">{parsed.outro}</p>}
      </div>
    );
  }

  // ---------- Match the Following (table) / Consider the following pairs (rows) ----------
  if (parsed.kind === "pairs") {
    if (parsed.variant === "rows") {
      return (
        <div className={cn("space-y-4", className)}>
          {parsed.intro ? (
            <p className="whitespace-pre-wrap leading-snug">{parsed.intro}</p>
          ) : (
            <p className="mb-2 font-medium text-primary">Consider the following pairs:</p>
          )}
          <div className="space-y-2">
            {parsed.rows.map((r, i) => {
              const rowA = splitMatchRow(r.a);
              const rowB = splitMatchRow(r.b);
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.28, delay: i * 0.06, ease: "easeOut" }}
                  className="grid grid-cols-1 divide-y divide-white/10 rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-md sm:grid-cols-2 sm:divide-x sm:divide-y-0"
                >
                  <div className="px-4 py-3">
                    {rowA.label && (
                      <span className="mr-2 font-semibold text-primary nums">{rowA.label}</span>
                    )}
                    <span className="text-sm leading-relaxed text-foreground/90">{rowA.text}</span>
                  </div>
                  <div className="px-4 py-3">
                    {rowB.label && (
                      <span className="mr-2 font-semibold text-primary nums">{rowB.label}</span>
                    )}
                    <span className="text-sm leading-relaxed text-foreground/90">{rowB.text}</span>
                  </div>
                </motion.div>
              );
            })}
          </div>
          {parsed.outro && <p className="whitespace-pre-wrap leading-snug">{parsed.outro}</p>}
        </div>
      );
    }

    // "table" variant: List I / List II or Column I / Column II matching table.
    return (
      <div className={cn("space-y-4", className)}>
        {parsed.intro && <p className="whitespace-pre-wrap leading-snug">{parsed.intro}</p>}
        <MatchingTable headerA={parsed.headerA} headerB={parsed.headerB} rows={parsed.rows} />
        {parsed.outro && <p className="whitespace-pre-wrap leading-snug">{parsed.outro}</p>}
      </div>
    );
  }

  // ---------- Chronology / arrange in order ----------
  if (parsed.kind === "chronology") {
    return (
      <div className={cn("space-y-4", className)}>
        {parsed.intro && <p className="whitespace-pre-wrap leading-snug">{parsed.intro}</p>}
        <div className="relative pl-9">
          <div className="absolute bottom-2 left-[13px] top-2 w-px bg-gradient-to-b from-primary/50 via-primary/20 to-transparent" />
          <div className="space-y-2.5">
            {parsed.items.map((it, i) => (
              <motion.div
                key={it.label}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.28, delay: i * 0.07, ease: "easeOut" }}
                className="relative"
              >
                <span className="absolute -left-9 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-primary/40 bg-background text-xs font-semibold text-primary nums">
                  {it.label}
                </span>
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2.5 backdrop-blur-md">
                  <span className="text-sm leading-relaxed text-foreground/90">{it.text}</span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
        {parsed.outro && <p className="whitespace-pre-wrap leading-snug">{parsed.outro}</p>}
      </div>
    );
  }

  // ---------- Assertion / Reason ----------
  return (
    <div className={cn("space-y-3", className)}>
      {parsed.intro && <p className="whitespace-pre-wrap leading-snug">{parsed.intro}</p>}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, ease: "easeOut" }}
        className="rounded-2xl border border-sky-400/25 bg-sky-500/[0.07] px-4 py-3 backdrop-blur-md"
      >
        <p className="mb-1 text-sm font-semibold tracking-wide text-sky-400">Assertion (A)</p>
        <p className="text-sm leading-relaxed text-foreground/90">{parsed.assertion}</p>
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, delay: 0.07, ease: "easeOut" }}
        className="rounded-2xl border border-fuchsia-400/25 bg-fuchsia-500/[0.07] px-4 py-3 backdrop-blur-md"
      >
        <p className="mb-1 text-sm font-semibold tracking-wide text-fuchsia-400">Reason (R)</p>
        <p className="text-sm leading-relaxed text-foreground/90">{parsed.reason}</p>
      </motion.div>
    </div>
  );
}
