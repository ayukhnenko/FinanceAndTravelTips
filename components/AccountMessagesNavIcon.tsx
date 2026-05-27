"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/components/I18nProvider";

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

  const title = tr("Сообщения", "Messages");
  const href = isLoggedIn ? "/account/messages" : "/account/login?from=/account/messages";
  const active = pathname.startsWith("/account/messages");

  return (
    <Link
      href={href}
      title={title}
      aria-label={title}
      className={`inline-flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-lg border transition ${
        active
          ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
          : "border-[var(--border)] bg-[var(--input-bg)] text-[var(--muted)] hover:bg-[var(--accent-soft)]/50 hover:text-[var(--foreground)]"
      }`}
    >
      <MessagesIcon />
    </Link>
  );
}
