"use client";

import Link from "next/link";
import { useI18n } from "@/components/I18nProvider";
import type { CalculatorInfoKey } from "@/lib/calculator-info";

function InfoIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </svg>
  );
}

type Props = {
  infoKey: CalculatorInfoKey;
};

export default function CalculatorInfoInlineButton({ infoKey }: Props) {
  const { tr } = useI18n();
  return (
    <Link
      href={`/calculator-info/${infoKey}`}
      aria-label={tr("Подробнее о калькуляторе", "More about this calculator")}
      title={tr("Подробнее о калькуляторе", "More about this calculator")}
      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--border)] text-[var(--muted)] transition hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]"
    >
      <InfoIcon />
    </Link>
  );
}
