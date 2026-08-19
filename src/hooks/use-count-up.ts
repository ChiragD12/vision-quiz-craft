import { useEffect, useRef, useState } from "react";

/**
 * Animates a number from 0 up to `target` using a fast ease-out curve.
 * Purely presentational — has no effect on any stored or computed value.
 */
export function useCountUp(target: number, durationMs = 1100, decimals = 0): number {
  const [value, setValue] = useState(0);
  const targetRef = useRef(target);
  targetRef.current = target;

  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const from = 0;
    const to = targetRef.current;

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      setValue(from + (to - from) * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // Re-run only when the target actually changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, durationMs]);

  return Number(value.toFixed(decimals));
}
