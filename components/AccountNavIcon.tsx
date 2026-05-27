"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/components/I18nProvider";

function UserIcon() {
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
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

export default function AccountNavIcon({ isLoggedIn }: { isLoggedIn: boolean }) {
  const pathname = usePathname();
  const { tr } = useI18n();

  const href = isLoggedIn ? "/account" : "/account/login";
  const title = isLoggedIn ? tr("Личный кабинет", "Account") : tr("Войти", "Log in");
  const active =
    pathname === "/account/login" ||
    pathname === "/account/register" ||
    pathname === "/account";

  return (
    <Link
      href={href}
      title={title}
      aria-label={title}
      className={`inline-flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-lg border transition ${
        active
          ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
          : "border-[var(--border)] bg-[var(--input-bg)] text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--accent-soft)]/50"
      }`}
    >
      <UserIcon />
    </Link>
  );
}
