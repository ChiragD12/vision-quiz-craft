// Chapter manifest — the SIX chapters of the Journey.
// Ranges use 1-based inclusive image indices matching the 65-image reward set.
// Folder names are stored ONLY for asset resolution; the UI never displays them.

export type ChapterId = 1 | 2 | 3 | 4 | 5 | 6;

export interface Chapter {
  id: ChapterId;
  title: string;
  subtitle: string; // short evocative one-liner
  description: string; // longer chapter narrative shown in Journey UI
  folder: string; // implementation detail (asset path segment)
  start: number; // first story image id, 1-based
  end: number; // last story image id, 1-based (inclusive)
}

export const CHAPTERS: Chapter[] = [
  {
    id: 1,
    title: "Ancient Glory",
    subtitle: "The Dawn of Civilization",
    description: "From the earliest traditions and philosophical ideas to the rise of powerful empires, this chapter explores the foundations of Indian civilization.",
    folder: "01-ancient-glory",
    start: 1,
    end: 10,
  },
  {
    id: 2,
    title: "Golden Age",
    subtitle: "An Age of Knowledge and Prosperity",
    description: "From the golden age of mathematics to the golden age of literature, this chapter explores the remarkable achievements of the Golden Age of Bharat.",
    folder: "02-golden-age",
    start: 11,
    end: 21,
  },
  {
    id: 3,
    title: "Trouble Begins",
    subtitle: "The First Shadows Fall",
    description: "From the rise of the Mughal Empire to the collapse of the British Empire, this chapter explores the turbulent period that marked the beginning of India's modern history.",
    folder: "03-trouble-begins",
    start: 22,
    end: 32,
  },
  {
    id: 4,
    title: "Long Night",
    subtitle: "Centuries of Resistance",
    description: "From the struggle for independence to the struggle for freedom, this chapter explores the long night of struggle that marked Bharat's golden age.",
    folder: "04-long-night",
    start: 33,
    end: 43,
  },
  {
    id: 5,
    title: "Final Blow",
    subtitle: "The Road to Freedom",
    description: "From the struggle for independence to the struggle for freedom, this chapter explores the long night of struggle that marked Bharat's golden age.",
    folder: "05-final-blow",
    start: 44,
    end: 54,
  },
  {
    id: 6,
    title: "Bharat Rising",
    subtitle: "Building the Future",
    description: "From the struggle for independence to the struggle for freedom, this chapter explores the long night of struggle that marked Bharat's golden age.",
    folder: "06-bharat-rising",
    start: 55,
    end: 65,
  },
];

export const TOTAL_STORY_IMAGES = 65;

/** Chapter that contains a given 1-based image id, or null if out of range. */
export function chapterOf(imageId: number): Chapter | null {
  return CHAPTERS.find((c) => imageId >= c.start && imageId <= c.end) ?? null;
}

/** How many images inside `chapter` have been unlocked, given lifetime unlockedCount. */
export function chapterProgress(chapter: Chapter, unlockedCount: number) {
  const total = chapter.end - chapter.start + 1;
  const unlocked = Math.max(0, Math.min(total, unlockedCount - (chapter.start - 1)));
  return { unlocked, total, complete: unlocked >= total };
}

/** The chapter the user is currently reading (first not-yet-complete chapter). */
export function currentChapter(unlockedCount: number): Chapter {
  for (const c of CHAPTERS) {
    if (!chapterProgress(c, unlockedCount).complete) return c;
  }
  return CHAPTERS[CHAPTERS.length - 1];
}
