"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { formatTimeMoscow } from "@/lib/date-utils";
import { isEncryptedMessageEnvelope } from "@/lib/message-envelope";
import {
  cacheSentMessagePlaintext,
  encryptMessageForRecipient,
  ensureLocalMessageKeys,
  resolveMessagePlaintext,
} from "@/lib/message-crypto-client";
import { MESSAGES_UNREAD_SYNC_EVENT } from "@/components/AccountMessagesNavIcon";

type MessagePeer = {
  id: string;
  login: string;
  name: string | null;
  messagePublicKey: string | null;
};

type PrivateMessage = {
  id: string;
  chatId: string;
  senderId: string;
  body: string;
  createdAt: string;
  isOwn: boolean;
};

type DisplayMessage = PrivateMessage & {
  displayBody: string;
  encrypted: boolean;
};

type PrivateChatSummary = {
  id: string;
  peer: MessagePeer;
  lastMessage: {
    body: string;
    createdAt: string;
    senderId: string;
  } | null;
  updatedAt: string;
  hasUnread: boolean;
};

type MessageRealtimeEvent =
  | { type: "message"; chatId: string; message: PrivateMessage }
  | { type: "ready" }
  | { type: "ping" }
  | { type: "error"; error: string };

function peerLabel(peer: MessagePeer): string {
  return peer.name?.trim() ? `${peer.name} (@${peer.login})` : `@${peer.login}`;
}

function previewText(text: string, max = 80): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}

function syncUnreadBadge(unreadChatCount: number): void {
  window.dispatchEvent(
    new CustomEvent(MESSAGES_UNREAD_SYNC_EVENT, {
      detail: { unreadChatCount, hasUnread: unreadChatCount > 0 },
    })
  );
}

async function markChatRead(chatId: string): Promise<void> {
  try {
    await fetch(`/api/auth/messages/chats/${encodeURIComponent(chatId)}/read`, {
      method: "POST",
    });
  } catch {
    // ignore transient errors
  }
}

