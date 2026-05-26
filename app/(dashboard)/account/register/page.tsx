"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export default function AccountRegisterPage() {
  const router = useRouter();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);

    try {
      const resp = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          login,
          password,
          name,
          phone: phone.trim() || undefined,
          email: email.trim() || undefined,
        }),
      });
      const data = (await resp.json().catch(() => ({}))) as { error?: string };
      if (!resp.ok) {
        setError(data.error ?? "Не удалось зарегистрироваться");
        return;
      }

      router.push("/account");
      router.refresh();
    } catch {
      setError("Не удалось зарегистрироваться");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto max-w-md p-5 md:p-8">
      <h1 className="text-2xl font-bold text-[var(--foreground)]">Регистрация</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">
        Обязательны логин, пароль и имя. Телефон и e-mail — по желанию.
      </p>

      <form onSubmit={handleSubmit} className="card-panel mt-6 space-y-4">
        <label className="block space-y-1">
          <span className="text-sm text-[var(--muted)]">Логин *</span>
          <input
            type="text"
            autoComplete="username"
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            className="field-input w-full"
            required
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm text-[var(--muted)]">Пароль *</span>
          <input
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="field-input w-full"
            minLength={8}
            required
          />
          <span className="block text-xs text-[var(--muted)]">
            Не короче 8 символов
          </span>
        </label>

        <label className="block space-y-1">
          <span className="text-sm text-[var(--muted)]">Имя *</span>
          <input
            type="text"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="field-input w-full"
            required
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm text-[var(--muted)]">Телефон</span>
          <input
            type="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="field-input w-full"
            placeholder="+7 900 000-00-00"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm text-[var(--muted)]">E-mail</span>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="field-input w-full"
          />
          <span className="block text-xs text-[var(--muted)]">
            Позволяет восстановить пароль
          </span>
        </label>

        {error ? <p className="text-sm text-rose-700">{error}</p> : null}

        <button
          type="submit"
          disabled={pending}
          className="btn-primary w-full disabled:opacity-60"
        >
          {pending ? "Регистрация..." : "Зарегистрироваться"}
        </button>

        <p className="text-sm text-[var(--muted)]">
          Уже есть аккаунт?{" "}
          <Link href="/account/login" className="link-accent">
            Войти
          </Link>
        </p>
      </form>
    </div>
  );
}
