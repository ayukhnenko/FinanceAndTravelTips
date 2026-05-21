export function formatDurationMs(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "—";
  if (ms < 1000) return `${Math.round(ms)} мс`;
  return `${(ms / 1000).toLocaleString("ru-RU", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })} с`;
}

export function readDurationMsFromDetails(
  details: Record<string, unknown> | undefined
): number | null {
  if (!details) return null;

  if (typeof details.durationMs === "number" && Number.isFinite(details.durationMs)) {
    return details.durationMs;
  }

  const timings = details.timings;
  if (timings && typeof timings === "object" && !Array.isArray(timings)) {
    const totalMs = (timings as Record<string, unknown>).totalMs;
    if (typeof totalMs === "number" && Number.isFinite(totalMs)) return totalMs;
  }

  return null;
}
