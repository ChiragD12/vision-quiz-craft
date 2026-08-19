// Pure ring-tier logic. No React, no storage.

export type StreakTier = "none" | "bronze" | "silver" | "gold" | "gem";

export const TIER_THRESHOLDS: Record<Exclude<StreakTier, "none">, number> = {
  bronze: 25,
  silver: 50,
  gold: 100,
  gem: 125,
};

export function tierFor(solvedToday: number): StreakTier {
  if (solvedToday >= TIER_THRESHOLDS.gem) return "gem";
  if (solvedToday >= TIER_THRESHOLDS.gold) return "gold";
  if (solvedToday >= TIER_THRESHOLDS.silver) return "silver";
  if (solvedToday >= TIER_THRESHOLDS.bronze) return "bronze";
  return "none";
}

export const TIER_COLOR: Record<Exclude<StreakTier, "none">, string> = {
  bronze: "oklch(0.70 0.12 55)",
  silver: "oklch(0.85 0.02 250)",
  gold: "oklch(0.82 0.13 82)",
  gem: "oklch(0.75 0.18 200)",
};

export function todayKey(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
