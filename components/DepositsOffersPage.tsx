"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import DepositOffersTable, {
  type DepositOfferViewRow,
} from "@/components/DepositOffersTable";
import { formatDateTimeMoscow } from "@/lib/date-utils";
import {
  filterDepositOffersByMinRate,
  formatDepositPercent,
  parseDepositPercentText,
} from "@/lib/deposit-offers-format";
import { downloadDepositOffersXlsx } from "@/lib/deposit-offers-xlsx";

export type DepositsOffersPayload = {
  offerCount: number;
  lastSyncedAt: string | null;
  inclusionThreshold: string | null;
  sourceUrl: string;
  comparisonSumText?: string | null;
  offers: DepositOfferViewRow[];
};

type Props = {
  title: string;
  apiPath: string;
  thresholdStorageKey: string;
  source: "sheet" | "topbanki";
  exportFilenameStem: string;
};

function ToolbarDivider() {
  return <span className="hidden text-[var(--border)] sm:inline" aria-hidden>·</span>;
}

function readStoredThresholdInput(storageKey: string): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(storageKey);
}

function writeStoredThresholdInput(storageKey: string, value: string): void {
  if (typeof window === "undefined") return;
  if (!value.trim()) {
    window.localStorage.removeItem(storageKey);
    return;
  }
  window.localStorage.setItem(storageKey, value);
}

function renderFooter(data: DepositsOffersPayload, source: Props["source"]) {
  if (source === "topbanki") {
    return (
      <>
        Данные из таблицы Topbanki «Максимальные проценты по вкладам»
        {data.comparisonSumText ? ` (сумма сравнения: ${data.comparisonSumText})` : ""}.{" "}
        <a
          href={data.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="link-accent"
        >
          Topbanki
        </a>
        . Ставки и условия уточняйте на сайте банка. Годовой эквивалент рассчитывается по
        правилам сложного процента / годового реинвестирования. В таблице показаны предложения
        с годовым эквивалентом выше указанного порога.
      </>
    );
  }

  return (
    <>
      Подборка вкладов из{" "}
      <a
        href={data.sourceUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="link-accent"
      >
        Google Sheets
      </a>
      . Ставки и условия уточняйте на сайте банка. В таблице показаны предложения с годовым
      эквивалентом выше указанного порога.
    </>
  );
}

export default function DepositsOffersPage({
  title,
  apiPath,
  thresholdStorageKey,
  source,
  exportFilenameStem,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DepositsOffersPayload | null>(null);
  const [thresholdInput, setThresholdInput] = useState("0");
  const [rateThreshold, setRateThreshold] = useState<number | null>(0);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const resp = await fetch(apiPath, { cache: "no-store" });
        if (!resp.ok) {
          if (!cancelled) setError("Не удалось загрузить предложения по вкладам");
          return;
        }

        const payload = (await resp.json()) as DepositsOffersPayload;
        if (cancelled) return;

        setData(payload);

        const stored = readStoredThresholdInput(thresholdStorageKey);
        if (stored != null) {
          setThresholdInput(stored);
          setRateThreshold(parseDepositPercentText(stored));
          return;
        }

        setThresholdInput("0");
        setRateThreshold(0);
        writeStoredThresholdInput(thresholdStorageKey, "0");
      } catch {
        if (!cancelled) setError("Не удалось загрузить предложения по вкладам");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [apiPath, thresholdStorageKey]);

  const filteredOffers = useMemo(() => {
    if (!data) return [];
    return filterDepositOffersByMinRate(data.offers, rateThreshold);
  }, [data, rateThreshold]);

  function handleThresholdChange(value: string) {
    setThresholdInput(value);
    setRateThreshold(parseDepositPercentText(value));
    writeStoredThresholdInput(thresholdStorageKey, value);
  }

  async function handleExportXlsx() {
    if (filteredOffers.length === 0) return;
    setExporting(true);
    try {
      await downloadDepositOffersXlsx(filteredOffers, exportFilenameStem);
    } finally {
      setExporting(false);
    }
  }

  const offerCountLabel =
    data && filteredOffers.length !== data.offers.length
      ? `${filteredOffers.length.toLocaleString("ru-RU")} из ${data.offers.length.toLocaleString("ru-RU")}`
      : filteredOffers.length.toLocaleString("ru-RU");

  const filteredEmptyMessage =
    data && data.offers.length > 0 && rateThreshold != null
      ? `Нет предложений с годовым эквивалентом выше ${formatDepositPercent(rateThreshold)}.`
      : undefined;

  return (
    <div className="mx-auto max-w-6xl p-5 md:p-8">
      <h1 className="text-2xl font-bold text-[var(--foreground)]">{title}</h1>

      <div className="card-panel mt-6 overflow-x-auto">
        {loading ? (
          <p className="text-sm text-[var(--muted)]">Загрузка...</p>
        ) : error ? (
          <p className="text-sm text-rose-700">{error}</p>
        ) : data ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-[var(--border)] pb-3 text-sm">
              <span className="text-[var(--muted)]">
                Предложений:{" "}
                <span className="font-medium text-[var(--foreground)] tabular-nums">
                  {offerCountLabel}
                </span>
              </span>
              <ToolbarDivider />
              <span className="text-[var(--muted)]">
                Обновлено:{" "}
                <span className="font-medium text-[var(--foreground)] tabular-nums whitespace-nowrap">
                  {formatDateTimeMoscow(data.lastSyncedAt)}
                </span>
              </span>
              {source === "sheet" ? (
                <>
                  <ToolbarDivider />
                  <span className="text-[var(--muted)]">
                    Ставки выше:{" "}
                    <span className="font-medium text-[var(--foreground)]">
                      {data.inclusionThreshold ?? "—"}
                    </span>
                  </span>
                </>
              ) : null}
              <ToolbarDivider />
              <label className="flex items-center gap-1.5 text-[var(--muted)]">
                Мин. %
                <input
                  type="text"
                  inputMode="decimal"
                  value={thresholdInput}
                  onChange={(e) => handleThresholdChange(e.target.value)}
                  className="field-input h-8 w-[4.5rem] bg-[var(--card)] px-2 py-1 text-sm tabular-nums"
                  placeholder="0"
                  aria-label="Минимальный процент для фильтрации предложений"
                />
              </label>
              <button
                type="button"
                onClick={() => void handleExportXlsx()}
                disabled={filteredOffers.length === 0 || exporting}
                title="Выгрузить в XLSX"
                aria-label="Выгрузить в XLSX"
                className="ml-auto flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--input-bg)] transition hover:border-[var(--accent)]/40 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Image
                  src="/icons/xlsx-icon.png"
                  alt=""
                  width={18}
                  height={18}
                  className={exporting ? "animate-pulse opacity-70" : ""}
                  aria-hidden
                />
              </button>
            </div>

            <DepositOffersTable
              offers={filteredOffers}
              emptyMessage={filteredEmptyMessage}
            />

            <p className="border-t border-[var(--border)] pt-4 text-sm text-[var(--muted)]">
              {renderFooter(data, source)}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
