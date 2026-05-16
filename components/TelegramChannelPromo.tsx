"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useI18n } from "@/components/I18nProvider";

const TELEGRAM_URL = "https://t.me/FinanceAndTravelTips";
const DZEN_URL = "https://dzen.ru/FinanceAndTravelTips";

const QRCode = dynamic(() => import("react-qr-code"), {
  ssr: false,
  loading: () => (
    <div className="h-[60px] w-[60px] animate-pulse rounded-md bg-[var(--border)]/40" />
  ),
});

type Props = {
  /** Узкая колонка бокового меню: те же ссылка и QR, чуть компактнее */
  variant?: "default" | "sidebar";
};

export default function TelegramChannelPromo({ variant = "default" }: Props) {
  const { tr } = useI18n();
  const sidebar = variant === "sidebar";
  const qrSize = sidebar ? 56 : 60;
  const pad = sidebar ? "p-1.5" : "p-2";
  const text = sidebar ? "text-[10px] leading-tight" : "text-xs leading-snug";

  return (
    <div
      className={`rounded-lg border border-[var(--border)] bg-[var(--input-bg)] shadow-sm ${pad}`}
    >
      <div className="flex items-center gap-2">
        <div className="rounded-md bg-white p-1">
          <QRCode value={TELEGRAM_URL} size={qrSize} level="M" />
        </div>
        <div className="flex min-w-0 flex-1 flex-col items-start gap-1 text-left">
          <Link
            href={TELEGRAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={`link-accent ${text}`}
          >
            Telegram
          </Link>
          <Link
            href={DZEN_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={`${text} text-[var(--muted)] underline-offset-2 hover:text-[var(--foreground)] hover:underline`}
          >
            {tr("Дзен", "Dzen")}
          </Link>
        </div>
      </div>
    </div>
  );
}
