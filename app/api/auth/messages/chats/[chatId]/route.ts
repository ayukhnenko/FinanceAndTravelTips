import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/get-current-user";
import {
  getPrivateChatPeer,
  listPrivateMessages,
  sendPrivateMessage,
} from "@/lib/messages-store";
import { readPrivateMessagesRetentionHours } from "@/lib/settings-params-store";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: { chatId: string };
};

export async function GET(_request: Request, context: RouteContext) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const chatId = context.params.chatId;
  const [messages, peer, retentionHours] = await Promise.all([
    listPrivateMessages(chatId, user.id),
    getPrivateChatPeer(chatId, user.id),
    readPrivateMessagesRetentionHours(),
  ]);

  if (messages === null || !peer) {
    return NextResponse.json({ ok: false, error: "Чат не найден" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, messages, peer, retentionHours });
}

export async function POST(request: Request, context: RouteContext) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: { body?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Некорректный запрос" }, { status: 400 });
  }

  const result = await sendPrivateMessage(
    context.params.chatId,
    user.id,
    String(body.body ?? "")
  );

  if (!result.ok) {
    const status = result.error === "Чат не найден" ? 404 : 400;
    return NextResponse.json({ ok: false, error: result.error }, { status });
  }

  return NextResponse.json({ ok: true, message: result.message });
}
