// Wallpaper manifest — one wallpaper unlocked per completed chapter.
// Wallpapers are never auto-applied; users pick one in Settings.

export interface Wallpaper {
  id: number; // 1..6
  chapterId: number; // the chapter whose completion unlocks it
  title: string;
  filename: string; // "wallpaper-01.webp" — used by the asset resolver
}

export const WALLPAPERS: Wallpaper[] = [
  { id: 1, chapterId: 1, title: "Dawn of Bharat", filename: "wallpaper-01.webp" },
  { id: 2, chapterId: 2, title: "Golden Horizon", filename: "wallpaper-02.webp" },
  { id: 3, chapterId: 3, title: "Fractured Sky", filename: "wallpaper-03.webp" },
  { id: 4, chapterId: 4, title: "Long Night", filename: "wallpaper-04.webp" },
  { id: 5, chapterId: 5, title: "Fire of Freedom", filename: "wallpaper-05.webp" },
  { id: 6, chapterId: 6, title: "Bharat Rising", filename: "wallpaper-06.webp" },
];

export function wallpapersForCompletedChapters(completed: number): Wallpaper[] {
  return WALLPAPERS.filter((w) => w.chapterId <= completed);
}
