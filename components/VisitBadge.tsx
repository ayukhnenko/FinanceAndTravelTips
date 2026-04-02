"use client";

import { useEffect, useState } from "react";

/** Один успешный инкремент на вкладку; при 503 (не настроен Redis) lock не ставим — можно обновить страницу после настройки */
const VISIT_LOCK_KEY = "fat_visit_lock_v1";

function EyeIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export default function VisitBadge({ className = "" }: { className?: string }) {
  const [count, setCount] = useState<number | null | undefined>(undefined);
  const [configured, setConfigured] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      let value: number | null | undefined;
      let cfg: boolean | undefined;

      const locked = sessionStorage.getItem(VISIT_LOCK_KEY) === "1";
      if (!locked) {
        try {
          const inc = await fetch("/api/visits/increment", { method: "POST" });
          const data = await inc.json().catch(() => ({}));
          if (typeof data.configured === "boolean") cfg = data.configured;

          if (inc.ok && typeof data.count === "number") {
            sessionStorage.setItem(VISIT_LOCK_KEY, "1");
            value = data.count;
          } else if (inc.status === 503) {
            /* Redis не настроен — lock не ставим, после деплоя с env сработает POST */
          } else {
            sessionStorage.setItem(VISIT_LOCK_KEY, "1");
          }
        } catch {
          sessionStorage.setItem(VISIT_LOCK_KEY, "1");
        }
      }

      if (value === undefined && !cancelled) {
        try {
          const r = await fetch("/api/visits");
          const data = await r.json().catch(() => ({}));
          if (typeof data.configured === "boolean") cfg = data.configured;
          if (typeof data.count === "number") value = data.count;
          else value = null;
        } catch {
          value = null;
        }
      }

      if (!cancelled) {
        setCount(value ?? null);
        if (cfg !== undefined) setConfigured(cfg);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, []);

  const label =
    count === undefined
      ? "…"
      : count === null
        ? "—"
        : count.toLocaleString("ru-RU");

  const titleHint =
    configured === false
      ? "Счётчик не настроен: задайте UPSTASH_REDIS_REST_URL и UPSTASH_REDIS_REST_TOKEN в Vercel и сделайте Redeploy."
      : "Визитов за всё время (облако; один успешный зачёт за вкладку)";

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--muted)] shadow-sm ${className}`}
      title={titleHint}
    >
      <EyeIcon className="shrink-0 text-[var(--accent)]" />
      <span className="tabular-nums font-medium text-[var(--foreground)]">{label}</span>
      <span className="hidden text-xs sm:inline">визитов</span>
    </div>
  );
}
