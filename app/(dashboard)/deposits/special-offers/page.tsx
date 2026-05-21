"use client";



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



const RATE_THRESHOLD_STORAGE_KEY = "deposits-special-offers-rate-threshold";



type SpecialOffersPayload = {

  offerCount: number;

  lastSyncedAt: string | null;

  inclusionThreshold: string | null;

  sheetUrl: string;

  offers: DepositOfferViewRow[];

};



function readStoredThresholdInput(): string | null {

  if (typeof window === "undefined") return null;

  return window.localStorage.getItem(RATE_THRESHOLD_STORAGE_KEY);

}



function writeStoredThresholdInput(value: string): void {

  if (typeof window === "undefined") return;

  if (!value.trim()) {

    window.localStorage.removeItem(RATE_THRESHOLD_STORAGE_KEY);

    return;

  }

  window.localStorage.setItem(RATE_THRESHOLD_STORAGE_KEY, value);

}



export default function DepositsSpecialOffersPage() {

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);

  const [data, setData] = useState<SpecialOffersPayload | null>(null);

  const [thresholdInput, setThresholdInput] = useState("");

  const [rateThreshold, setRateThreshold] = useState<number | null>(null);



  useEffect(() => {

    let cancelled = false;



    async function load() {

      setLoading(true);

      setError(null);

      try {

        const resp = await fetch("/api/deposits/special-offers", { cache: "no-store" });

        if (!resp.ok) {

          if (!cancelled) setError("Не удалось загрузить предложения по вкладам");

          return;

        }

        const payload = (await resp.json()) as SpecialOffersPayload;

        if (cancelled) return;



        setData(payload);



        const stored = readStoredThresholdInput();

        if (stored != null) {

          setThresholdInput(stored);

          setRateThreshold(parseDepositPercentText(stored));

          return;

        }



        const defaultThreshold = payload.inclusionThreshold

          ? parseDepositPercentText(payload.inclusionThreshold)

          : null;

        if (defaultThreshold != null) {

          const defaultInput = defaultThreshold.toLocaleString("ru-RU", {

            minimumFractionDigits: 2,

            maximumFractionDigits: 2,

          });

          setThresholdInput(defaultInput);

          setRateThreshold(defaultThreshold);

          writeStoredThresholdInput(defaultInput);

        }

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

  }, []);



  const filteredOffers = useMemo(() => {

    if (!data) return [];

    return filterDepositOffersByMinRate(data.offers, rateThreshold);

  }, [data, rateThreshold]);



  function handleThresholdChange(value: string) {

    setThresholdInput(value);

    const parsed = parseDepositPercentText(value);

    setRateThreshold(parsed);

    writeStoredThresholdInput(value);

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

      <h1 className="text-2xl font-bold text-[var(--foreground)]">Предложения по вкладам</h1>



      <div className="card-panel mt-6 overflow-x-auto">

        {loading ? (

          <p className="text-sm text-[var(--muted)]">Загрузка...</p>

        ) : error ? (

          <p className="text-sm text-rose-700">{error}</p>

        ) : data ? (

          <div className="space-y-4">

            <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">

              <div className="rounded-lg border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2">

                <dt className="text-xs uppercase tracking-wide text-[var(--muted)]">

                  Предложений

                </dt>

                <dd className="mt-1 text-sm font-medium text-[var(--foreground)]">

                  {offerCountLabel}

                </dd>

              </div>

              <div className="rounded-lg border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2">

                <dt className="text-xs uppercase tracking-wide text-[var(--muted)]">

                  Обновлено (MSK)

                </dt>

                <dd className="mt-1 text-sm font-medium text-[var(--foreground)] tabular-nums">

                  {formatDateTimeMoscow(data.lastSyncedAt)}

                </dd>

              </div>

              <div className="rounded-lg border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2">

                <dt className="text-xs uppercase tracking-wide text-[var(--muted)]">

                  В таблице ставки выше

                </dt>

                <dd className="mt-1 text-sm font-medium text-[var(--foreground)]">

                  {data.inclusionThreshold ?? "—"}

                </dd>

              </div>

              <div className="rounded-lg border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2">

                <dt className="text-xs uppercase tracking-wide text-[var(--muted)]">
                  Порог (годовой эквивалент)
                </dt>

                <dd className="mt-1">

                  <input

                    type="text"

                    inputMode="decimal"

                    value={thresholdInput}

                    onChange={(e) => handleThresholdChange(e.target.value)}

                    className="field-input w-full tabular-nums"

                    placeholder="например 15,00"

                    aria-label="Порог по годовому эквиваленту для фильтрации предложений"

                  />

                </dd>

              </div>

            </dl>



            <DepositOffersTable

              offers={filteredOffers}

              emptyMessage={filteredEmptyMessage}

            />



            <p className="border-t border-[var(--border)] pt-4 text-sm text-[var(--muted)]">

              Подборка вкладов из{" "}

              <a

                href={data.sheetUrl}

                target="_blank"

                rel="noopener noreferrer"

                className="link-accent"

              >

                Google Sheets

              </a>

              . Ставки и условия уточняйте на сайте банка. В таблице показаны предложения с
              годовым эквивалентом выше указанного порога.

            </p>

          </div>

        ) : null}

      </div>

    </div>

  );

}


