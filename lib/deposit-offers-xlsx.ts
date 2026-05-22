import type { DepositOfferViewRow } from "@/components/DepositOffersTable";
import { formatDepositPercent } from "@/lib/deposit-offers-format";

function formatPercentForExport(value: number | null): string {
  const formatted = formatDepositPercent(value);
  return formatted === "—" ? "" : formatted;
}

function formatTermDaysForExport(termDays: number | null): string {
  return termDays != null ? String(termDays) : "";
}

function formatMinAmountForExport(minAmountThousands: string): string {
  return minAmountThousands ? `${minAmountThousands} т.р.` : "";
}

export async function downloadDepositOffersXlsx(
  offers: DepositOfferViewRow[],
  filenameStem: string
): Promise<void> {
  if (offers.length === 0) return;

  const XLSX = await import("xlsx");
  const rows = offers.map((offer) => ({
    "#": offer.sortOrder,
    Банк: offer.bankName,
    Вклад: offer.productName,
    Номинал: formatPercentForExport(offer.nominalRatePercent),
    "Годовой экв.": formatPercentForExport(offer.rateAnnualEquivPercent),
    "Срок, дн.": formatTermDaysForExport(offer.termDays),
    "Мин. сумма": formatMinAmountForExport(offer.minAmountThousands),
    "Макс. сумма": offer.maxAmountText,
    Примечание: offer.conditions,
    Ссылка: offer.productUrl,
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Вклады");

  const date = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(workbook, `${filenameStem}-${date}.xlsx`);
}
