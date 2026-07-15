// Local-first storage. Everything lives in localStorage on the user's device.
// No backend, no accounts. Export/import a JSON backup to move devices.
//
// v2 additions are additive/optional so v1 data continues to load unchanged:
//   - Subject.kind ('core' | 'custom'), Subject.hidden
//   - Quiz.per_q_seconds
//   - StreakDay[]
// Core subjects are seeded on first read.

import { CORE_SUBJECTS, isCoreSubjectId, normalizeName } from "@/domain/subjects";
import { todayKey } from "@/domain/streak";
import { validateTopic, validateSubject, isUUID } from "./db-validation";
import { computeUnlockDelta, type UnlockDelta } from "./journey";

export type Note = {
  id: string;
  topic_id: string;
  content: string;
  source: "image" | "pdf" | "text";
  created_at: number;
};

export type Topic = {
  id: string;
  subject_id: string;
  name: string;
  created_at: number;
};

export type Subject = {
  id: string;
  name: string;
  kind?: "core" | "custom";
  hidden?: boolean;
  created_at: number;
};

export type MCQ = {
  question: string;
  options: string[];
  answerIndex: number;
  explanation: string;
  difficulty?: "Easy" | "Medium" | "Hard";
};

export type QuizMode = "classic" | "survival";

export type Quiz = {
  id: string;
  title: string;
  topic_id?: string;
  subject_id?: string;
  question_count: number;
  questions: MCQ[];
  answers: (number | null)[];
  per_q_seconds?: number[];
  current_index: number;
  status: "in_progress" | "completed";
  created_at: number;
  completed_at?: number;
  saved?: boolean;
  saved_at?: number;
  // Centralized mode flag the quiz engine checks to switch behaviour.
  // Absent/"classic" preserves today's behaviour exactly.
  mode?: QuizMode;
};

export type WrongAnswer = {
  id: string;
  question: MCQ;
  topic_name?: string;
  created_at: number;
};

export type Bookmark = {
  id: string;
  question: MCQ;
  topic_name?: string;
  created_at: number;
};

export type StreakDay = { date: string; solved: number };

export type DB = {
  version: 1;
  subjects: Subject[];
  topics: Topic[];
  notes: Note[];
  quizzes: Quiz[];
  bookmarks: Bookmark[];
  wrong_answers: WrongAnswer[];
  streak?: StreakDay[];
  gemini_api_key: string;
  gemini_model: string;
};

const KEY = "upsc_revision_db_v1";
const KEY_APIKEY = "upsc_revision_gemini_key";
const KEY_MASTER_VOLUME = "upsc_master_volume";

const defaultDB = (): DB => ({
  version: 1,
  subjects: [],
  topics: [],
  notes: [],
  quizzes: [],
  bookmarks: [],
  wrong_answers: [],
  streak: [],
  gemini_api_key: "",
  gemini_model: "gemini-2.5-flash",
});

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

// Seed core subjects on first read; mark legacy subjects that match a core
// name as core so they don't duplicate.
function seedCore(db: DB) {
  let changed = false;
  for (const c of CORE_SUBJECTS) {
    const existingCore = db.subjects.find((s) => s.id === c.id);
    if (existingCore) continue;
    const legacy = db.subjects.find(
      (s) => normalizeName(s.name) === normalizeName(c.name) && !isCoreSubjectId(s.id),
    );
    if (legacy) {
      // Migrate: retag existing subject as the core one.
      legacy.id = c.id;
      legacy.kind = "core";
      legacy.name = c.name;
      // Re-point topics
      for (const t of db.topics) if (t.subject_id === legacy.id) t.subject_id = c.id;
      changed = true;
      continue;
    }
    db.subjects.push({
  id: c.id,
  name: c.name,
  kind: "core",
  hidden:
    c.id === "core-modern-history" ||
    c.id === "core-medieval-history" ||
    c.id === "core-ancient-history" ||
    c.id === "core-indian-dances" ||
    c.id === "core-indian-temples",
  created_at: Date.now(),
});
    changed = true;
  }
  // Ensure custom kind on the rest
  for (const s of db.subjects) {
    if (!s.kind) {
      s.kind = isCoreSubjectId(s.id) ? "core" : "custom";
      changed = true;
    }
  }
  return changed;
}

