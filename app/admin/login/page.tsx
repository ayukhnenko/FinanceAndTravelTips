"use client";

import { FormEvent, Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

function AdminLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);

    try {
      const resp = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (!resp.ok) {
        setError("Неверный пароль администратора");
        return;
      }

      const from = searchParams.get("from");
      const nextPath =
        from && from.startsWith("/") && !from.startsWith("//")
          ? from
          : "/admin/settings";
      router.push(nextPath);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="card-panel w-full max-w-md space-y-5">
        <h1 className="text-2xl font-bold text-[var(--foreground)]">Вход в админ-панель</h1>
        <form className="space-y-4" onSubmit={onSubmit}>
          <label className="block">
            <span className="mb-1.5 block text-sm text-[var(--muted)]">Пароль администратора</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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

          <button type="submit" className="btn-primary w-full" disabled={pending}>
            {pending ? "Вход..." : "Войти как администратор"}
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
