import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/get-current-user";
import {
  getUserMessagePublicKey,
  setUserMessagePublicKey,
} from "@/lib/message-keys-store";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const publicKey = await getUserMessagePublicKey(user.id);
  return NextResponse.json({ ok: true, publicKey, hasKeys: Boolean(publicKey) });
}

export async function PUT(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: { publicKey?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Некорректный запрос" }, { status: 400 });
  }

  const result = await setUserMessagePublicKey(user.id, String(body.publicKey ?? ""));
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
