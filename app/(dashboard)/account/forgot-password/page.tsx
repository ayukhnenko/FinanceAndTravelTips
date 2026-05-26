"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setPending(true);

    try {
      const resp = await fetch("/api/auth/request-password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = (await resp.json().catch(() => ({}))) as { error?: string; message?: string };
      if (!resp.ok) {
        setError(data.error ?? "Не удалось отправить письмо");
        return;
      }

      setMessage(
        data.message ??
          "Если аккаунт с таким подтверждённым e-mail существует, мы отправили ссылку для смены пароля."
      );
    } catch {
      setError("Не удалось отправить письмо");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto max-w-md p-5 md:p-8">
      <h1 className="text-2xl font-bold text-[var(--foreground)]">Восстановление пароля</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">
        Укажите подтверждённый e-mail аккаунта. Мы отправим ссылку для задания нового пароля.
      </p>

      <form onSubmit={handleSubmit} className="card-panel mt-6 space-y-4">
        <label className="block space-y-1">
          <span className="text-sm text-[var(--muted)]">E-mail</span>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="field-input w-full"
            required
          />
        </label>

        {error ? <p className="text-sm text-rose-700">{error}</p> : null}
        {message ? <p className="text-sm text-[var(--muted)]">{message}</p> : null}

        <button
          type="submit"
          disabled={pending}
          className="btn-primary w-full disabled:opacity-60"
        >
          {pending ? "Отправка..." : "Отправить ссылку"}
        </button>

        <p className="text-sm text-[var(--muted)]">
          <Link href="/account/login" className="link-accent">
            Вернуться ко входу
          </Link>
        </p>
      </form>
    </div>
  );
}
