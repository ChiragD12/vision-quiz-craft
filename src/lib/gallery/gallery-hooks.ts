// Data hooks for the Secret Gallery. Extracted verbatim from gallery.tsx —
// behaviour, event names, and cleanup/revoke ordering are unchanged.

import { useState, useEffect, useRef } from "react";
import {
  listUserMedia,
  toObjectUrl,
  revokeAll,
  type UserMediaWithUrl,
} from "@/lib/user-media";

export function useDB() {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const cb = () => setTick((t) => t + 1);

    window.addEventListener("upsc-db-change", cb);
    window.addEventListener("storage", cb);

    return () => {
      window.removeEventListener("upsc-db-change", cb);
      window.removeEventListener("storage", cb);
    };
  }, []);

  return tick;
}

export function useUserMedia(): UserMediaWithUrl[] {
  const tick = useDB();
  const [items, setItems] = useState<UserMediaWithUrl[]>([]);
  const prevRef = useRef<UserMediaWithUrl[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const list = await listUserMedia();
      const withUrls: UserMediaWithUrl[] = list.map((m) => ({
        ...m,
        url: toObjectUrl(m),
      }));
      if (cancelled) {
        revokeAll(withUrls);
        return;
      }
      // Revoke previous batch to prevent leaks.
      revokeAll(prevRef.current);
      prevRef.current = withUrls;
      setItems(withUrls);
    })();
    return () => {
      cancelled = true;
    };
  }, [tick]);

  // Revoke on unmount.
  useEffect(() => {
    return () => {
      revokeAll(prevRef.current);
      prevRef.current = [];
    };
  }, []);

  return items;
}
