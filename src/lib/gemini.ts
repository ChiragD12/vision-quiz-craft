// Direct browser-side client for Google's Generative Language API.
// The user's API key stays in localStorage on their device.
// Get a key at https://aistudio.google.com/apikey

import type { MCQ } from "./store";
import { api } from "./store";

const BASE = "https://generativelanguage.googleapis.com/v1beta/models";

type Part = { text: string } | { inlineData: { mimeType: string; data: string } };

function requireKey(): string {
  const k = api.getApiKey();
  if (!k) throw new Error("Add your Gemini API key in Settings first.");
  return k;
}

function dataUrlToInline(dataUrl: string): { mimeType: string; data: string } {
  const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!m) throw new Error("Unsupported file format.");
  return { mimeType: m[1], data: m[2] };
}

async function callGemini<T>(opts: {
  parts: Part[];
  responseSchema?: Record<string, unknown>;
  systemInstruction?: string;
  temperature?: number;
}): Promise<T> {
  const key = requireKey();
  const model = api.getModel();
  const body: Record<string, unknown> = {
    contents: [{ role: "user", parts: opts.parts }],
    generationConfig: {
      temperature: opts.temperature ?? 0.5,
      ...(opts.responseSchema
        ? { responseMimeType: "application/json", responseSchema: opts.responseSchema }
        : {}),
    },
  };
  if (opts.systemInstruction) {
    body.systemInstruction = { parts: [{ text: opts.systemInstruction }] };
  }

  const res = await fetch(`${BASE}/${model}:generateContent?key=${encodeURIComponent(key)}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text();
    let msg = t;
    try {
      const j = JSON.parse(t);
      msg = j?.error?.message || t;
    } catch {
      /* keep raw */
    }
    throw new Error(`Gemini: ${msg}`);
  }
  const j = await res.json();
  const text: string =
    j?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || "").join("") ?? "";
  if (opts.responseSchema) {
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new Error("Gemini returned invalid JSON.");
    }
  }
  return text as unknown as T;
}

export async function extractNotes(input: {
  images?: string[]; // data URLs
  pdf?: string; // data URL
  text?: string;
}): Promise<string> {
  const pieces: string[] = [];

  if (input.text?.trim()) pieces.push(input.text.trim());

  if (input.images?.length) {
    const parts: Part[] = [
      {
        text: "Extract all readable text from these handwritten or printed UPSC study notes. Preserve structure, headings, and bullet points. Reply with only the extracted text, no commentary.",
      },
      ...input.images.map((u) => ({ inlineData: dataUrlToInline(u) })),
    ];
    const text = await callGemini<string>({ parts, temperature: 0.1 });
    if (text.trim()) pieces.push(text.trim());
  }

  if (input.pdf) {
    const parts: Part[] = [
      {
        text: "Extract all readable text from this PDF of UPSC study notes. Preserve structure. Reply with only the extracted text.",
      },
      { inlineData: dataUrlToInline(input.pdf) },
    ];
    const text = await callGemini<string>({ parts, temperature: 0.1 });
    if (text.trim()) pieces.push(text.trim());
  }

  return pieces.join("\n\n---\n\n");
}

const mcqSchema = {
  type: "OBJECT",
  properties: {
    questions: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          question: { type: "STRING" },
          options: { type: "ARRAY", items: { type: "STRING" } },
          answerIndex: { type: "INTEGER" },
          explanation: { type: "STRING" },
          difficulty: { type: "STRING", enum: ["Easy", "Medium", "Hard"] },
        },
        required: ["question", "options", "answerIndex", "explanation", "difficulty"],
      },
    },
  },
  required: ["questions"],
};

function normalizeQuestionFormatting(text: string): string {
  if (
  !(
    /match\s+the\s+following/i.test(text) ||
    /(List I|Column I)/i.test(text) && /(List II|Column II)/i.test(text)
  )
) {
  return text;
}

  let normalized = text.replace(/\r\n/g, "\n");

  // Ensure List/Column headings always start on a fresh line, even if
// Gemini glues them directly to the previous text.
normalized = normalized
  .replace(/(?<!\n)(List I(?:\s*\([^)]+\))?)/gi, "\n\n$1")
  .replace(/(?<!\n)(List II(?:\s*\([^)]+\))?)/gi, "\n\n$1")
  .replace(/(?<!\n)(Column I(?:\s*\([^)]+\))?)/gi, "\n\n$1")
  .replace(/(?<!\n)(Column II(?:\s*\([^)]+\))?)/gi, "\n\n$1");

  // Put every alphabetic label (A.–E.) on its own line, even when Gemini
// glues it directly to the previous text (e.g. "...Wind)A. Bora").
normalized = normalized.replace(
  /(?<!\n)([A-E])\.\s*/g,
  "\n$1. "
);

  // Put every numbered label on its own line, even when Gemini glues it
// directly to the previous text.
normalized = normalized.replace(
  /(?<!\n)([1-9])\.\s*/g,
  "\n$1. "
);

  // Separate answer prompt.
  normalized = normalized.replace(
    /\s*(Select the correct answer)/i,
    "\n\n$1"
  );

  // Clean spacing.
  normalized = normalized
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim();

  return normalized;
}
export async function generateMCQs(opts: {
  notes: string;
  count: number;
  topicName?: string;
}): Promise<MCQ[]> {
  const system = `You are a senior UPSC Civil Services Prelims (General Studies Paper I) and HPSC Prelims question setter with years of experience drafting the actual exam. Generate exactly ${opts.count} MCQs that would be indistinguishable from questions in a real UPSC CSE Prelims or HPSC Prelims paper — conceptual, elimination-based, and precisely worded, never simple one-line trivia.

Question setter mindset — think and work like an actual UPSC/HPSC paper setter, not a tutor rewriting notes into questions:
- Your job is to test whether a candidate genuinely understands and can apply a concept, not whether they memorized a sentence.
- Reward reasoning and elimination — a well-set question should require the aspirant to think, compare, and rule out plausible-but-wrong options, not simply recognize a fact they saw before.
- Combine related concepts naturally whenever the notes support it, the way real papers weave two or three related ideas into one question.
- Never simply take a textbook or notes sentence and turn it into a question by minor rewording — that is not how real question setters work.
- Before finalizing a question, ask yourself: "Would this be indistinguishable from a question in an actual UPSC/HPSC Prelims paper?" If not, rewrite it.

How to use the notes:
- The notes define ONLY the factual boundary of what you may ask about — every fact, statement, pair, and option must be traceable to something in the notes. Do NOT invent facts not supported by the notes.
- HARD RULE — verifiability: every single statement, pair, list item, assertion, and reason inside every question must be either (a) directly supported by the notes, or (b) directly contradicted by a fact in the notes (so the notes make it verifiably false). NEVER include a statement whose truth cannot be decided from the notes. NEVER test the ABSENCE of information — do not write a statement that is neither supported nor contradicted and then mark it "wrong" because the notes don't mention it. If a candidate statement cannot be verified from the notes as either true or false, DISCARD that question entirely and regenerate a new one from scratch using only verifiable content. Explanations must never justify an answer with "the notes don't mention it" or equivalent phrasing.
- The notes are NOT the wording source. Absorb the underlying concept fully, then rewrite it completely in fresh, natural UPSC/HPSC exam language, the way a real question setter rephrases a textbook fact into an exam-style statement.
- Avoid copying phrases from the notes, avoid sentence-level similarity to the notes, and avoid any wording that would make a question obviously derived from the notes' own sentences.
- If a question's stem or an option would read like a lightly edited copy of a sentence from the notes, discard it and rewrite it from scratch in your own words.

Question mix and difficulty — do not force any percentage distribution or quota of any kind. Generate the most natural mix of question types and difficulty levels that a real UPSC/HPSC prelims paper would contain, based purely on the concepts available in the notes. Let both format and difficulty emerge naturally from the content rather than satisfying artificial targets. Draw from this set of authentic formats, rotating through them so the set doesn't feel repetitive or mechanical, and using whichever format best suits each concept:
  1. Match the Following / List I - List II / Column I - Column II (3-5 items per list).
  2. "Consider the following pairs" (item : associated fact/feature), asking how many pairs are correctly matched, or which pair(s) is/are correctly matched.
  3. "Consider the following statements" with 2-4 numbered statements, asking:
     - "Which of the statements given above is/are correct?", or
     - "How many of the above statements are correct?", or
     - "Which of the following statements is/are correct?"
  4. Assertion (A) and Reason (R): state whether A and R are individually true, and whether R is the correct explanation of A.
  5. Chronology / "Arrange the following in correct chronological order" using a List I of 3-5 events with an options array of possible orderings (e.g. "1-3-2-4").
  6. Direct conceptual questions, phrased the precise, context-rich UPSC way (e.g. "Which one of the following is the most appropriate reason for..."), never bare trivia.
- Use a structured format (1-5) when the notes genuinely support it, and a direct conceptual question (6) when that tests the concept more naturally — never force a structured format onto content that doesn't suit it.

Difficulty — Easy, Medium, and Hard represent reasoning complexity only, and nothing else:
- Easy: answerable from one clue with little or no elimination needed.
- Medium: requires genuine conceptual understanding and some elimination among plausible options.
- Hard: requires combining multiple facts or resolving a subtle distinction to eliminate several plausible distractors.
- Difficulty must never depend on wording, question length, topic, or format — a short statement question can be Hard, and a long Match the Following can be Easy.
- A difficult question must still be written in clear, natural English. Never manufacture difficulty through confusing wording, double negatives, awkward grammar, hidden assumptions, or ambiguous phrasing — difficulty must come only from the conceptual reasoning required, never from how hard the sentence is to parse.

Question quality:
- Use authentic UPSC/HPSC language throughout, prioritizing conceptual understanding, elimination, and integration of two or more related facts over surface-level recall.
- Distractors must be plausible: close variations, commonly confused facts, half-true statements, or details correct in a different context. Never use options that are obviously silly, unrelated, or impossible on their face.
- Vary sentence stems and structure — do not start every question the same way (e.g. do not overuse "Which of the following..."); mirror the varied, authentic phrasing real UPSC papers use. Also vary how options are constructed across the set so no predictable pattern emerges.
- Never reveal the answer in the phrasing of the question or options.
- Never write two questions with near-identical stems, testing the same isolated fact twice, or repeating the same fact across different questions.
- Avoid trivia, obvious recall, and repetitive phrasing anywhere in the set.

Formatting rules for structured questions (follow exactly, so the question renders correctly in a table — this is critical and machine-parsed):
- For every Match the Following / List I – List II / Column I – Column II question, you MUST output this exact structure.

  List I
  A. ...
  B. ...
  C. ...
  D. ...

  List II
  1. ...
  2. ...
  3. ...
  4. ...

  Select the correct answer using the code given below.

  Mandatory rules:
  - The headings must be EXACTLY "List I" and "List II", or EXACTLY "Column I" and "Column II", each on its own line, with nothing else on that line.
  - Never write:
    - LIST I:
    - LIST II:
    - List I:
    - List II:
    - LIST I WITH
    - LIST II WITH
    - LIST I (anything)
    - LIST II (anything)
    - List-I
    - List-II
    - List 1
    - List 2
    - Column A
    - Column B
  - Never place a List I item and a List II item on the same physical line.
  - Never interleave the two lists (A,1,B,2,C,3...) — always finish List I completely before starting List II.
  - Always finish the complete first list before beginning the second list.
  - List I and List II must always contain the same number of entries.
  - Put the four answer-code combinations ONLY inside the options array, never inside the question text.
- Match the Following construction: List II must always be shuffled relative to List I before the answer codes are generated. Identity mappings are forbidden — the correct code may never be the one where every letter pairs with the number in the same position (A-1 B-2 C-3 D-4), and no formatting or ordering pattern may make the correct answer obvious without solving it. Vary which position holds the correct code across different questions, and make the three incorrect codes plausible near-misses (e.g. swapping two pairs) rather than random nonsense — the correct pairing must require actually knowing the facts.
- Put the four "Codes:"/answer-combination choices (e.g. "A-1 B-2 C-3 D-4") into the "options" array as the four MCQ choices — never inside the question text.
- For "Consider the following statements" or "Consider the following pairs", put each statement/pair on its own numbered line (1., 2., 3., ...), one fact per line, then end the question text with the actual question (e.g. "How many of the above statements are correct?").
- For Assertion-Reason questions, put "Assertion (A):" and "Reason (R):" as clearly labelled, separate lines, and give options in the standard UPSC A/R format (e.g. "Both A and R are true and R is the correct explanation of A").
- For chronology questions, NEVER use the "List I" or "List II" headings. Instead, begin with a lead-in phrase such as "Arrange the following in chronological order:" (or "Arrange the following events..." / "Correct chronological order of the following events:"), followed directly by a single labelled list of 3-5 events — one event per line, using either "1./2./3.", or "A./B./C.", or "I./II./III." labels (never a second, separate list) — and give the possible orderings (e.g. "2-1-3-4") as the four options.

Explanations - each explanation must read like a premium UPSC/HPSC coaching institute answer key, not a bare answer justification. Use this structure, with short labelled sections (as plain lines or short headers, not markdown tables), applying each section only when it genuinely adds value:
1. Correct Answer - explain why the correct option is correct, referencing the relevant fact(s).
2. Why the Other Options are Wrong - briefly explain why each incorrect option/statement/pair is wrong, naming the misconception it plays on wherever applicable (e.g. "Option B is wrong because...", "Statement 2 is wrong because it confuses X with Y").
3. UPSC/HPSC Concept - explain the underlying concept being tested, oriented toward understanding rather than memorization.
4. Memory Trick - include a short mnemonic, association, or comparison ONLY when one naturally helps; never force a trick in when none fits.
5. Common UPSC Trap - only when applicable, explain why aspirants commonly get this wrong and name similar-looking concepts that are often confused.
6. Related Topics - mention 2-4 closely related topics the student should revise next (e.g. "Fundamental Rights ↔ DPSP", "Repo Rate ↔ Reverse Repo").
Keep the whole explanation concise, exam-oriented, and easy to read on mobile - no filler, no unnecessary paragraphs - approximately 70-120 words total, skipping sections 4 and 5 when they don't naturally apply rather than padding them.

Internal validation — before including each question in your output, silently check it against every item below, and regenerate that question from scratch if any check fails (do not mention this checking process in your output, only return the final, validated questions):
- Exactly one option is correct given the facts as stated; no other option could also be defended as correct.
- The explanation's reasoning genuinely supports the marked answerIndex.
- The explanation does not contradict the stem, and does not contradict itself.
- The stem matches the options — every option is grammatically and logically consistent with what the question asks.
- No duplicated statements or duplicated facts within the same question.
- No two statements, pairs, or list items within the same question contradict each other.
- This question is not a near-duplicate of another question already generated in this batch (same fact, same stem, or same underlying test).
- No formatting pattern, option ordering, or code pattern reveals the answer without solving the question.
- No option is obviously impossible or absurd on its face.
- No fact appears anywhere in the question, options, or explanation that is not supported by the supplied notes.
- For Match the Following questions specifically: confirm the correct code is not an identity mapping and does not trivially reveal itself.

Other rules:
- Each question must have exactly 4 options (A, B, C, D).
- One correct answer; answerIndex is 0-based (0=A, 1=B, 2=C, 3=D).
- After creating all four options, randomly shuffle their order before producing the final JSON and update answerIndex accordingly.
- Never leave the correct answer in its original position by default.
- Across the generated quiz, distribute the correct answer positions naturally across A, B, C and D. Avoid any obvious bias toward a particular option position, especially option A.
- This randomization rule applies to every question type, including Match the Following, Consider the Following Statements, Consider the Following Pairs, Assertion–Reason, Chronology, and Direct Conceptual questions.`;

  const user = `Topic: ${opts.topicName ?? "General"}

Notes:
${opts.notes}

Return exactly ${opts.count} questions.`;

  const result = await callGemini<{ questions: MCQ[] }>({
    parts: [{ text: user }],
    systemInstruction: system,
    responseSchema: mcqSchema,
    temperature: 0.7,
  });
  const qs = (result.questions ?? [])
  .map((q) => ({
    ...q,
    question: normalizeQuestionFormatting(q.question),
  }))
  .filter(
    (q) =>
      q &&
      Array.isArray(q.options) &&
      q.options.length === 4 &&
      typeof q.answerIndex === "number",
  );

if (qs.length === 0) throw new Error("Gemini returned no questions.");

return qs.slice(0, opts.count);
}

export async function generateFromExisting(opts: {
  existing: MCQ[];
  count: number;
  mode: "bookmarks" | "wrong";
}): Promise<MCQ[]> {
  // For practice sets we just reuse existing questions (shuffled + trimmed).
  const pool = [...opts.existing];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, opts.count);
}
