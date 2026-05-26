"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [passwordRepeat, setPasswordRepeat] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (password !== passwordRepeat) {
      setError("Пароли не совпадают");
      return;
    }

    if (!token) {
      setError("Ссылка недействительна");
      return;
    }

    setPending(true);

    try {
      const resp = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = (await resp.json().catch(() => ({}))) as { error?: string };
      if (!resp.ok) {
        setError(data.error ?? "Не удалось обновить пароль");
        return;
      }

      router.push("/account/login?reset=1");
      router.refresh();
    } catch {
      setError("Не удалось обновить пароль");
    } finally {
      setPending(false);
    }
  }

  if (!token) {
    return (
      <div className="mx-auto max-w-md p-5 md:p-8">
        <h1 className="text-2xl font-bold text-[var(--foreground)]">Ссылка недействительна</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Запросите восстановление пароля ещё раз.
        </p>
        <p className="mt-4 text-sm">
          <Link href="/account/forgot-password" className="link-accent">
            Восстановить пароль
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md p-5 md:p-8">
      <h1 className="text-2xl font-bold text-[var(--foreground)]">Новый пароль</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">Задайте новый пароль для входа в личный кабинет.</p>

      <form onSubmit={handleSubmit} className="card-panel mt-6 space-y-4">
        <label className="block space-y-1">
          <span className="text-sm text-[var(--muted)]">Новый пароль</span>
          <input
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="field-input w-full"
            minLength={8}
            required
          />
          <span className="block text-xs text-[var(--muted)]">Не короче 8 символов</span>
        </label>

        <label className="block space-y-1">
          <span className="text-sm text-[var(--muted)]">Повторите пароль</span>
          <input
            type="password"
            autoComplete="new-password"
            value={passwordRepeat}
            onChange={(e) => setPasswordRepeat(e.target.value)}
            className="field-input w-full"
            minLength={8}
            required
          />
        </label>

        {error ? <p className="text-sm text-rose-700">{error}</p> : null}

        <button
          type="submit"
          disabled={pending}
          className="btn-primary w-full disabled:opacity-60"
        >
          {pending ? "Сохранение..." : "Сохранить пароль"}
        </button>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center text-[var(--muted)]">
          Загрузка…
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
