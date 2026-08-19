// Path of the Lion — seven stages, tied to chapter completion.
// Progression is DERIVED, not user-selectable.

export interface LionStage {
  id: number; // 0..6
  name: string; // Hindi (transliterated)
  english: string; // English gloss for accessibility
  /** Number of fully-completed chapters required to reach this stage. */
  chaptersRequired: number;
}

export const LION_STAGES: LionStage[] = [
  { id: 0, name: "Baal", english: "The Cub", chaptersRequired: 0 },
  { id: 1, name: "Baalak", english: "The Young One", chaptersRequired: 1 },
  { id: 2, name: "Chhava", english: "The Fierce Cub", chaptersRequired: 2 },
  { id: 3, name: "Chhota Bagh", english: "The Small Tiger", chaptersRequired: 3 },
  { id: 4, name: "Bagh", english: "The Tiger", chaptersRequired: 4 },
  { id: 5, name: "Maha Bagh", english: "The Great Tiger", chaptersRequired: 5 },
  { id: 6, name: "Adhunik Bagh", english: "The Modern Tiger", chaptersRequired: 6 },
];

export function lionForCompletedChapters(completed: number): LionStage {
  let best = LION_STAGES[0];
  for (const s of LION_STAGES) if (completed >= s.chaptersRequired) best = s;
  return best;
}
