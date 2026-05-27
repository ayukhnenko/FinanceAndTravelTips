"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import AccountEmailVerification from "@/components/AccountEmailVerification";

type ProfileUser = {
  login: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  emailVerifiedAt: string | null;
  createdAt: string;
};

type Props = {
  user: ProfileUser;
  createdAtLabel: string;
};

function formatPhoneDisplay(phone: string): string {
  if (phone.length === 11 && phone.startsWith("7")) {
    return `+7 ${phone.slice(1, 4)} ${phone.slice(4, 7)}-${phone.slice(7, 9)}-${phone.slice(9)}`;
  }
  return phone.startsWith("+") ? phone : `+${phone}`;
}

function phoneToInputValue(phone: string | null): string {
  if (!phone) return "";
  return formatPhoneDisplay(phone);
}

export default function AccountProfileForm({ user, createdAtLabel }: Props) {
  const router = useRouter();
  const [name, setName] = useState(user.name ?? "");
  const [phone, setPhone] = useState(phoneToInputValue(user.phone));
  const [email, setEmail] = useState(user.email ?? "");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setPending(true);

    try {
      const resp = await fetch("/api/auth/update-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          phone: phone.trim() || undefined,
          email: email.trim() || undefined,
        }),
      });
      const data = (await resp.json().catch(() => ({}))) as {
        error?: string;
        emailChanged?: boolean;
        verificationSent?: boolean;
      };

      if (!resp.ok) {
        setError(data.error ?? "Не удалось сохранить профиль");
        return;
      }

      if (data.emailChanged && data.verificationSent) {
        setSuccess("Профиль сохранён. На новый e-mail отправлено письмо для подтверждения.");
      } else if (data.emailChanged) {
        setSuccess("Профиль сохранён. Подтвердите новый e-mail — кнопка ниже.");
      } else {
        setSuccess("Профиль сохранён.");
      }

      router.refresh();
    } catch {
      setError("Не удалось сохранить профиль");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card-panel mt-6 space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <span className="text-xs uppercase tracking-wide text-[var(--muted)]">Логин</span>
          <p className="mt-1 text-sm font-medium text-[var(--foreground)]">{user.login}</p>
        </div>
        <div>
          <span className="text-xs uppercase tracking-wide text-[var(--muted)]">Зарегистрирован</span>
          <p className="mt-1 text-sm font-medium text-[var(--foreground)] tabular-nums">
            {createdAtLabel}
          </p>
        </div>
      </div>

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
        <span className="block text-xs text-[var(--muted)]">Оставьте пустым, чтобы удалить номер</span>
      </label>

      <div className="space-y-1">
        <label className="block space-y-1">
          <span className="text-sm text-[var(--muted)]">E-mail</span>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="field-input w-full"
          />
        </label>
        <span className="block text-xs text-[var(--muted)]">
          Позволяет восстановить пароль. При смене e-mail потребуется подтверждение.
        </span>
        {email.trim() ? (
          <AccountEmailVerification
            email={email.trim()}
            verified={Boolean(user.emailVerifiedAt) && email.trim().toLowerCase() === (user.email ?? "").toLowerCase()}
          />
        ) : null}
      </div>

      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
      {success ? <p className="text-sm text-emerald-700">{success}</p> : null}

      <button
        type="submit"
        disabled={pending}
        className="btn-primary disabled:opacity-60"
      >
        {pending ? "Сохранение..." : "Сохранить изменения"}
      </button>
    </form>
  );
}
