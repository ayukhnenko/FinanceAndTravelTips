"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import TelegramChannelPromo from "@/components/TelegramChannelPromo";
import VisitBadge from "@/components/VisitBadge";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useI18n } from "@/components/I18nProvider";

const navSections = [
  {
    key: "credits",
    links: [
      { href: "/", key: "early_repay" },
      {
        href: "/bonds",
        key: "bonds_cover",
      },
      { href: "/credit-card-benefit", key: "card_benefit" },
    ],
  },
  {
    key: "real_estate",
    links: [
      {
        href: "/mortgage-sale",
        key: "mortgage_sale",
      },
      {
        href: "/rent-vs-buy",
        key: "rent_vs_buy",
      },
    ],
  },
  {
    key: "basic",
    links: [
      { href: "/compound", key: "compound" },
      { href: "/loan", key: "loan" },
    ],
  },
] as const;

export default function AppNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { tr } = useI18n();

  const sectionTitles: Record<(typeof navSections)[number]["key"], string> = {
    credits: tr("Кредиты", "Credits"),
    real_estate: tr("Недвижимость", "Real Estate"),
    basic: tr("Базовые вещи", "Core Tools"),
  };

  const linkLabels: Record<(typeof navSections)[number]["links"][number]["key"], string> = {
    early_repay: tr(
      "Выгодно ли гасить кредит досрочно",
      "Is Early Repayment Worth It?"
    ),
    bonds_cover: tr(
      "Сколько инвестиций нужно, чтобы покрыть кредит",
      "How Much Should You Invest to Cover a Loan?"
    ),
    card_benefit: tr(
      "Выгода от оплаты кредиткой",
      "Credit Card Spending Benefit"
    ),
    mortgage_sale: tr(
      "Выгодно ли продавать квартиру в ипотеке",
      "Is Selling a Mortgaged Apartment Worth It?"
    ),
    rent_vs_buy: tr("Аренда против покупки", "Rent vs Buy"),
    compound: tr("Калькулятор сложных процентов", "Compound Interest Calculator"),
    loan: tr("Кредитный калькулятор", "Loan Calculator"),
  };

  return (
    <aside className="flex w-full shrink-0 flex-col border-b border-[var(--border)] bg-[var(--sidebar)] shadow-[var(--shadow-card)] md:sticky md:top-0 md:h-screen md:w-64 md:border-b-0 md:border-r">
      <div className="border-b border-[var(--border)] px-3 py-4 sm:px-4 sm:py-5">
        <Link
          href="/"
          className="block text-lg font-bold leading-snug tracking-tight text-[var(--foreground)] hover:text-[var(--accent)]"
        >
          {tr("Калькуляторы для жизни", "Life Calculators")}
        </Link>
        <div className="mt-2">
          <LanguageSwitcher />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <nav className="flex flex-col gap-4 px-3 py-4">
          {navSections.map((section) => (
            <div key={section.key} className="space-y-1">
              <p className="px-1 pb-1 text-xs font-semibold uppercase tracking-wide text-[var(--foreground)]">
                {sectionTitles[section.key]}
              </p>
              {section.links.map(({ href, key }) => {
                const active =
                  href === "/" ? pathname === "/" : pathname.startsWith(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`block rounded-lg px-3 py-2.5 text-left text-sm font-medium leading-snug transition ${
                      active
                        ? "bg-[var(--accent-soft)] text-[var(--accent)] ring-1 ring-[var(--accent)]/30"
                        : "text-[var(--muted)] hover:bg-[var(--accent-soft)]/50 hover:text-[var(--foreground)]"
                    }`}
                  >
                    {linkLabels[key]}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
      </div>

      <div className="border-t border-[var(--border)] px-3 py-2.5">
        <TelegramChannelPromo variant="sidebar" />
      </div>

      <div className="flex flex-col gap-2 border-t border-[var(--border)] p-3">
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
          {tr("Выйти", "Log out")}
        </button>
      </div>
    </aside>
  );
}
