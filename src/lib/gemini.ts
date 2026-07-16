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
- HARD RULE — verifiability, and it applies to every single piece of text you generate, with no exceptions: the question stem, every numbered statement, every option, every Match the Following / List I / List II entry, the Assertion, the Reason, every chronology event, and every line of the explanation. Each one of these, individually, must satisfy exactly one of two conditions: (a) it is directly supported by the notes, or (b) it is directly contradicted by a fact stated in the notes (so the notes make it verifiably false). No third case is permitted.
- NEVER use external/general knowledge to construct a statement, option, or fact and then mark it correct or incorrect based on what you personally know rather than what the notes say — even if the fact is true in the real world, if it is not directly supported or directly contradicted by the notes, it may not appear anywhere in the question.
- NEVER treat the absence of information in the notes as evidence that a statement is false. A statement the notes simply do not mention is neither correct nor incorrect — it is UNUSABLE. Do not write such a statement and then mark it "wrong" because the notes are silent on it.
- If, after drafting a question, even one statement, option, pair, assertion, reason, or chronology event cannot be confidently classified as (a) directly supported or (b) directly contradicted by the notes, DISCARD THE ENTIRE QUESTION and generate a different one from scratch using only verifiable content. Do not patch, hedge, or keep a partially-verifiable question.
- Explanations must never use, or imply, phrases such as "the notes don't mention...", "not given in the notes...", "the notes are silent...", "it is not stated...", or any equivalent hedge. Every line of the explanation must state a fact that is directly supported or directly contradicted by the notes — never reason from what the notes fail to say.
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
- For Assertion-Reason questions, you MUST output this exact structure, so the parser can reliably separate the Assertion, the Reason, and the closing question prompt:

  Assertion (A):
  <assertion text>

  Reason (R):
  <reason text>

  Which one of the following is correct?

  Mandatory formatting rules:
  - "Assertion (A):" must always begin on its own line.
  - "Reason (R):" must always begin on its own line.
  - Leave ONE blank line before "Reason (R):".
  - Leave ONE blank line after the Reason text before the closing question prompt.
  - Never append the closing question to the Reason paragraph.
  - Never append answer options after the Reason.
  - Never include any answer choice text inside the question body.
  - The four UPSC Assertion-Reason answer choices (e.g. "Both A and R are true and R is the correct explanation of A") must exist ONLY inside the "options" array in the JSON output.
- For chronology questions, NEVER use the "List I" or "List II" headings. Instead, begin with a lead-in phrase such as "Arrange the following in chronological order:" (or "Arrange the following events..." / "Correct chronological order of the following events:"), followed directly by a single labelled list of 3-5 events — one event per line, using either "1./2./3.", or "A./B./C.", or "I./II./III." labels (never a second, separate list) — and give the possible orderings (e.g. "2-1-3-4") as the four options.

Explanations - each explanation must read like a premium UPSC/HPSC coaching institute answer key, not a bare answer justification. The "explanation" field remains a single string (never split into multiple JSON fields) but that string must be laid out using short line-by-line labelled sections, optimized for quick scrolling on a mobile screen, in exactly this order and with exactly these labels:

Correct Answer
<one to two lines stating which option is correct and why, referencing the exact fact(s) from the notes that make it correct>

Option A
Correct / Incorrect
<one concise line stating precisely why this option is correct or incorrect>

Option B
Correct / Incorrect
<one concise line stating precisely why this option is correct or incorrect>

Option C
Correct / Incorrect
<one concise line stating precisely why this option is correct or incorrect>

Option D
Correct / Incorrect
<one concise line stating precisely why this option is correct or incorrect>

Concept Tested
<one to two lines on the underlying concept being tested, oriented toward understanding rather than memorization>

Related Topics
<2-4 closely related topics the student should revise next (e.g. "Fundamental Rights ↔ DPSP", "Repo Rate ↔ Reverse Repo")>

Rules for this structure:
- Always cover all four options individually — never skip one, and never merge two options into a single line.
- State precisely why each incorrect option is wrong (name the misconception it plays on wherever applicable, e.g. "confuses X with Y") and precisely why the correct option is right — never a vague "this is incorrect" without a stated reason.
- For question types where the four MCQ choices are answer-codes, A/R combinations, or orderings rather than plain statements (Match the Following, Assertion-Reason, Chronology, Consider the following statements/pairs, etc.), "Option A/B/C/D" refers to the four choices exactly as they appear in the options array — explain what each one claims and why it is correct or incorrect.
- Do not repeat the same justification across multiple options or sections — each line must add new information.
- Every fact used in every section must be directly supported or directly contradicted by the notes, per the verifiability rule above — never justify an option using external knowledge or the absence of information in the notes.
- Keep the whole explanation concise and exam-oriented - short lines, no filler, no unnecessary paragraphs - approximately 90-150 words total.

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
- No fact appears anywhere in the question stem, statements, options, Match the Following entries, Assertion, Reason, chronology events, or explanation that is not either directly supported or directly contradicted by the supplied notes — if any single piece cannot be classified as one or the other, discard the entire question and regenerate a different one from scratch.
- No option's correctness depends on external/general knowledge, and no option is marked incorrect merely because the notes are silent on it.
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