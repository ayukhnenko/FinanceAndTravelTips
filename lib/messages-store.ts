import { previewEncryptedMessageBody, validateEncryptedMessageBody } from "@/lib/message-envelope";
import { getUserMessagePublicKey } from "@/lib/message-keys-store";
import { readPrivateMessagesRetentionHours } from "@/lib/settings-params-store";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { findUserById, findUserByLogin } from "@/lib/users-store";

const MESSAGES_TIMEOUT_MS = Number(process.env.MESSAGES_TIMEOUT_MS ?? "5000");
const MAX_MESSAGE_LENGTH = 4000;

export type MessagePeer = {
  id: string;
  login: string;
  name: string | null;
  messagePublicKey: string | null;
};

export type PrivateMessage = {
  id: string;
  chatId: string;
  senderId: string;
  body: string;
  createdAt: string;
  isOwn: boolean;
};

export function mapPrivateMessageRow(
  row: Record<string, unknown>,
  currentUserId: string
): PrivateMessage {
  return {
    id: String(row.id),
    chatId: String(row.chat_id),
    senderId: String(row.sender_id),
    body: String(row.body),
    createdAt: String(row.created_at),
    isOwn: String(row.sender_id) === currentUserId,
  };
}

export type PrivateChatSummary = {
  id: string;
  peer: MessagePeer;
  lastMessage: {
    body: string;
    createdAt: string;
    senderId: string;
  } | null;
  updatedAt: string;
};

type ChatRow = {
  id: string;
  user_low_id: string;
  user_high_id: string;
  updated_at: string;
};

async function withTimeout<T>(promise: PromiseLike<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error("messages_timeout")), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function orderUserIds(userA: string, userB: string): [string, string] {
  return userA < userB ? [userA, userB] : [userB, userA];
}

function mapPeer(row: {
  id: string;
  login: string;
  name: string | null;
  message_public_key?: string | null;
}): MessagePeer {
  return {
    id: String(row.id),
    login: String(row.login),
    name: row.name == null ? null : String(row.name),
    messagePublicKey:
      row.message_public_key == null || !String(row.message_public_key).trim()
        ? null
        : String(row.message_public_key).trim(),
  };
}

export function validateMessageBody(body: string): string | null {
  const trimmed = body.trim();
  if (!trimmed) return "Сообщение не может быть пустым";
  if (trimmed.length > MAX_MESSAGE_LENGTH) {
    return `Сообщение не должно быть длиннее ${MAX_MESSAGE_LENGTH} символов`;
  }
  return null;
}

export async function deleteExpiredPrivateMessages(): Promise<void> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return;

  const hours = await readPrivateMessagesRetentionHours();
  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

  try {
    await withTimeout(
      supabase
        .from("app_private_messages")
        .delete()
        .lt("created_at", cutoff)
        .then((r) => r),
      MESSAGES_TIMEOUT_MS
    );
  } catch (err) {
    console.error("[messages-store] deleteExpiredPrivateMessages:", err);
  }
}

async function getChatRow(chatId: string): Promise<ChatRow | null> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return null;

  const response = await withTimeout(
    supabase
      .from("app_private_chats")
      .select("id,user_low_id,user_high_id,updated_at")
      .eq("id", chatId)
      .maybeSingle()
      .then((r) => r),
    MESSAGES_TIMEOUT_MS
  );

  if (response.error || !response.data) return null;
  return response.data as ChatRow;
}

export function getPeerIdFromChat(chat: ChatRow, userId: string): string | null {
  if (chat.user_low_id === userId) return chat.user_high_id;
  if (chat.user_high_id === userId) return chat.user_low_id;
  return null;
}

export async function isChatParticipant(chatId: string, userId: string): Promise<boolean> {
  const chat = await getChatRow(chatId);
  if (!chat) return false;
  return getPeerIdFromChat(chat, userId) !== null;
}

async function loadPeers(peerIds: string[]): Promise<Map<string, MessagePeer>> {
  const supabase = getSupabaseAdminClient();
  const peers = new Map<string, MessagePeer>();
  if (!supabase || peerIds.length === 0) return peers;

  const response = await withTimeout(
    supabase
      .from("app_users")
      .select("id,login,name,message_public_key")
      .in("id", peerIds)
      .then((r) => r),
    MESSAGES_TIMEOUT_MS
  );

  if (response.error) {
    console.error("[messages-store] loadPeers:", response.error);
    return peers;
  }

  for (const row of response.data ?? []) {
    peers.set(
      String(row.id),
      mapPeer(
        row as {
          id: string;
          login: string;
          name: string | null;
          message_public_key?: string | null;
        }
      )
    );
  }

  return peers;
}

