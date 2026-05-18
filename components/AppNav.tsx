"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import TelegramChannelPromo from "@/components/TelegramChannelPromo";
import VisitBadge from "@/components/VisitBadge";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import CalculatorInfoButton from "@/components/CalculatorInfoButton";
import CalculatorInfoModal from "@/components/CalculatorInfoModal";
import { useI18n } from "@/components/I18nProvider";
import {
  calculatorInfo,
  type CalculatorInfoKey,
} from "@/lib/calculator-info";

const TOOLTIP_SHOW_DELAY_MS = 200;

const navSections = [
  {
    key: "credits",
    links: [
      { href: "/", key: "early_repay" as const },
      { href: "/bonds", key: "bonds_cover" as const },
      { href: "/credit-card-benefit", key: "card_benefit" as const },
    ],
  },
  {
    key: "real_estate",
    links: [
      { href: "/mortgage-sale", key: "mortgage_sale" as const },
      {
        href: "/mortgage-conditions-compare",
        key: "mortgage_conditions_compare" as const,
      },
      { href: "/rent-vs-buy", key: "rent_vs_buy" as const },
    ],
  },
  {
    key: "basic",
    links: [
      { href: "/compound", key: "compound" as const },
      { href: "/discounting", key: "discounting" as const },
      { href: "/loan", key: "loan" as const },
    ],
  },
] as const;

type TooltipState = {
  key: CalculatorInfoKey;
  top: number;
  left: number;
  maxWidth: number;
};

export default function AppNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { tr, lang } = useI18n();
  const [openInfoKey, setOpenInfoKey] = useState<CalculatorInfoKey | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [mounted, setMounted] = useState(false);
  const showTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setMounted(true);
    return () => {
      if (showTimerRef.current) clearTimeout(showTimerRef.current);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, []);

  const clearShowTimer = useCallback(() => {
    if (showTimerRef.current) {
      clearTimeout(showTimerRef.current);
      showTimerRef.current = null;
    }
  }, []);

  const hideTooltipNow = useCallback(() => {
    clearShowTimer();
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
    setTooltip(null);
  }, [clearShowTimer]);

  const scheduleHideTooltip = useCallback(() => {
    clearShowTimer();
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      hideTimerRef.current = null;
      setTooltip(null);
    }, 150);
  }, [clearShowTimer]);

  const cancelHideTooltip = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const scheduleTooltip = useCallback(
    (key: CalculatorInfoKey, el: HTMLElement) => {
      clearShowTimer();
      showTimerRef.current = setTimeout(() => {
        showTimerRef.current = null;
        const rect = el.getBoundingClientRect();
        const maxWidth = Math.min(224, window.innerWidth - 16);
        const left = Math.min(
          Math.max(8, rect.right + 8),
          window.innerWidth - maxWidth - 8
        );
        setTooltip({
          key,
          top: rect.top + rect.height / 2,
          left,
          maxWidth,
        });
      }, TOOLTIP_SHOW_DELAY_MS);
    },
    [clearShowTimer]
  );

  const sectionTitles: Record<(typeof navSections)[number]["key"], string> = {
    credits: tr("Кредиты", "Credits"),
    real_estate: tr("Недвижимость", "Real Estate"),
    basic: tr("Базовые вещи", "Core Tools"),
  };

  const linkLabels: Record<CalculatorInfoKey, string> = {
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
    mortgage_conditions_compare: tr(
      "Сравнение ипотечных условий",
      "Mortgage Terms Comparison"
    ),
    rent_vs_buy: tr("Аренда против покупки", "Rent vs Buy"),
    compound: tr("Калькулятор сложных процентов", "Compound Interest Calculator"),
    discounting: tr(
      "Дисконтирование — будущая стоимость денег",
      "Discounting - Future Value of Money"
    ),
    loan: tr("Кредитный калькулятор", "Loan Calculator"),
  };

  const infoButtonLabel = tr(
    "Подробнее о калькуляторе",
    "More about this calculator"
  );

  const tooltipText = tooltip
    ? lang === "en"
      ? calculatorInfo[tooltip.key].shortEn
      : calculatorInfo[tooltip.key].shortRu
    : "";

  const tooltipPortal =
    mounted && tooltip ? (
      <span
        role="tooltip"
        style={{
          position: "fixed",
          top: tooltip.top,
          left: tooltip.left,
          maxWidth: tooltip.maxWidth,
          zIndex: 9999,
          transform: "translateY(-50%)",
        }}
        className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-left text-xs leading-snug text-[var(--foreground)] shadow-[var(--shadow-card)]"
        onMouseEnter={cancelHideTooltip}
        onMouseLeave={scheduleHideTooltip}
      >
        {tooltipText}
      </span>
    ) : null;

  return (
    <>
      <aside className="relative z-50 flex w-full shrink-0 flex-col border-b border-[var(--border)] bg-[var(--sidebar)] shadow-[var(--shadow-card)] md:sticky md:top-0 md:h-screen md:w-64 md:border-b-0 md:border-r">
        <div className="shrink-0 border-b border-[var(--border)] px-3 py-4 sm:px-4 sm:py-5">
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

        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-visible">
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
                    <div
                      key={href}
                      className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-1 rounded-lg transition ${
                        active
                          ? "bg-[var(--accent-soft)] ring-1 ring-[var(--accent)]/30"
                          : "hover:bg-[var(--accent-soft)]/50"
                      }`}
                    >
                      <Link
                        href={href}
                        className={`px-3 py-2.5 text-left text-sm font-medium leading-snug ${
                          active
                            ? "text-[var(--accent)]"
                            : "text-[var(--muted)] hover:text-[var(--foreground)]"
                        }`}
                      >
                        {linkLabels[key]}
                      </Link>
                      <div className="px-1 py-2">
                        <CalculatorInfoButton
                          label={infoButtonLabel}
                          onShowTooltip={(el) => scheduleTooltip(key, el)}
                          onHideTooltip={scheduleHideTooltip}
                          onOpen={() => {
                            hideTooltipNow();
                            setOpenInfoKey(key);
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
            <div className="space-y-3 border-t border-[var(--border)] pt-4 pb-1">
              <TelegramChannelPromo variant="sidebar" />
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
          </nav>
        </div>
      </aside>

      {mounted && tooltipPortal
        ? createPortal(tooltipPortal, document.body)
        : null}

      {openInfoKey ? (
        <CalculatorInfoModal
          infoKey={openInfoKey}
          title={linkLabels[openInfoKey]}
          onClose={() => setOpenInfoKey(null)}
        />
      ) : null}
    </>
  );
}
