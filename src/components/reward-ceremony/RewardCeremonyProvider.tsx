// ---------------- Reward Ceremony — provider ----------------
//
// Owns all ceremony state: queue, current index, open/closed. Does not
// know or care how the queue was built (that's reward-ceremony-types.ts,
// fed ultimately by journey's computeUnlockDelta()) — it only sequences
// display of whatever queue it's given.

import { useCallback, useMemo, useState, type ReactNode } from "react";
import { RewardCeremonyContext } from "./RewardCeremonyContext";
import { RewardCeremony } from "./RewardCeremony";
import { type RewardCeremonyItem } from "./reward-ceremony-types";

export function RewardCeremonyProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<RewardCeremonyItem[]>([]);
  const [index, setIndex] = useState(0);

  const isOpen = queue.length > 0 && index < queue.length;
  const current = isOpen ? queue[index] : null;

  const show = useCallback((newQueue: RewardCeremonyItem[]) => {
    if (!newQueue || newQueue.length === 0) return;
    setQueue(newQueue);
    setIndex(0);
  }, []);

  const next = useCallback(() => {
    setIndex((i) => i + 1);
  }, []);

  const skipAll = useCallback(() => {
    setQueue([]);
    setIndex(0);
  }, []);

  const value = useMemo(
    () => ({ isOpen, current, show, next, skipAll }),
    [isOpen, current, show, next, skipAll],
  );

  return (
    <RewardCeremonyContext.Provider value={value}>
      {children}
      {isOpen && current && (
        <RewardCeremony item={current} onContinue={next} />
      )}
    </RewardCeremonyContext.Provider>
  );
}