export async function listPrivateChatsForUser(userId: string): Promise<PrivateChatSummary[]> {
  await deleteExpiredPrivateMessages();

  const supabase = getSupabaseAdminClient();
  if (!supabase) return [];

  try {
    const [lowChats, highChats] = await Promise.all([
      withTimeout(
        supabase
          .from("app_private_chats")
          .select("id,user_low_id,user_high_id,updated_at")
          .eq("user_low_id", userId)
          .order("updated_at", { ascending: false })
          .then((r) => r),
        MESSAGES_TIMEOUT_MS
      ),
      withTimeout(
        supabase
          .from("app_private_chats")
          .select("id,user_low_id,user_high_id,updated_at")
          .eq("user_high_id", userId)
          .order("updated_at", { ascending: false })
          .then((r) => r),
        MESSAGES_TIMEOUT_MS
      ),
    ]);

    if (lowChats.error || highChats.error) {
      console.error("[messages-store] listPrivateChatsForUser:", lowChats.error ?? highChats.error);
      return [];
    }

    const chats = [...(lowChats.data ?? []), ...(highChats.data ?? [])] as ChatRow[];
    chats.sort((a, b) => b.updated_at.localeCompare(a.updated_at));

    if (chats.length === 0) return [];

    const peerIds = chats
      .map((chat) => getPeerIdFromChat(chat, userId))
      .filter((id): id is string => Boolean(id));
    const peers = await loadPeers(peerIds);

    const chatIds = chats.map((chat) => chat.id);
    const messagesResponse = await withTimeout(
      supabase
        .from("app_private_messages")
        .select("id,chat_id,sender_id,body,created_at")
        .in("chat_id", chatIds)
        .order("created_at", { ascending: false })
        .then((r) => r),
      MESSAGES_TIMEOUT_MS
    );

    const lastByChat = new Map<
      string,
      { body: string; createdAt: string; senderId: string }
    >();

    if (!messagesResponse.error) {
      for (const row of messagesResponse.data ?? []) {
        const chatId = String(row.chat_id);
        if (lastByChat.has(chatId)) continue;
        lastByChat.set(chatId, {
          body: previewEncryptedMessageBody(String(row.body)),
          createdAt: String(row.created_at),
          senderId: String(row.sender_id),
        });
      }
    }

    return chats
      .map((chat) => {
        const peerId = getPeerIdFromChat(chat, userId);
        if (!peerId) return null;
        const peer = peers.get(peerId);
        if (!peer) return null;
        return {
          id: chat.id,
          peer,
          lastMessage: lastByChat.get(chat.id) ?? null,
          updatedAt: chat.updated_at,
        };
      })
      .filter((chat): chat is PrivateChatSummary => chat !== null);
  } catch (err) {
    console.error("[messages-store] listPrivateChatsForUser:", err);
    return [];
  }
}

export async function listChatIdsForUser(userId: string): Promise<string[]> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return [];

  try {
    const [lowChats, highChats] = await Promise.all([
      withTimeout(
        supabase.from("app_private_chats").select("id").eq("user_low_id", userId).then((r) => r),
        MESSAGES_TIMEOUT_MS
      ),
      withTimeout(
        supabase.from("app_private_chats").select("id").eq("user_high_id", userId).then((r) => r),
        MESSAGES_TIMEOUT_MS
      ),
    ]);

    if (lowChats.error || highChats.error) {
      console.error("[messages-store] listChatIdsForUser:", lowChats.error ?? highChats.error);
      return [];
    }

    const ids = new Set<string>();
    for (const row of lowChats.data ?? []) ids.add(String(row.id));
    for (const row of highChats.data ?? []) ids.add(String(row.id));
    return Array.from(ids);
  } catch (err) {
    console.error("[messages-store] listChatIdsForUser:", err);
    return [];
  }
}

export async function listPrivateMessages(
  chatId: string,
  userId: string
): Promise<PrivateMessage[] | null> {
  await deleteExpiredPrivateMessages();

  const chat = await getChatRow(chatId);
  if (!chat || getPeerIdFromChat(chat, userId) === null) return null;

  const supabase = getSupabaseAdminClient();
  if (!supabase) return null;

  try {
    const response = await withTimeout(
      supabase
        .from("app_private_messages")
        .select("id,chat_id,sender_id,body,created_at")
        .eq("chat_id", chatId)
        .order("created_at", { ascending: true })
        .then((r) => r),
      MESSAGES_TIMEOUT_MS
    );

    if (response.error) {
      console.error("[messages-store] listPrivateMessages:", response.error);
      return null;
    }

    return (response.data ?? []).map((row) =>
      mapPrivateMessageRow(row as Record<string, unknown>, userId)
    );
  } catch (err) {
    console.error("[messages-store] listPrivateMessages:", err);
    return null;
  }
}

async function mapPeerFromUser(user: {
  id: string;
  login: string;
  name: string | null;
}): Promise<MessagePeer> {
  return {
    id: user.id,
    login: user.login,
    name: user.name,
    messagePublicKey: await getUserMessagePublicKey(user.id),
  };
}

