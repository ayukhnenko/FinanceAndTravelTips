import { NextResponse } from "next/server";
import { incrementTotalVisits, visitsStoreConfigured } from "@/lib/visits-store";

export async function POST() {
  if (!visitsStoreConfigured()) {
    return NextResponse.json(
      { error: "Счётчик не настроен", count: null, configured: false },
      { status: 503 }
    );
  }
  const count = await incrementTotalVisits();
  if (count == null) {
    return NextResponse.json(
      {
        error:
          "Supabase не отвечает. Проверьте URL/Service Role Key и логи функции в Vercel (ищите [visits]).",
        count: null,
        configured: true,
      },
      { status: 500 }
    );
  }
  return NextResponse.json({ count, configured: true });
}
