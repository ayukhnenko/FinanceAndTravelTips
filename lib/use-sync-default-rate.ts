"use client";

import { useEffect } from "react";
import { ReadonlyURLSearchParams } from "next/navigation";
import { formatPercentInput } from "@/lib/date-utils";

export function useSyncDefaultRate(
  searchParams: ReadonlyURLSearchParams,
  urlParam: string | null,
  defaultPercent: number,
  setValue: (next: string) => void
): void {
  useEffect(() => {
    if (urlParam && searchParams.get(urlParam)) return;
    if (!Number.isFinite(defaultPercent)) return;
    setValue(formatPercentInput(defaultPercent));
  }, [searchParams, urlParam, defaultPercent, setValue]);
}
