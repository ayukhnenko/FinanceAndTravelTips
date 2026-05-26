import { NextResponse } from "next/server";
import { clearUserSessionCookie } from "@/lib/user-session-cookie";

export const dynamic = "force-dynamic";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  return clearUserSessionCookie(response);
}
