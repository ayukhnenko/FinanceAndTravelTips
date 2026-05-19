import { NextResponse } from "next/server";

export type OutputFormat = "json" | "ui";

export function parseOutputFormat(value: string | null): OutputFormat | null {
  if (!value) return "json";
  const normalized = value.trim().toLowerCase();
  if (normalized === "json" || normalized === "ui") {
    return normalized;
  }
  return null;
}

export function parseNonNegativeNumber(value: string | null): number | null {
  if (value == null) return null;
  const n = Number(value.replace(",", "."));
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

export function parsePositiveNumber(value: string | null): number | null {
  const n = parseNonNegativeNumber(value);
  if (n == null || n <= 0) return null;
  return n;
}

export function parsePositiveInteger(value: string | null): number | null {
  const n = parsePositiveNumber(value);
  if (n == null) return null;
  const i = Math.round(n);
  if (!Number.isInteger(i) || i <= 0) return null;
  return i;
}

export function parseBoolean(value: string | null): boolean | null {
  if (value == null) return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "1" || normalized === "true" || normalized === "yes") return true;
  if (normalized === "0" || normalized === "false" || normalized === "no") return false;
  return null;
}

export function escapeHtml(raw: string): string {
  return raw
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function respondByFormat(params: {
  format: OutputFormat;
  payload: unknown;
}) {
  const { payload } = params;
  return NextResponse.json(payload, {
    headers: {
      "cache-control": "no-store",
    },
  });
}
