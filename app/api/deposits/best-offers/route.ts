import { NextResponse } from "next/server";
import { readSortedDepositOffers } from "@/lib/deposit-offers-api";
import { TOPBANKI_DEPOSITS_SOURCE_KEY } from "@/lib/deposits-topbanki-config";
import { readDepositsPublicSettings } from "@/lib/settings-params-store";

export const dynamic = "force-dynamic";

export async function GET() {
  const settings = await readDepositsPublicSettings();
  const offers = await readSortedDepositOffers(TOPBANKI_DEPOSITS_SOURCE_KEY, 200);

  return NextResponse.json(
    {
      offerCount: offers.length,
      lastSyncedAt: settings.topbankiLastSyncedAt,
      inclusionThreshold: null,
      sourceUrl: settings.topbankiUrl,
      comparisonSumText: settings.topbankiComparisonSumText,
      offers,
    },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      },
    }
  );
}
