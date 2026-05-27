import type { RealtimeChannel } from "@supabase/supabase-js";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import {
  listChatIdsForUser,
  mapPrivateMessageRow,
  type PrivateMessage,
} from "@/lib/messages-store";

export type MessageRealtimeEvent =
  | { type: "message"; chatId: string; message: PrivateMessage }
  | { type: "ready" }
  | { type: "ping" }
  | { type: "error"; error: string };

export async function subscribeUserMessageEvents(
  userId: string,
  onEvent: (event: MessageRealtimeEvent) => void
): Promise<() => void> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    throw new Error("Supabase not configured");
  }

  const chatIds = await listChatIdsForUser(userId);
  if (chatIds.length === 0) {
    onEvent({ type: "ready" });
    return () => {};
  }

  const channelName = `messages-user:${userId}:${Date.now()}`;
  let channel: RealtimeChannel = supabase.channel(channelName);

  const handleInsert = (payload: { new: Record<string, unknown> }) => {
    const chatId = String(payload.new.chat_id ?? "");
    if (!chatId) return;
    onEvent({
      type: "message",
      chatId,
      message: mapPrivateMessageRow(payload.new, userId),
    });
  };

  for (const chatId of chatIds) {
    channel = channel.on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "app_private_messages",
        filter: `chat_id=eq.${chatId}`,
      },
      handleInsert
    );
  }

  channel.subscribe((status, err) => {
    if (status === "SUBSCRIBED") {
      onEvent({ type: "ready" });
      return;
    }
    if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
      console.error("[messages-realtime] channel status:", status, err);
      onEvent({ type: "error", error: "realtime_unavailable" });
    }
  });

  return () => {
    void supabase.removeChannel(channel);
  };
}
