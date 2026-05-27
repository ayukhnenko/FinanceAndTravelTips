"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useI18n } from "@/components/I18nProvider";

export const MESSAGES_UNREAD_SYNC_EVENT = "app-messages-unread-sync";

function MessagesIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

export default function AccountMessagesNavIcon({ isLoggedIn }: { isLoggedIn: boolean }) {
  const pathname = usePathname();
  const { tr } = useI18n();
  const [hasUnread, setHasUnread] = useState(false);

  const title = tr("Сообщения", "Messages");
  const href = isLoggedIn ? "/account/messages" : "/account/login?from=/account/messages";
  const active = pathname.startsWith("/account/messages");

  const loadUnread = useCallback(async () => {
    if (!isLoggedIn) {
      setHasUnread(false);
      return;
    }

    try {
      const resp = await fetch("/api/auth/messages/unread");
      const data = (await resp.json().catch(() => ({}))) as {
        hasUnread?: boolean;
        unreadChatCount?: number;
      };
      if (!resp.ok) return;
      setHasUnread(Boolean(data.hasUnread ?? (data.unreadChatCount ?? 0) > 0));
    } catch {
      // ignore transient errors
    }
  }, [isLoggedIn]);

  useEffect(() => {
    void loadUnread();
  }, [loadUnread]);

  useEffect(() => {
    if (!isLoggedIn) return;

    const interval = window.setInterval(() => {
      void loadUnread();
    }, 30000);

    const onFocus = () => {
      void loadUnread();
    };

    const onSync = (event: Event) => {
      const detail = (event as CustomEvent<{ hasUnread?: boolean; unreadChatCount?: number }>)
        .detail;
      if (detail && typeof detail.hasUnread === "boolean") {
        setHasUnread(detail.hasUnread);
        return;
      }
      if (detail && typeof detail.unreadChatCount === "number") {
        setHasUnread(detail.unreadChatCount > 0);
        return;
      }
      void loadUnread();
    };

    let source: EventSource | null = null;
    if (!pathname.startsWith("/account/messages")) {
      source = new EventSource("/api/auth/messages/events");
      source.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as { type?: string };
          if (data.type === "message") {
            void loadUnread();
          }
        } catch {
          // ignore malformed events
        }
      };
    }

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    window.addEventListener(MESSAGES_UNREAD_SYNC_EVENT, onSync);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
      window.removeEventListener(MESSAGES_UNREAD_SYNC_EVENT, onSync);
      source?.close();
    };
  }, [isLoggedIn, loadUnread, pathname]);

  const highlighted = active || hasUnread;
  const unreadLabel = tr("Есть новые сообщения", "You have new messages");

  return (
    <Link
      href={href}
      title={hasUnread ? `${title} — ${unreadLabel}` : title}
      aria-label={hasUnread ? `${title} — ${unreadLabel}` : title}
      className={`relative inline-flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-lg border transition ${
        highlighted
          ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
          : "border-[var(--border)] bg-[var(--input-bg)] text-[var(--muted)] hover:bg-[var(--accent-soft)]/50 hover:text-[var(--foreground)]"
      }`}
    >
      <MessagesIcon />
      {hasUnread && !active ? (
        <span
          className="absolute right-1 top-1 h-2 w-2 rounded-full bg-[var(--accent)] ring-2 ring-[var(--card)]"
          aria-hidden
        />
      ) : null}
    </Link>
  );
}
