"use client";

import dynamic from "next/dynamic";
import Link from "next/link";

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
  const sidebar = variant === "sidebar";
  const qrSize = sidebar ? 56 : 60;
  const pad = sidebar ? "p-1.5" : "p-2";
  const text = sidebar ? "text-[10px] leading-tight" : "text-xs leading-snug";

  return (
    <div
      className={`rounded-lg border border-[var(--border)] bg-[var(--input-bg)] text-center shadow-sm ${pad}`}
    >
      <p className={`text-[var(--muted)] ${text}`}>
        Подробнее о финансах и путешествиях — в Telegram-канале{" "}
        <Link
          href={TELEGRAM_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="link-accent"
        >
          @FinanceAndTravelTips
        </Link>
      </p>
      <div className={`flex flex-col items-center gap-1 ${sidebar ? "mt-1.5" : "mt-2"}`}>
        <div className="rounded-md bg-white p-1">
          <QRCode value={TELEGRAM_URL} size={qrSize} level="M" />
        </div>
        <span className="text-[10px] leading-tight text-[var(--muted)]">
          Отсканируйте QR, чтобы открыть канал
        </span>
        <Link
          href={DZEN_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[10px] leading-tight text-[var(--muted)] underline-offset-2 hover:text-[var(--foreground)] hover:underline"
        >
          Канал в Дзен: @FinanceAndTravelTips
        </Link>
      </div>
    </div>
  );
}