export type GetOrCreateChatResult =
  | { ok: true; chatId: string; peer: MessagePeer; created: boolean }
  | { ok: false; error: string };

export async function getOrCreatePrivateChat(
  userId: string,
  recipientLogin: string
): Promise<GetOrCreateChatResult> {
  const recipient = await findUserByLogin(recipientLogin);
  if (!recipient) {
    return { ok: false, error: "Пользователь с таким логином не найден" };
  }
  if (recipient.id === userId) {
    return { ok: false, error: "Нельзя начать чат с самим собой" };
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return { ok: false, error: "База данных не настроена" };
  }

  const [userLowId, userHighId] = orderUserIds(userId, recipient.id);
  const now = new Date().toISOString();

  try {
    const existing = await withTimeout(
      supabase
        .from("app_private_chats")
        .select("id")
        .eq("user_low_id", userLowId)
        .eq("user_high_id", userHighId)
        .maybeSingle()
        .then((r) => r),
      MESSAGES_TIMEOUT_MS
    );

    if (existing.error) {
      console.error("[messages-store] getOrCreatePrivateChat:", existing.error);
      return { ok: false, error: "Не удалось открыть чат" };
    }

    if (existing.data?.id) {
      return {
        ok: true,
        chatId: String(existing.data.id),
        peer: await mapPeerFromUser(recipient),
        created: false,
      };
    }

    const inserted = await withTimeout(
      supabase
        .from("app_private_chats")
        .insert({
          user_low_id: userLowId,
          user_high_id: userHighId,
          updated_at: now,
        })
        .select("id")
        .single()
        .then((r) => r),
      MESSAGES_TIMEOUT_MS
    );

    if (inserted.error || !inserted.data) {
      console.error("[messages-store] getOrCreatePrivateChat insert:", inserted.error);
      return { ok: false, error: "Не удалось создать чат" };
    }

    return {
      ok: true,
      chatId: String(inserted.data.id),
      peer: await mapPeerFromUser(recipient),
      created: true,
    };
  } catch (err) {
    console.error("[messages-store] getOrCreatePrivateChat:", err);
    return { ok: false, error: "Не удалось открыть чат" };
  }
}

export type SendPrivateMessageResult =
  | { ok: true; message: PrivateMessage }
  | { ok: false; error: string };

export async function sendPrivateMessage(
  chatId: string,
  senderId: string,
  body: string
): Promise<SendPrivateMessageResult> {
  await deleteExpiredPrivateMessages();

  const validationError = validateEncryptedMessageBody(body);
  if (validationError) {
    return { ok: false, error: validationError };
  }

  const chat = await getChatRow(chatId);
  if (!chat || getPeerIdFromChat(chat, senderId) === null) {
    return { ok: false, error: "Чат не найден" };
  }

  const peerId = getPeerIdFromChat(chat, senderId);
  if (!peerId) {
    return { ok: false, error: "Чат не найден" };
  }

  const recipientPublicKey = await getUserMessagePublicKey(peerId);
  if (!recipientPublicKey) {
    return { ok: false, error: "У получателя не настроен ключ шифрования" };
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return { ok: false, error: "База данных не настроена" };
  }

  const trimmedBody = body.trim();
  const now = new Date().toISOString();

  try {
    const inserted = await withTimeout(
      supabase
        .from("app_private_messages")
        .insert({
          chat_id: chatId,
          sender_id: senderId,
          body: trimmedBody,
        })
        .select("id,chat_id,sender_id,body,created_at")
        .single()
        .then((r) => r),
      MESSAGES_TIMEOUT_MS
    );

    if (inserted.error || !inserted.data) {
      console.error("[messages-store] sendPrivateMessage:", inserted.error);
      return { ok: false, error: "Не удалось отправить сообщение" };
    }

    await withTimeout(
      supabase
        .from("app_private_chats")
        .update({ updated_at: now })
        .eq("id", chatId)
        .then((r) => r),
      MESSAGES_TIMEOUT_MS
    );

    const row = inserted.data;
    return {
      ok: true,
      message: mapPrivateMessageRow(row as Record<string, unknown>, senderId),
    };
  } catch (err) {
    console.error("[messages-store] sendPrivateMessage:", err);
    return { ok: false, error: "Не удалось отправить сообщение" };
  }
}

export async function getPrivateChatPeer(
  chatId: string,
  userId: string
): Promise<MessagePeer | null> {
  const chat = await getChatRow(chatId);
  if (!chat) return null;

  const peerId = getPeerIdFromChat(chat, userId);
  if (!peerId) return null;

  const user = await findUserById(peerId);
  if (!user) return null;

  const messagePublicKey = await getUserMessagePublicKey(peerId);
  return {
    ...mapPeer(user),
    messagePublicKey,
  };
}
