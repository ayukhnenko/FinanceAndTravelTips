import { NextResponse } from "next/server";
import { getTotalVisits, visitsStoreConfigured } from "@/lib/visits-store";

export async function GET() {
  const configured = visitsStoreConfigured();
  const count = await getTotalVisits();
  return NextResponse.json({ count, configured });
}
