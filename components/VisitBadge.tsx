"use client";

import { useEffect } from "react";

const VISIT_LOCK_KEY = "fat_visit_lock_v1";

export function VisitTracker(): null {
  useEffect(() => {
    const locked = sessionStorage.getItem(VISIT_LOCK_KEY) === "1";
    if (locked) return;
    let cancelled = false;

    (async () => {
      try {
        const resp = await fetch("/api/visits/increment", { method: "POST" });
        const data = await resp.json().catch(() => ({}));
        if (!cancelled && resp.ok && typeof data.count === "number") {
          sessionStorage.setItem(VISIT_LOCK_KEY, "1");
        }
      } catch {
        /* no-op */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