export function load(): DB {
  if (typeof window === "undefined") return defaultDB();
  const parsed = safeParse<DB>(localStorage.getItem(KEY));
  const db = parsed ?? defaultDB();
  if (!db.streak) db.streak = [];
  const changed = seedCore(db);
  const key = localStorage.getItem(KEY_APIKEY);
  if (key) db.gemini_api_key = key;
  if (changed) save(db);
  return db;
}

export function save(db: DB) {
  if (typeof window === "undefined") return;
  const { gemini_api_key, ...rest } = db;
  localStorage.setItem(KEY, JSON.stringify({ ...rest, gemini_api_key: "" }));
  if (gemini_api_key) localStorage.setItem(KEY_APIKEY, gemini_api_key);
  else localStorage.removeItem(KEY_APIKEY);
  window.dispatchEvent(new Event("upsc-db-change"));
}

export function update(mut: (db: DB) => void): DB {
  const db = load();
  mut(db);
  save(db);
  return db;
}

export function uid(): string {
  return crypto.randomUUID();
}

export function hashQuestion(q: MCQ): string {
  let h = 0;
  const s = q.question + "|" + q.options.join("|");
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return "q_" + (h >>> 0).toString(36);
}

// ---------- API ----------

export const api = {
  // ----- Settings
  getApiKey(): string {
    return load().gemini_api_key || "";
  },
  setApiKey(k: string) {
    update((db) => {
      db.gemini_api_key = k.trim();
    });
  },
  getModel(): string {
    return load().gemini_model || "gemini-2.5-flash";
  },
  setModel(m: string) {
    update((db) => {
      db.gemini_model = m;
    });
  },

  // Master volume (0.0–1.0), default 1.0. Persisted the same way the other
  // standalone appearance/settings values in this file are (a dedicated
  // localStorage key, read/written directly, no DB round-trip needed) —
  // same pattern as soundEnabled uses in the appearance store.
  getMasterVolume(): number {
    if (typeof window === "undefined") return 1;
    const raw = localStorage.getItem(KEY_MASTER_VOLUME);
    const n = raw !== null ? parseFloat(raw) : 1;
    return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 1;
  },
  setMasterVolume(v: number) {
    if (typeof window === "undefined") return;
    const clamped = Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 1;
    localStorage.setItem(KEY_MASTER_VOLUME, String(clamped));
    window.dispatchEvent(new Event("upsc-db-change"));
  },

  // ----- Subjects & Topics
  listSubjectsAndTopics() {
    const db = load();
    return { subjects: db.subjects, topics: db.topics };
  },

  visibleSubjects(): Subject[] {
  return load().subjects.filter(
    (s) =>
      !s.hidden &&
      s.id !== "core-modern-history" &&
      s.id !== "core-medieval-history" &&
      s.id !== "core-ancient-history" &&
      s.id !== "core-indian-dances" &&
      s.id !== "core-indian-temples",
  );
},

  allSubjects(): Subject[] {
  return load().subjects;
},

  topicsForSubject(subjectId: string): Topic[] {
    return load().topics.filter((t) => t.subject_id === subjectId);
  },

  ensureSubject(name: string): Subject {
    const trimmed = name.trim();
    const norm = normalizeName(trimmed);
    let sub: Subject | undefined;
    update((db) => {
      sub = db.subjects.find((s) => normalizeName(s.name) === norm);
      if (!sub) {
        sub = { id: uid(), name: trimmed, kind: "custom", hidden: false, created_at: Date.now() };
        db.subjects.push(sub);
      }
    });
    return sub!;
  },

  ensureTopic(subjectId: string, name: string): Topic {
    const trimmed = name.trim();
    const norm = normalizeName(trimmed);
    let t: Topic | undefined;
    update((db) => {
      t = db.topics.find((x) => x.subject_id === subjectId && normalizeName(x.name) === norm);
      if (!t) {
        t = { id: uid(), subject_id: subjectId, name: trimmed, created_at: Date.now() };
        db.topics.push(t);
      }
    });
    return t!;
  },

  renameSubject(id: string, name: string) {
    update((db) => {
      const s = db.subjects.find((x) => x.id === id);
      if (s) s.name = name.trim();
    });
  },
  toggleSubjectHidden(id: string) {
    update((db) => {
      const s = db.subjects.find((x) => x.id === id);
      if (s) s.hidden = !s.hidden;
    });
  },
  deleteSubject(id: string) {
    if (isCoreSubjectId(id)) throw new Error("Core subjects can only be hidden.");
    update((db) => {
      const topicIds = db.topics.filter((t) => t.subject_id === id).map((t) => t.id);
      db.notes = db.notes.filter((n) => !topicIds.includes(n.topic_id));
      db.topics = db.topics.filter((t) => t.subject_id !== id);
      db.subjects = db.subjects.filter((s) => s.id !== id);
    });
  },

  renameTopic(id: string, name: string) {
    update((db) => {
      const t = db.topics.find((x) => x.id === id);
      if (t) t.name = name.trim();
    });
  },
  deleteTopic(id: string) {
    update((db) => {
      db.notes = db.notes.filter((n) => n.topic_id !== id);
      db.topics = db.topics.filter((t) => t.id !== id);
    });
  },

  // ----- Notes / Knowledge
  addNote(topicId: string, content: string, source: Note["source"]): Note {
    const db = load();
    const validation = validateTopic(db, topicId);
    if (!validation.ok) {
      console.error("Failed to add note:", validation.message);
      return { id: "invalid", topic_id: topicId, content: "", source: "text", created_at: 0 };
    }
    const n: Note = { id: uid(), topic_id: topicId, content, source, created_at: Date.now() };
    update((db) => {
      db.notes.push(n);
    });
    return n;
  },
  updateNote(id: string, content: string) {
    update((db) => {
      const n = db.notes.find((x) => x.id === id);
      if (n) n.content = content.trim();
    });
  },
  deleteNote(id: string) {
    update((db) => {
      db.notes = db.notes.filter((n) => n.id !== id);
    });
  },
  notesForTopic(topicId: string): Note[] {
    return load().notes.filter((n) => n.topic_id === topicId);
  },

  // ----- Quizzes
  saveQuiz(q: Quiz) {
    const db = load();
    if (q.topic_id) {
      const v = validateTopic(db, q.topic_id);
      if (!v.ok) {
        console.error("Failed to save quiz:", v.message);
        return;
      }
    }
    if (q.subject_id) {
      const v = validateSubject(db, q.subject_id);
      if (!v.ok) {
        console.error("Failed to save quiz:", v.message);
        return;
      }
    }
    update((db) => {
      const i = db.quizzes.findIndex((x) => x.id === q.id);
      if (i >= 0) db.quizzes[i] = q;
      else db.quizzes.unshift(q);
      // Cap regular quizzes to 50; user-saved quizzes are exempt from the cap
      // so they persist forever until the user deletes them.
      const saved = db.quizzes.filter((x) => x.saved);
      const regular = db.quizzes.filter((x) => !x.saved).slice(0, 50);
      db.quizzes = [...saved, ...regular].sort(
        (a, b) => (b.created_at ?? 0) - (a.created_at ?? 0),
      );
    });
  },
  // Snapshot the current state of a quiz into the permanent Saved library.
  // Creates a deep clone with a new id so future edits to the original quiz
  // don't retroactively mutate the saved snapshot.
  saveQuizToLibrary(id: string): Quiz | undefined {
    const src = api.getQuiz(id);
    if (!src) return undefined;
    const clone: Quiz = JSON.parse(JSON.stringify(src));
    clone.id = uid();
    clone.saved = true;
    clone.saved_at = Date.now();
    update((db) => {
      db.quizzes.unshift(clone);
    });
    return clone;
  },
  savedQuizzes(): Quiz[] {
    return load()
      .quizzes.filter((q) => q.saved)
      .sort((a, b) => (b.saved_at ?? 0) - (a.saved_at ?? 0));
  },
  deleteQuiz(id: string) {
    update((db) => {
      db.quizzes = db.quizzes.filter((q) => q.id !== id);
    });
  },
  getQuiz(id: string): Quiz | undefined {
    return load().quizzes.find((q) => q.id === id);
  },
  inProgressQuiz(): Quiz | undefined {
    const db = load();
    const quiz = db.quizzes.find((q) => q.status === "in_progress" && !q.saved);
    if (!quiz) return undefined;

    // Validate Subject
    if (quiz.subject_id) {
      const v = validateSubject(db, quiz.subject_id);
      if (!v.ok) {
        console.warn("Ignoring corrupted in-progress quiz (invalid subject):", quiz.id);
        return undefined;
      }
    }
    // Validate Topic
    if (quiz.topic_id) {
      const v = validateTopic(db, quiz.topic_id);
      if (!v.ok) {
        console.warn("Ignoring corrupted in-progress quiz (invalid topic):", quiz.id);
        return undefined;
      }
    }
    // Validate Title (no UUID)
    if (isUUID(quiz.title)) {
      console.warn("Ignoring corrupted in-progress quiz (UUID title):", quiz.id);
      return undefined;
    }

    return quiz;
  },
  recentQuizzes(limit = 10): Quiz[] {
    return load()
      .quizzes.filter((q) => !q.saved)
      .slice(0, limit);
  },

  // ----- Survival Mode (best run, local-only — same storage pattern as
  // correctSinceReward/unlockedImageCount above)
  getSurvivalBest(): number {
    if (typeof window === "undefined") return 0;
    const raw = localStorage.getItem("upsc_survival_best_run");
    const n = raw ? parseInt(raw, 10) : 0;
    return Number.isFinite(n) && n >= 0 ? n : 0;
  },
  recordSurvivalRun(run: number): { best: number; isNewBest: boolean } {
    const prevBest = api.getSurvivalBest();
    const isNewBest = run > prevBest;
    const best = isNewBest ? run : prevBest;
    if (typeof window !== "undefined") {
      localStorage.setItem("upsc_survival_best_run", String(best));
      window.dispatchEvent(new Event("upsc-db-change"));
    }
    return { best, isNewBest };
  },

  // ----- Bookmarks / Wrong
  toggleBookmark(q: MCQ, topicName?: string): boolean {
    const id = hashQuestion(q);
    let now = false;
    update((db) => {
      const i = db.bookmarks.findIndex((b) => b.id === id);
      if (i >= 0) {
        db.bookmarks.splice(i, 1);
        now = false;
      } else {
        db.bookmarks.unshift({ id, question: q, topic_name: topicName, created_at: Date.now() });
        now = true;
      }
    });
    return now;
  },
  isBookmarked(q: MCQ): boolean {
    const id = hashQuestion(q);
    return load().bookmarks.some((b) => b.id === id);
  },
  recordWrong(q: MCQ, topicName?: string) {
    const id = hashQuestion(q);
    update((db) => {
      if (!db.wrong_answers.some((w) => w.id === id)) {
        db.wrong_answers.unshift({
          id,
          question: q,
          topic_name: topicName,
          created_at: Date.now(),
        });
        db.wrong_answers = db.wrong_answers.slice(0, 500);
      }
    });
  },
  clearWrong(q: MCQ) {
    const id = hashQuestion(q);
    update((db) => {
      db.wrong_answers = db.wrong_answers.filter((w) => w.id !== id);
    });
  },
  counts() {
    const db = load();
    return { bookmarks: db.bookmarks.length, wrong: db.wrong_answers.length };
  },
  bookmarkQuestions(): MCQ[] {
    return load().bookmarks.map((b) => b.question);
  },
  wrongQuestions(): MCQ[] {
    return load().wrong_answers.map((w) => w.question);
  },

  // ----- Streak
  bumpSolved(n = 1) {
    update((db) => {
      const key = todayKey();
      const arr = db.streak ?? (db.streak = []);
      const today = arr.find((d) => d.date === key);
      if (today) today.solved += n;
      else arr.unshift({ date: key, solved: n });
      db.streak = arr.slice(0, 90); // keep 3 months
    });
    // Continuous reward counter (NOT daily; never resets on midnight).
    // Only resets when the user taps "Tap to Reveal" via consumeReward().
    try {
      const cur = api.correctSinceReward();
      if (typeof window !== "undefined") {
        localStorage.setItem("upsc_correct_since_reward", String(cur + n));
        window.dispatchEvent(new Event("upsc-db-change"));
      }
    } catch {
      // best-effort
    }
    // Re-evaluate achievements after any solve.
    try {
      evaluateAchievements();
    } catch {
      // achievements are best-effort; never break the quiz flow
    }
  },

  // ----- Rewards (continuous progress; NO daily reset) -----
  correctSinceReward(): number {
    if (typeof window === "undefined") return 0;
    const raw = localStorage.getItem("upsc_correct_since_reward");
    const n = raw ? parseInt(raw, 10) : 0;
    return Number.isFinite(n) && n >= 0 ? n : 0;
  },
  unlockedImageCount(): number {
    if (typeof window === "undefined") return 0;
    const raw = localStorage.getItem("upsc_reward_images_unlocked");
    const n = raw ? parseInt(raw, 10) : 0;
    return Number.isFinite(n) && n >= 0 ? n : 0;
  },
  // Called when user taps "Tap to Reveal". Decrements the continuous
  // progress counter by 125 (clamped at 0) and increments the unlocked
  // image count by 1. Journey (chapters/lion/wallpapers/achievements) is
  // DERIVED from the unlocked image count via computeUnlockDelta — no
  // extra bookkeeping is needed except persisting achievement unlocks,
  // which reuses the existing unlockAchievement() storage.
  consumeReward(): { newImageCount: number; delta: UnlockDelta | null } {
    if (typeof window === "undefined") return { newImageCount: 0, delta: null };
    const progress = api.correctSinceReward();
    const unlocked = api.unlockedImageCount();
    const remaining = Math.max(0, progress - 125);
    const nextUnlocked = unlocked + 1;
    localStorage.setItem("upsc_correct_since_reward", String(remaining));
    localStorage.setItem("upsc_reward_images_unlocked", String(nextUnlocked));
    const delta = computeUnlockDelta(unlocked, nextUnlocked);
    if (delta?.achievementUnlocked) {
      api.unlockAchievement(delta.achievementUnlocked.id);
    }
    window.dispatchEvent(new Event("upsc-db-change"));
    return { newImageCount: nextUnlocked, delta };
  },

  solvedToday(): number {
    const key = todayKey();
    return (load().streak ?? []).find((d) => d.date === key)?.solved ?? 0;
  },
  streakDays(): StreakDay[] {
    return (load().streak ?? []).slice();
  },
  consecutiveDaysActive(): number {
    const days = new Set((load().streak ?? []).filter((d) => d.solved > 0).map((d) => d.date));
    let count = 0;
    const cursor = new Date();
    // walk backwards day-by-day
    for (;;) {
      const key = todayKey(cursor);
      if (!days.has(key)) break;
      count++;
      cursor.setDate(cursor.getDate() - 1);
    }
    return count;
  },

  // ----- Achievements (persistent, local-only)
  getAchievements(): Record<string, { unlocked_at: number }> {
    if (typeof window === "undefined") return {};
    try {
      return JSON.parse(localStorage.getItem("upsc_achievements") || "{}");
    } catch {
      return {};
    }
  },
  unlockAchievement(id: string) {
    if (typeof window === "undefined") return;
    const cur = api.getAchievements();
    if (cur[id]) return;
    cur[id] = { unlocked_at: Date.now() };
    localStorage.setItem("upsc_achievements", JSON.stringify(cur));
    window.dispatchEvent(new Event("upsc-db-change"));
  },

  // ----- I/O
  exportJSON(): string {
    const db = load();
    const { gemini_api_key: _k, ...rest } = db;
    void _k;
    return JSON.stringify(rest, null, 2);
  },
  importJSON(raw: string) {
    const parsed = JSON.parse(raw) as Partial<DB>;
    update((db) => {
      if (parsed.subjects) db.subjects = parsed.subjects;
      if (parsed.topics) db.topics = parsed.topics;
      if (parsed.notes) db.notes = parsed.notes;
      if (parsed.quizzes) db.quizzes = parsed.quizzes;
      if (parsed.bookmarks) db.bookmarks = parsed.bookmarks;
      if (parsed.wrong_answers) db.wrong_answers = parsed.wrong_answers;
      if (parsed.streak) db.streak = parsed.streak;
    });
  },
};

