import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/get-current-user";
import { getOrCreatePrivateChat } from "@/lib/messages-store";
import { normalizeLogin } from "@/lib/user-credentials";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: { recipientLogin?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Некорректный запрос" }, { status: 400 });
  }

  const recipientLogin = normalizeLogin(String(body.recipientLogin ?? ""));
  if (!recipientLogin) {
    return NextResponse.json({ ok: false, error: "Укажите логин собеседника" }, { status: 400 });
  }

  const result = await getOrCreatePrivateChat(user.id, recipientLogin);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    chatId: result.chatId,
    peer: result.peer,
    created: result.created,
  });
}
