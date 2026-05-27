import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/get-current-user";
import { listPrivateChatsForUser } from "@/lib/messages-store";
import { readPrivateMessagesRetentionHours } from "@/lib/settings-params-store";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const [chats, retentionHours] = await Promise.all([
    listPrivateChatsForUser(user.id),
    readPrivateMessagesRetentionHours(),
  ]);

  return NextResponse.json({ ok: true, chats, retentionHours });
}
