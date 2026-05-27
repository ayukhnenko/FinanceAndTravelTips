import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/get-current-user";
import { markPrivateChatAsRead } from "@/lib/messages-store";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: { chatId: string };
};

export async function POST(_request: Request, context: RouteContext) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const ok = await markPrivateChatAsRead(context.params.chatId, user.id);
  if (!ok) {
    return NextResponse.json({ ok: false, error: "Чат не найден" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
