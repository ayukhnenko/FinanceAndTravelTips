import { formatDepositPercent } from "@/lib/deposit-offers-format";

export type DepositOfferViewRow = {
  id: number;
  sortOrder: number;
  bankName: string;
  productName: string;
  nominalRatePercent: number | null;
  rateAnnualEquivPercent: number | null;
  termDays: number | null;
  minAmountThousands: string;
  maxAmountText: string;
  conditions: string;
  productUrl: string;
};

type Props = {
  offers: DepositOfferViewRow[];
  emptyMessage?: string;
};

export default function DepositOffersTable({ offers, emptyMessage }: Props) {
  if (offers.length === 0) {
    return (
      <p className="text-sm text-[var(--muted)]">
        {emptyMessage ??
          "Предложения пока не загружены. Данные появятся после синхронизации из Google Sheets."}
      </p>
    );
  }

  return (
    <table className="w-full min-w-[1100px] table-fixed border-collapse">
      <colgroup>
        <col className="w-[4%]" />
        <col className="w-[11%]" />
        <col className="w-[14%]" />
        <col className="w-[8%]" />
        <col className="w-[8%]" />
        <col className="w-[7%]" />
        <col className="w-[8%]" />
        <col className="w-[9%]" />
        <col className="w-[31%]" />
      </colgroup>
      <thead>
        <tr className="border-b border-[var(--border)] text-left text-xs uppercase tracking-wide text-[var(--muted)]">
          <th className="px-2 py-2">#</th>
          <th className="px-2 py-2">Банк</th>
          <th className="px-2 py-2">Вклад</th>
          <th className="px-2 py-2">Номинал</th>
          <th className="px-2 py-2">Годовой экв.</th>
          <th className="px-2 py-2">Срок</th>
          <th className="px-2 py-2">Мин. сумма</th>
          <th className="px-2 py-2">Макс. сумма</th>
          <th className="px-2 py-2">Примечание</th>
        </tr>
      </thead>
      <tbody>
        {offers.map((offer) => (
          <tr key={offer.id} className="border-b border-[var(--border)]/70 align-top">
            <td className="px-2 py-2 tabular-nums">{offer.sortOrder}</td>
            <td className="px-2 py-2">{offer.bankName}</td>
            <td className="max-w-0 break-words px-2 py-2">
              {offer.productUrl ? (
                <a
                  href={offer.productUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="link-accent"
                >
                  {offer.productName || "—"}
                </a>
              ) : (
                offer.productName || "—"
              )}
            </td>
            <td className="px-2 py-2 tabular-nums">
              {formatDepositPercent(offer.nominalRatePercent)}
            </td>
            <td className="px-2 py-2 tabular-nums">
              {formatDepositPercent(offer.rateAnnualEquivPercent)}
            </td>
            <td className="px-2 py-2 tabular-nums">
              {offer.termDays != null ? `${offer.termDays} дн.` : "—"}
            </td>
            <td className="px-2 py-2 tabular-nums">
              {offer.minAmountThousands ? `${offer.minAmountThousands} т.р.` : "—"}
            </td>
            <td className="max-w-0 break-words px-2 py-2 tabular-nums">
              {offer.maxAmountText || "—"}
            </td>
            <td className="max-w-0 break-words px-2 py-2 text-sm leading-snug text-[var(--muted)]">
              {offer.conditions || "—"}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
