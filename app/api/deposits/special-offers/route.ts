import { NextResponse } from "next/server";
import { readDepositOffers } from "@/lib/deposit-offers-store";
import { readDepositsPublicSettings } from "@/lib/settings-params-store";

export const dynamic = "force-dynamic";

export async function GET() {
  const settings = await readDepositsPublicSettings();
  const offers = await readDepositOffers(settings.sheetUrl, 200);

  return NextResponse.json(
    {
      offerCount: offers.length,
      lastSyncedAt: settings.lastSyncedAt,
      sheetChangedAt: settings.sheetChangedAt,
      inclusionThreshold: settings.inclusionThreshold,
      sheetUrl: settings.sheetUrl,
      offers,
    },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      },
    }
  );
}
