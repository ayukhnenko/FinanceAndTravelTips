"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import TelegramChannelPromo from "@/components/TelegramChannelPromo";
import VisitBadge from "@/components/VisitBadge";

const links = [
  { href: "/", label: "Досрочное погашение" },
  {
    href: "/bonds",
    label: "Плати за кредит с инвестиций",
  },
  { href: "/compound", label: "Сложные проценты" },
  { href: "/loan", label: "Кредитный калькулятор" },
] as const;

export default function AppNav() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <aside className="flex w-full shrink-0 flex-col border-b border-[var(--border)] bg-[var(--sidebar)] shadow-[var(--shadow-card)] md:sticky md:top-0 md:h-screen md:w-64 md:border-b-0 md:border-r">
      <div className="border-b border-[var(--border)] px-3 py-4 sm:px-4 sm:py-5">
        <Link
          href="/"
          className="block text-lg font-bold leading-snug tracking-tight text-[var(--foreground)] hover:text-[var(--accent)]"
        >
          Финансовая логика жизни
        </Link>
        <div className="mt-4">
          <TelegramChannelPromo variant="sidebar" />
        </div>
      </div>

      <nav className="flex flex-col gap-0.5 px-3 py-4 md:flex-1">
        {links.map(({ href, label }) => {
          const active =
            href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`rounded-lg px-3 py-2.5 text-left text-sm font-medium leading-snug transition ${
                active
                  ? "bg-[var(--accent-soft)] text-[var(--accent)] ring-1 ring-[var(--accent)]/30"
                  : "text-[var(--muted)] hover:bg-[var(--accent-soft)]/50 hover:text-[var(--foreground)]"
              }`}
            >
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto flex flex-col gap-3 border-t border-[var(--border)] p-3">
        <VisitBadge className="w-full justify-center" />
        <button
          type="button"
          onClick={async () => {
            await fetch("/api/auth/logout", { method: "POST" });
            router.push("/login");
            router.refresh();
          }}
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--muted)] transition hover:border-[var(--accent)]/40 hover:text-[var(--foreground)]"
        >
          Выйти
        </button>
      </div>
    </aside>
  );
}
