"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";

function AccountLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);

    try {
      const resp = await fetch("/api/auth/user-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password }),
      });
      const data = (await resp.json().catch(() => ({}))) as { error?: string };
      if (!resp.ok) {
        setError(data.error ?? "Не удалось войти");
        return;
      }

      const from = searchParams.get("from");
      router.push(from && from.startsWith("/") && !from.startsWith("//") ? from : "/account");
      router.refresh();
    } catch {
      setError("Не удалось войти");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto max-w-md p-5 md:p-8">
      <h1 className="text-2xl font-bold text-[var(--foreground)]">Вход в личный кабинет</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">
        Введите логин или номер телефона и пароль.
      </p>

      <form onSubmit={handleSubmit} className="card-panel mt-6 space-y-4">
        <label className="block space-y-1">
          <span className="text-sm text-[var(--muted)]">Логин или телефон</span>
          <input
            type="text"
            autoComplete="username"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            className="field-input w-full"
            required
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm text-[var(--muted)]">Пароль</span>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="field-input w-full"
            required
          />
        </label>

        {error ? <p className="text-sm text-rose-700">{error}</p> : null}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2 text-sm font-medium text-[var(--foreground)] transition hover:border-[var(--accent)]/40 disabled:opacity-60"
        >
          {pending ? "Вход..." : "Войти"}
        </button>

        <p className="text-sm text-[var(--muted)]">
          Нет аккаунта?{" "}
          <Link href="/account/register" className="link-accent">
            Зарегистрироваться
          </Link>
        </p>
      </form>
    </div>
  );
}

export default function AccountLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center text-[var(--muted)]">
          Загрузка…
        </div>
      }
    >
      <AccountLoginForm />
    </Suspense>
  );
}
