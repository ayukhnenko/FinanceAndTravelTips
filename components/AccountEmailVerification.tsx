"use client";

import { useState } from "react";

type Props = {
  email: string;
  verified: boolean;
};

export default function AccountEmailVerification({ email, verified }: Props) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (verified) {
    return <span className="text-xs text-emerald-700">Подтверждён</span>;
  }

  async function handleResend() {
    setPending(true);
    setMessage(null);
    setError(null);

    try {
      const resp = await fetch("/api/auth/send-email-verification", { method: "POST" });
      const data = (await resp.json().catch(() => ({}))) as { error?: string };
      if (!resp.ok) {
        setError(data.error ?? "Не удалось отправить письмо");
        return;
      }
      setMessage("Письмо отправлено. Проверьте почту и перейдите по ссылке из письма.");
    } catch {
      setError("Не удалось отправить письмо");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-1 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-amber-700">Не подтверждён</span>
        <button
          type="button"
          onClick={() => void handleResend()}
          disabled={pending}
          className="btn-primary px-2 py-1 text-xs disabled:opacity-60"
        >
          {pending ? "Отправка..." : "Отправить письмо"}
        </button>
      </div>
      {message ? <p className="text-xs text-[var(--muted)]">{message}</p> : null}
      {error ? <p className="text-xs text-rose-700">{error}</p> : null}
      {!message ? (
        <p className="text-xs text-[var(--muted)]">
          На {email} можно отправить ссылку для подтверждения.
        </p>
      ) : null}
    </div>
  );
}
