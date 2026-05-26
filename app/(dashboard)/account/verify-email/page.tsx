import Link from "next/link";
import { verifyEmailToken } from "@/lib/email-verification";

type Props = {
  searchParams: { token?: string };
};

export default async function VerifyEmailPage({ searchParams }: Props) {
  const token = searchParams.token?.trim();

  if (!token) {
    return (
      <StatusPage
        title="Ссылка недействительна"
        message="В ссылке для подтверждения нет кода. Запросите новое письмо в личном кабинете."
        tone="error"
      />
    );
  }

  const result = await verifyEmailToken(token);

  if (!result.ok) {
    return (
      <StatusPage
        title="Не удалось подтвердить e-mail"
        message={result.error}
        tone="error"
      />
    );
  }

  return (
    <StatusPage
      title="E-mail подтверждён"
      message="Спасибо! Адрес e-mail успешно подтверждён."
      tone="success"
    />
  );
}

function StatusPage({
  title,
  message,
  tone,
}: {
  title: string;
  message: string;
  tone: "success" | "error";
}) {
  const toneClass =
    tone === "success" ? "text-emerald-700" : "text-rose-700";

  return (
    <div className="mx-auto max-w-md p-5 md:p-8">
      <h1 className="text-2xl font-bold text-[var(--foreground)]">{title}</h1>
      <p className={`mt-3 text-sm ${toneClass}`}>{message}</p>
      <p className="mt-6 text-sm text-[var(--muted)]">
        <Link href="/account" className="link-accent">
          Перейти в личный кабинет
        </Link>
      </p>
    </div>
  );
}
