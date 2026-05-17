"use client";

import { useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "@/components/I18nProvider";
import {
  calculatorInfo,
  type CalculatorInfoKey,
} from "@/lib/calculator-info";

type Props = {
  infoKey: CalculatorInfoKey;
  title: string;
  onClose: () => void;
};

export default function CalculatorInfoModal({
  infoKey,
  title,
  onClose,
}: Props) {
  const { tr } = useI18n();
  const info = calculatorInfo[infoKey];

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [handleClose]);

  if (!info) return null;

  const fullParagraphs = tr(
    info.fullRu.join("\n\n"),
    info.fullEn.join("\n\n")
  ).split("\n\n");
  const audienceItems = tr(
    info.audienceRu.join("\n"),
    info.audienceEn.join("\n")
  ).split("\n");

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center p-4 sm:items-center"
      role="presentation"
      onClick={handleClose}
    >
      <div className="absolute inset-0 bg-[var(--foreground)]/40" aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="calculator-info-title"
        className="relative z-10 max-h-[min(85vh,32rem)] w-full max-w-lg overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-[var(--shadow-card)] sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h2
            id="calculator-info-title"
            className="text-base font-semibold leading-snug text-[var(--foreground)] sm:text-lg"
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={handleClose}
            className="shrink-0 rounded-lg p-1.5 text-[var(--muted)] transition hover:bg-[var(--input-bg)] hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ring)]"
            aria-label={tr("Закрыть", "Close")}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="h-5 w-5"
              aria-hidden
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mt-4 space-y-3 text-sm leading-relaxed text-[var(--foreground)]">
          {fullParagraphs.map((paragraph) => (
            <p key={paragraph.slice(0, 24)}>{paragraph}</p>
          ))}
        </div>

        <section className="mt-5 rounded-xl border border-[var(--border)] bg-[var(--input-bg)] px-4 py-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--accent)]">
            {tr(
              "Кому может быть интересен этот калькулятор",
              "Who might find this calculator useful"
            )}
          </h3>
          <ul className="mt-2 list-disc space-y-1.5 pl-4 text-sm leading-relaxed text-[var(--foreground)]">
            {audienceItems.map((item) => (
              <li key={item.slice(0, 32)}>{item}</li>
            ))}
          </ul>
        </section>
      </div>
    </div>,
    document.body
  );
}
