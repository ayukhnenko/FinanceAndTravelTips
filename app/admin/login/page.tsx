"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

function AdminLoginForm() {
  const searchParams = useSearchParams();
  const from = searchParams.get("from");
  const error = searchParams.get("error");
  const sessionExpired = Boolean(from);

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="card-panel w-full max-w-md space-y-5">
        <h1 className="text-2xl font-bold text-[var(--foreground)]">Вход в админ-панель</h1>

        {sessionExpired && !error ? (
          <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950">
            Сессия истекла или вы не авторизованы. Введите пароль снова.
          </p>
        ) : null}

        <form className="space-y-4" action="/api/admin/login" method="POST">
          {from ? <input type="hidden" name="from" value={from} /> : null}

          <label className="block">
            <span className="mb-1.5 block text-sm text-[var(--muted)]">Пароль администратора</span>
            <input
              type="password"
              name="password"
              className="field-input"
              autoComplete="current-password"
              required
            />
          </label>

          {error ? (
            <p className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-900">
              {error}
            </p>
          ) : null}

          <button type="submit" className="btn-primary w-full">
            Войти как администратор
          </button>
        </form>

        <p className="text-sm">
          <Link href="/" className="link-accent">
            Вернуться к калькуляторам
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-[var(--muted)]">
          Загрузка...
        </div>
      }
    >
      <AdminLoginForm />
    </Suspense>
  );
}
