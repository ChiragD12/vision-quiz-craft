// Journey feature flags. Toggle behaviour without touching UI code.

export const JOURNEY_SETTINGS = {
  /** Show the Journey card on the Home screen. */
  showHomeCard: true,
  /** Show wallpaper picker section in Settings. Wallpapers are opt-in. */
  enableWallpaperPicker: true,
  /** Include chapter-completion sections in the unlock celebration. */
  showChapterCompletion: true,
} as const;

export type JourneySettings = typeof JOURNEY_SETTINGS;
