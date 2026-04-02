"use client";

import dynamic from "next/dynamic";
import Link from "next/link";

const TELEGRAM_URL = "https://t.me/FinanceAndTravelTips";

const QRCode = dynamic(() => import("react-qr-code"), {
  ssr: false,
  loading: () => (
    <div className="h-[120px] w-[120px] animate-pulse rounded-lg bg-[var(--border)]/40" />
  ),
});

type Props = {
  /** Узкая колонка бокового меню: те же ссылка и QR, чуть компактнее */
  variant?: "default" | "sidebar";
};

export default function TelegramChannelPromo({ variant = "default" }: Props) {
  const sidebar = variant === "sidebar";
  const qrSize = sidebar ? 112 : 120;
  const pad = sidebar ? "p-3" : "p-4";
  const text = sidebar ? "text-xs leading-snug" : "text-sm";

  return (
    <div
      className={`rounded-xl border border-[var(--border)] bg-[var(--input-bg)] text-center shadow-sm ${pad}`}
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
      <div className={`flex flex-col items-center gap-2 ${sidebar ? "mt-3" : "mt-4"}`}>
        <div className="rounded-lg bg-white p-2">
          <QRCode value={TELEGRAM_URL} size={qrSize} level="M" />
        </div>
        <span className="text-xs text-[var(--muted)]">
          Отсканируйте QR, чтобы открыть канал
        </span>
      </div>
    </div>
  );
}
