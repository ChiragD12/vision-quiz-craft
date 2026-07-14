// ---------------- Reward Ceremony — context ----------------
//
// Thin context boundary only. All state ownership lives in
// RewardCeremonyProvider.tsx; this file just defines the shape and the
// consumer hook so RewardCeremony.tsx (and feature code, e.g. the Result
// page) can read/drive it without prop drilling.

import { createContext, useContext } from "react";
import type { RewardCeremonyItem } from "./reward-ceremony-types";

export interface RewardCeremonyContextValue {
  /** Whether a ceremony is currently being displayed. */
  isOpen: boolean;
  /** The reward step currently on screen, or null if closed. */
  current: RewardCeremonyItem | null;
  /** Replace the queue and open the ceremony (no-op if queue is empty). */
  show: (queue: RewardCeremonyItem[]) => void;
  /** Advance to the next queued reward, or close if none remain. */
  next: () => void;
  /** Dismiss the entire remaining queue immediately. */
  skipAll: () => void;
}

export const RewardCeremonyContext =
  createContext<RewardCeremonyContextValue | null>(null);

/**
 * Access the Reward Ceremony controller. Must be called under
 * <RewardCeremonyProvider>.
 */
export function useRewardCeremony(): RewardCeremonyContextValue {
  const ctx = useContext(RewardCeremonyContext);
  if (!ctx) {
    throw new Error(
      "useRewardCeremony() must be used within a <RewardCeremonyProvider>.",
    );
  }
  return ctx;
}
