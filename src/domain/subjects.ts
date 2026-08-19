// Core subjects for UPSC/HPSC. Seeded on first read. Cannot be deleted.
// Users may hide them from the home dashboard but they remain available
// inside the "All Subjects" manager.

export type CoreSubjectSeed = { id: string; name: string };

export const CORE_SUBJECTS: readonly CoreSubjectSeed[] = [
  { id: "core-history", name: "History" },

  { id: "core-modern-history", name: "Modern Indian History" },
  { id: "core-medieval-history", name: "Medieval Indian History" },
  { id: "core-ancient-history", name: "Ancient Indian History" },

  { id: "core-polity", name: "Polity" },
  { id: "core-geography", name: "Geography" },
  { id: "core-economy", name: "Economy" },
  { id: "core-general-science", name: "General Science" },
  { id: "core-art-culture", name: "Art & Culture" },

  { id: "core-indian-dances", name: "Indian Classical & Folk Dances" },
  { id: "core-indian-temples", name: "Indian Temples" },
  { id: "core-current-affairs", name: "Current Affairs" },
  { id: "core-pyqs", name: "PYQs" },
] as const;

// PYQs is a special core subject: it has no visible topic layer. Selecting
// it opens straight into a single note editor backed by one hidden topic
// (see PYQS_TOPIC_ID in lib/store.ts).
export const PYQS_SUBJECT_ID = "core-pyqs";

export const isCoreSubjectId = (id: string) => id.startsWith("core-");

export const normalizeName = (s: string) => s.trim().toLowerCase();
