// Journey achievements — one Hindi-titled milestone per completed chapter.
// Titles are placeholders and can be replaced without any code changes.

export interface JourneyAchievement {
  id: string; // stable id used with api.getAchievements()
  chapterId: number;
  title: string; // Hindi (transliterated) placeholder
  description: string;
}

export const JOURNEY_ACHIEVEMENTS: JourneyAchievement[] = [
  {
    id: "journey_ch1",
    chapterId: 1,
    title: "Prarambh",
    description: "You began the journey. Ancient Glory unfolds.",
  },
  {
    id: "journey_ch2",
    chapterId: 2,
    title: "Suvarna",
    description: "The Golden Age is yours to remember.",
  },
  {
    id: "journey_ch3",
    chapterId: 3,
    title: "Sankat",
    description: "You have walked through the first storm.",
  },
  {
    id: "journey_ch4",
    chapterId: 4,
    title: "Andhkaar",
    description: "You endured the Long Night.",
  },
  {
    id: "journey_ch5",
    chapterId: 5,
    title: "Swatantrata",
    description: "Freedom's fire burns in you.",
  },
  {
    id: "journey_ch6",
    chapterId: 6,
    title: "Uday",
    description: "Bharat rises — and so do you.",
  },
];

export function journeyAchievementFor(chapterId: number): JourneyAchievement | null {
  return JOURNEY_ACHIEVEMENTS.find((a) => a.chapterId === chapterId) ?? null;
}