export function evaluateAchievementsNow() {
  evaluateAchievements();
}

// ---------- Achievement rules (pure, performance-based) ----------
export type Achievement = { id: string; label: string; description: string };

export const ACHIEVEMENTS: Achievement[] = [
  { id: "solved_10", label: "First Ten", description: "10 correct answers in a day." },
  { id: "solved_25", label: "Bronze Day", description: "25 correct answers in a single day." },
  { id: "solved_50", label: "Silver Day", description: "50 correct answers in a single day." },
  { id: "solved_100", label: "Gold Day", description: "100 correct answers in a single day." },
  { id: "solved_125", label: "Gem Day", description: "Complete the daily 125 ring." },
  { id: "streak_3", label: "Three-Day Streak", description: "Practice 3 consecutive days." },
  { id: "streak_7", label: "Week Warrior", description: "Practice 7 consecutive days." },
  { id: "streak_30", label: "Monthly Devotion", description: "Practice 30 consecutive days." },
  { id: "accuracy_80", label: "Sharp Shooter", description: "80%+ accuracy on a full quiz." },
  { id: "accuracy_100", label: "Perfect Round", description: "100% accuracy on a quiz." },
  { id: "quizzes_10", label: "Committed", description: "Complete 10 quizzes." },
  { id: "quizzes_50", label: "Dedicated", description: "Complete 50 quizzes." },
];

