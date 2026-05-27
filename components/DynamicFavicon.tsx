"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { MESSAGES_UNREAD_SYNC_EVENT } from "@/components/AccountMessagesNavIcon";
import { applyFavicon } from "@/lib/favicon-svg";

export default function DynamicFavicon() {
  const pathname = usePathname();
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [hasUnread, setHasUnread] = useState(false);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const defaultTitleRef = useRef<string | null>(null);

  const loadUnread = useCallback(async (loggedIn: boolean) => {
    if (!loggedIn) {
      setHasUnread(false);
      setUnreadChatCount(0);
      return;
    }

    try {
      const resp = await fetch("/api/auth/messages/unread");
      const data = (await resp.json().catch(() => ({}))) as {
        hasUnread?: boolean;
        unreadChatCount?: number;
      };
      if (!resp.ok) return;
      const count = data.unreadChatCount ?? 0;
      setUnreadChatCount(count);
      setHasUnread(Boolean(data.hasUnread ?? count > 0));
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
    if (defaultTitleRef.current === null) {
      defaultTitleRef.current = document.title;
    }

    const baseTitle = defaultTitleRef.current;
    const showUnread = isLoggedIn === true && hasUnread;
    document.title = showUnread
      ? unreadChatCount > 1
        ? `(● ${unreadChatCount}) ${baseTitle}`
        : `(●) ${baseTitle}`
      : baseTitle;
  }, [hasUnread, isLoggedIn, unreadChatCount]);

  useEffect(() => {
    if (!isLoggedIn) return;

    void loadUnread(true);

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
        if (typeof detail.unreadChatCount === "number") {
          setUnreadChatCount(detail.unreadChatCount);
        }
        return;
      }
      if (detail && typeof detail.unreadChatCount === "number") {
        setUnreadChatCount(detail.unreadChatCount);
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
