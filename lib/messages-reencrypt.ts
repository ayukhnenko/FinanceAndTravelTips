import { isEncryptedMessageEnvelope } from "@/lib/message-envelope";
import { encryptMessageForRecipientServer } from "@/lib/message-crypto-server";
import { getUserMessagePublicKey } from "@/lib/message-keys-store";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { getPeerIdFromChat, getChatRow } from "@/lib/messages-store";

const REENCRYPT_TIMEOUT_MS = Number(process.env.MESSAGES_TIMEOUT_MS ?? "5000");

async function withTimeout<T>(promise: PromiseLike<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error("reencrypt_timeout")), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

type PlainMessageRow = {
  id: string;
  body: string;
  sender_id: string;
  chat_id: string;
};

async function updateMessageBody(messageId: string, body: string): Promise<boolean> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return false;

  const response = await withTimeout(
    supabase.from("app_private_messages").update({ body }).eq("id", messageId).then((r) => r),
    REENCRYPT_TIMEOUT_MS
  );

  if (response.error) {
    console.error("[messages-reencrypt] updateMessageBody:", response.error);
    return false;
  }

  return true;
}

async function reencryptPlainMessage(
  message: PlainMessageRow,
  recipientId: string,
  recipientPublicKey: string
): Promise<boolean> {
  try {
    const encryptedBody = await encryptMessageForRecipientServer(message.body, recipientPublicKey);
    return updateMessageBody(message.id, encryptedBody);
  } catch (err) {
    console.error("[messages-reencrypt] reencryptPlainMessage:", err);
    return false;
  }
}

export async function reencryptPlainMessagesForRecipient(userId: string): Promise<number> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return 0;

  const recipientPublicKey = await getUserMessagePublicKey(userId);
  if (!recipientPublicKey) return 0;

  try {
    const lowChats = await withTimeout(
      supabase.from("app_private_chats").select("id").eq("user_low_id", userId).then((r) => r),
      REENCRYPT_TIMEOUT_MS
    );
    const highChats = await withTimeout(
      supabase.from("app_private_chats").select("id").eq("user_high_id", userId).then((r) => r),
      REENCRYPT_TIMEOUT_MS
    );

    if (lowChats.error || highChats.error) {
      console.error("[messages-reencrypt] load chats:", lowChats.error ?? highChats.error);
      return 0;
    }

    const chatIds = [
      ...(lowChats.data ?? []).map((row) => String(row.id)),
      ...(highChats.data ?? []).map((row) => String(row.id)),
    ];

    if (chatIds.length === 0) return 0;

    const messages = await withTimeout(
      supabase
        .from("app_private_messages")
        .select("id,body,sender_id,chat_id")
        .in("chat_id", chatIds)
        .neq("sender_id", userId)
        .then((r) => r),
      REENCRYPT_TIMEOUT_MS
    );

    if (messages.error) {
      console.error("[messages-reencrypt] load messages:", messages.error);
      return 0;
    }

    let updated = 0;
    for (const row of messages.data ?? []) {
      const body = String(row.body ?? "");
      if (isEncryptedMessageEnvelope(body)) continue;

      const ok = await reencryptPlainMessage(
        {
          id: String(row.id),
          body,
          sender_id: String(row.sender_id),
          chat_id: String(row.chat_id),
        },
        userId,
        recipientPublicKey
      );
      if (ok) updated += 1;
    }

    return updated;
  } catch (err) {
    console.error("[messages-reencrypt] reencryptPlainMessagesForRecipient:", err);
    return 0;
  }
}

export async function reencryptPlainMessagesInChat(chatId: string): Promise<number> {
  const chat = await getChatRow(chatId);
  if (!chat) return 0;

  const supabase = getSupabaseAdminClient();
  if (!supabase) return 0;

  try {
    const response = await withTimeout(
      supabase
        .from("app_private_messages")
        .select("id,body,sender_id,chat_id")
        .eq("chat_id", chatId)
        .then((r) => r),
      REENCRYPT_TIMEOUT_MS
    );

    if (response.error) {
      console.error("[messages-reencrypt] reencryptPlainMessagesInChat:", response.error);
      return 0;
    }

    let updated = 0;
    for (const row of response.data ?? []) {
      const body = String(row.body ?? "");
      if (isEncryptedMessageEnvelope(body)) continue;

      const senderId = String(row.sender_id);
      const recipientId = getPeerIdFromChat(chat, senderId);
      if (!recipientId) continue;

      const recipientPublicKey = await getUserMessagePublicKey(recipientId);
      if (!recipientPublicKey) continue;

      const ok = await reencryptPlainMessage(
        {
          id: String(row.id),
          body,
          sender_id: senderId,
          chat_id: chatId,
        },
        recipientId,
        recipientPublicKey
      );
      if (ok) updated += 1;
    }

    return updated;
  } catch (err) {
    console.error("[messages-reencrypt] reencryptPlainMessagesInChat:", err);
    return 0;
  }
}