function evaluateAchievements() {
  if (typeof window === "undefined") return;
  const db = load();
  const solvedToday = api.solvedToday();
  const consec = api.consecutiveDaysActive();
  const completed = db.quizzes.filter((q) => q.status === "completed");
  const unlock = (id: string) => api.unlockAchievement(id);

  if (solvedToday >= 10) unlock("solved_10");
  if (solvedToday >= 25) unlock("solved_25");
  if (solvedToday >= 50) unlock("solved_50");
  if (solvedToday >= 100) unlock("solved_100");
  if (solvedToday >= 125) unlock("solved_125");
  if (consec >= 3) unlock("streak_3");
  if (consec >= 7) unlock("streak_7");
  if (consec >= 30) unlock("streak_30");

  for (const q of completed) {
    let c = 0,
      a = 0;
    q.questions.forEach((qq, i) => {
      const ans = q.answers[i];
      if (ans != null) {
        a++;
        if (ans === qq.answerIndex) c++;
      }
    });
    const acc = a ? c / a : 0;
    if (a > 0 && acc >= 0.8) unlock("accuracy_80");
    if (a > 0 && acc >= 1) unlock("accuracy_100");
  }
  if (completed.length >= 10) unlock("quizzes_10");
  if (completed.length >= 50) unlock("quizzes_50");
}
