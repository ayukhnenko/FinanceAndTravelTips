"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { MESSAGES_UNREAD_SYNC_EVENT } from "@/components/AccountMessagesNavIcon";
import { applyFavicon } from "@/lib/favicon-svg";

export default function DynamicFavicon() {
  const pathname = usePathname();
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [hasUnread, setHasUnread] = useState(false);

  const loadUnread = useCallback(async (loggedIn: boolean) => {
    if (!loggedIn) {
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
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const resp = await fetch("/api/auth/me");
        const loggedIn = resp.ok;
        setIsLoggedIn(loggedIn);
        await loadUnread(loggedIn);
      } catch {
        setIsLoggedIn(false);
        setHasUnread(false);
      }
    })();
  }, [loadUnread]);

  useEffect(() => {
    applyFavicon(isLoggedIn === true && hasUnread);
  }, [hasUnread, isLoggedIn]);

  useEffect(() => {
    if (!isLoggedIn) return;

    const interval = window.setInterval(() => {
      void loadUnread(true);
    }, 30000);

    const onFocus = () => {
      void loadUnread(true);
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
      void loadUnread(true);
    };

    let source: EventSource | null = null;
    if (!pathname.startsWith("/account/messages")) {
      source = new EventSource("/api/auth/messages/events");
      source.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as { type?: string };
          if (data.type === "message") {
            void loadUnread(true);
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

  return null;
}