export default function AccountMessagesPanel() {
  const [chats, setChats] = useState<PrivateChatSummary[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [activePeer, setActivePeer] = useState<MessagePeer | null>(null);
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [loadingChats, setLoadingChats] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [keysReady, setKeysReady] = useState(false);
  const [recipientLogin, setRecipientLogin] = useState("");
  const [messageBody, setMessageBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendingOpen, setPendingOpen] = useState(false);
  const [pendingSend, setPendingSend] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const activeChatIdRef = useRef<string | null>(null);
  const privateKeyRef = useRef<CryptoKey | null>(null);

  activeChatIdRef.current = activeChatId;

  const chatIdsKey = chats
    .map((chat) => chat.id)
    .sort()
    .join(",");

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const toDisplayMessages = useCallback(async (items: PrivateMessage[]): Promise<DisplayMessage[]> => {
    return Promise.all(
      items.map(async (message) => ({
        ...message,
        encrypted: isEncryptedMessageEnvelope(message.body),
        displayBody: await resolveMessagePlaintext({
          id: message.id,
          body: message.body,
          isOwn: message.isOwn,
          privateKey: privateKeyRef.current,
        }),
      }))
    );
  }, []);

  const loadChats = useCallback(async (): Promise<PrivateChatSummary[]> => {
    try {
      const resp = await fetch("/api/auth/messages/chats");
      const data = (await resp.json().catch(() => ({}))) as {
        chats?: PrivateChatSummary[];
        unreadChatCount?: number;
        error?: string;
      };
      if (!resp.ok) {
        setError(data.error ?? "Не удалось загрузить чаты");
        return [];
      }
      const nextChats = data.chats ?? [];
      setChats(nextChats);
      syncUnreadBadge(
        typeof data.unreadChatCount === "number"
          ? data.unreadChatCount
          : nextChats.filter((chat) => chat.hasUnread).length
      );
      return nextChats;
    } catch {
      setError("Не удалось загрузить чаты");
      return [];
    } finally {
      setLoadingChats(false);
    }
  }, []);

  const loadMessages = useCallback(
    async (chatId: string) => {
      setLoadingMessages(true);
      try {
        const resp = await fetch(`/api/auth/messages/chats/${encodeURIComponent(chatId)}`);
        const data = (await resp.json().catch(() => ({}))) as {
          messages?: PrivateMessage[];
          peer?: MessagePeer;
          error?: string;
        };
        if (!resp.ok) {
          setError(data.error ?? "Не удалось загрузить сообщения");
          return;
        }
        setMessages(await toDisplayMessages(data.messages ?? []));
        setActivePeer(data.peer ?? null);
        setChats((current) => {
          const next = current.map((chat) =>
            chat.id === chatId ? { ...chat, hasUnread: false } : chat
          );
          syncUnreadBadge(next.filter((chat) => chat.hasUnread).length);
          return next;
        });
        requestAnimationFrame(scrollToBottom);
      } catch {
        setError("Не удалось загрузить сообщения");
      } finally {
        setLoadingMessages(false);
      }
    },
    [scrollToBottom, toDisplayMessages]
  );

  const appendMessage = useCallback(
    async (message: PrivateMessage, plaintextOverride?: string) => {
      const displayBody =
        plaintextOverride ??
        (await resolveMessagePlaintext({
          id: message.id,
          body: message.body,
          isOwn: message.isOwn,
          privateKey: privateKeyRef.current,
        }));

      setMessages((current) => {
        if (current.some((item) => item.id === message.id)) return current;
        return [
          ...current,
          {
            ...message,
            encrypted: isEncryptedMessageEnvelope(message.body),
            displayBody,
          },
        ];
      });
      requestAnimationFrame(scrollToBottom);
    },
    [scrollToBottom]
  );

  useEffect(() => {
    void (async () => {
      try {
        const keys = await ensureLocalMessageKeys();
        privateKeyRef.current = keys.privateKey;
        setKeysReady(true);
        if (keys.keysStoreError) {
          setError(keys.keysStoreError);
        }
        await loadChats();
      } catch {
        setError("Не удалось настроить ключи шифрования сообщений");
      }
    })();
  }, [loadChats]);

  useEffect(() => {
    void loadChats();
  }, [loadChats]);

  useEffect(() => {
    if (!activeChatId || !keysReady) return;
    void loadMessages(activeChatId);
  }, [activeChatId, keysReady, loadMessages]);

  useEffect(() => {
    if (!keysReady) return;

    const source = new EventSource("/api/auth/messages/events");

    source.onmessage = (event) => {
      let data: MessageRealtimeEvent;
      try {
        data = JSON.parse(event.data) as MessageRealtimeEvent;
      } catch {
        return;
      }

      if (data.type === "message") {
        if (data.chatId === activeChatIdRef.current) {
          void appendMessage(data.message);
          if (!data.message.isOwn) {
            void markChatRead(data.chatId);
          }
          setChats((current) => {
            const next = current.map((chat) =>
              chat.id === data.chatId ? { ...chat, hasUnread: false } : chat
            );
            syncUnreadBadge(next.filter((chat) => chat.hasUnread).length);
            return next;
          });
        } else {
          setChats((current) => {
            const next = current.map((chat) =>
              chat.id === data.chatId ? { ...chat, hasUnread: true } : chat
            );
            syncUnreadBadge(next.filter((chat) => chat.hasUnread).length);
            return next;
          });
        }
        void loadChats();
        return;
      }

      if (data.type === "error") {
        setError("Не удалось подключить обновления сообщений в реальном времени");
      }
    };

    return () => source.close();
  }, [appendMessage, chatIdsKey, keysReady, loadChats]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  async function handleOpenChat(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setPendingOpen(true);

    try {
      const resp = await fetch("/api/auth/messages/chats/open", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientLogin }),
      });
      const data = (await resp.json().catch(() => ({}))) as {
        chatId?: string;
        peer?: MessagePeer;
        error?: string;
      };
      if (!resp.ok) {
        setError(data.error ?? "Не удалось открыть чат");
        return;
      }

      setRecipientLogin("");
      setActiveChatId(data.chatId ?? null);
      setActivePeer(data.peer ?? null);
      await loadChats();
      if (data.chatId) {
        await loadMessages(data.chatId);
      }
    } catch {
      setError("Не удалось открыть чат");
    } finally {
      setPendingOpen(false);
    }
  }

  async function handleSelectChat(chat: PrivateChatSummary) {
    setError(null);
    setActiveChatId(chat.id);
    setActivePeer(chat.peer);
    await loadMessages(chat.id);
  }

  async function handleSendMessage(event: FormEvent) {
    event.preventDefault();
    if (!activeChatId || !activePeer) return;

    setError(null);
    setPendingSend(true);

    const plaintext = messageBody.trim();
    if (!plaintext) {
      setPendingSend(false);
      return;
    }

    try {
      let peerForSend = activePeer;
      if (!peerForSend.messagePublicKey) {
        const refreshedChats = await loadChats();
        const freshChat = refreshedChats.find((chat) => chat.id === activeChatId);
        if (freshChat?.peer.messagePublicKey) {
          peerForSend = freshChat.peer;
          setActivePeer(freshChat.peer);
        }
      }

      const bodyToSend = peerForSend.messagePublicKey
        ? await encryptMessageForRecipient(plaintext, peerForSend.messagePublicKey)
        : plaintext;

      const resp = await fetch(`/api/auth/messages/chats/${encodeURIComponent(activeChatId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: bodyToSend }),
      });
      const data = (await resp.json().catch(() => ({}))) as {
        message?: PrivateMessage;
        error?: string;
      };
      if (!resp.ok) {
        setError(data.error ?? "Не удалось отправить сообщение");
        return;
      }

      setMessageBody("");
      if (data.message) {
        if (peerForSend.messagePublicKey) {
          cacheSentMessagePlaintext(data.message.id, plaintext);
        }
        await appendMessage(data.message, plaintext);
      } else {
        await loadMessages(activeChatId);
      }
      await loadChats();
    } catch {
      setError("Не удалось отправить сообщение");
    } finally {
      setPendingSend(false);
    }
  }

  const canSend = Boolean(messageBody.trim()) && !pendingSend;

  return (
    <div className="mt-6 flex flex-col gap-4 md:mt-4 md:h-[calc(100vh-9rem)] md:flex-row md:gap-0 md:overflow-hidden md:rounded-xl md:border md:border-[var(--border)] md:bg-[var(--card)] md:shadow-[var(--shadow-card)]">
      <aside className="flex w-full shrink-0 flex-col gap-2.5 rounded-xl border border-[var(--border)] bg-[var(--card)] p-3 shadow-[var(--shadow-card)] md:w-52 md:rounded-none md:border-0 md:border-r md:border-[var(--border)] md:p-2.5 md:shadow-none">
        <div>
          <h2 className="px-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--foreground)]">
            Чаты
          </h2>
          <p className="mt-1 px-1 text-xs leading-snug text-[var(--muted)]">
            Шифрование включается, когда собеседник откроет «Сообщения»
          </p>
        </div>

        <form onSubmit={handleOpenChat} className="space-y-1.5">
          <input
            type="text"
            value={recipientLogin}
            onChange={(e) => setRecipientLogin(e.target.value)}
            className="field-input w-full text-xs"
            placeholder="Логин собеседника"
            autoComplete="off"
          />
          <button
            type="submit"
            disabled={pendingOpen || !recipientLogin.trim()}
            className="btn-primary w-full px-2.5 py-2 text-xs disabled:opacity-60"
          >
            {pendingOpen ? "Открытие..." : "Новый чат"}
          </button>
        </form>

        <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto md:max-h-none">
          {loadingChats ? (
            <p className="px-1 text-xs text-[var(--muted)]">Загрузка...</p>
          ) : chats.length === 0 ? (
            <p className="px-1 text-xs text-[var(--muted)]">Пока нет чатов</p>
          ) : (
            chats.map((chat) => {
              const active = chat.id === activeChatId;
              const unread = chat.hasUnread && !active;
              return (
                <button
                  key={chat.id}
                  type="button"
                  onClick={() => void handleSelectChat(chat)}
                  className={`w-full rounded-lg border px-2.5 py-2 text-left transition ${
                    active
                      ? "border-[var(--accent)] bg-[var(--accent-soft)] ring-1 ring-[var(--accent)]/30"
                      : unread
                        ? "border-[var(--accent)]/70 bg-[var(--accent-soft)]/70 hover:bg-[var(--accent-soft)]"
                        : "border-[var(--border)] bg-[var(--input-bg)] hover:bg-[var(--accent-soft)]/40"
                  }`}
                >
                  <div
                    className={`text-xs leading-snug ${
                      unread
                        ? "font-semibold text-[var(--accent)]"
                        : "font-medium text-[var(--foreground)]"
                    }`}
                  >
                    {peerLabel(chat.peer)}
                  </div>
                  {chat.lastMessage ? (
                    <div
                      className={`mt-0.5 text-[10px] leading-snug ${
                        unread ? "font-medium text-[var(--foreground)]" : "text-[var(--muted)]"
                      }`}
                    >
                      {previewText(chat.lastMessage.body, 48)}
                    </div>
                  ) : (
                    <div className="mt-0.5 text-[10px] leading-snug text-[var(--muted)]">
                      Нет сообщений
                    </div>
                  )}
                </button>
              );
            })
          )}
        </div>
      </aside>

      <section className="flex min-h-[420px] min-w-0 flex-1 flex-col rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-[var(--shadow-card)] md:min-h-0 md:rounded-none md:border-0 md:shadow-none">
        {!activeChatId || !activePeer ? (
          <div className="flex flex-1 items-center justify-center text-sm text-[var(--muted)]">
            Выберите чат или начните новый
          </div>
        ) : (
          <>
            <div className="border-b border-[var(--border)] pb-3">
              <h2 className="text-sm font-semibold text-[var(--foreground)]">
                {peerLabel(activePeer)}
              </h2>
              {!activePeer.messagePublicKey ? (
                <p className="mt-1 text-xs text-amber-700">
                  Собеседник ещё не открывал «Сообщения» — новые сообщения отправляются без
                  шифрования
                </p>
              ) : null}
            </div>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto py-4">
              {loadingMessages ? (
                <p className="text-sm text-[var(--muted)]">Загрузка сообщений...</p>
              ) : messages.length === 0 ? (
                <p className="text-sm text-[var(--muted)]">Сообщений пока нет — напишите первым</p>
              ) : (
                messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.isOwn ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                        message.isOwn
                          ? "bg-[var(--accent-soft)] text-[var(--foreground)]"
                          : "bg-[var(--input-bg)] text-[var(--foreground)]"
                      }`}
                    >
                      <p className="whitespace-pre-wrap break-words leading-snug">
                        {message.displayBody}
                        <span className="ml-2 inline whitespace-nowrap text-[10px] tabular-nums text-[var(--muted)]">
                          {formatTimeMoscow(message.createdAt)}
                        </span>
                      </p>
                      {!message.encrypted ? (
                        <p className="mt-1 text-[10px] text-amber-700">Не зашифровано</p>
                      ) : null}
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSendMessage} className="border-t border-[var(--border)] pt-3">
              <div className="flex items-center gap-2">
                <label className="min-w-0 flex-1">
                  <span className="sr-only">Сообщение</span>
                  <input
                    type="text"
                    value={messageBody}
                    onChange={(e) => setMessageBody(e.target.value)}
                    className="field-input w-full"
                    placeholder="Введите сообщение..."
                    maxLength={4000}
                    autoComplete="off"
                  />
                </label>
                <button
                  type="submit"
                  disabled={!canSend}
                  className="btn-primary shrink-0 disabled:opacity-60"
                >
                  {pendingSend ? "..." : "Отправить"}
                </button>
              </div>
            </form>
          </>
        )}

        {error ? <p className="mt-3 text-sm text-rose-700">{error}</p> : null}
      </section>
    </div>
  );
}
