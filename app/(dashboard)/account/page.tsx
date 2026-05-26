import Link from "next/link";
import { redirect } from "next/navigation";
import { formatDateTimeMoscow } from "@/lib/date-utils";
import { getCurrentUser } from "@/lib/get-current-user";
import AccountLogoutButton from "@/components/AccountLogoutButton";
import AccountEmailVerification from "@/components/AccountEmailVerification";

function formatPhoneDisplay(phone: string): string {
  if (phone.length === 11 && phone.startsWith("7")) {
    return `+7 ${phone.slice(1, 4)} ${phone.slice(4, 7)}-${phone.slice(7, 9)}-${phone.slice(9)}`;
  }
  return phone.startsWith("+") ? phone : `+${phone}`;
}

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/account/login?from=/account");
  }

  return (
    <div className="mx-auto max-w-2xl p-5 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Личный кабинет</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">Ваш профиль и данные для входа.</p>
        </div>
        <AccountLogoutButton />
      </div>

      <dl className="card-panel mt-6 grid gap-4 sm:grid-cols-2">
        <div>
          <dt className="text-xs uppercase tracking-wide text-[var(--muted)]">Логин</dt>
          <dd className="mt-1 text-sm font-medium text-[var(--foreground)]">{user.login}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-[var(--muted)]">Телефон</dt>
          <dd className="mt-1 text-sm font-medium text-[var(--foreground)] tabular-nums">
            {formatPhoneDisplay(user.phone)}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-[var(--muted)]">E-mail</dt>
          <dd className="mt-1 text-sm font-medium text-[var(--foreground)]">
            {user.email ?? "—"}
          </dd>
          {user.email ? (
            <AccountEmailVerification
              email={user.email}
              verified={Boolean(user.emailVerifiedAt)}
            />
          ) : null}
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-[var(--muted)]">Имя</dt>
          <dd className="mt-1 text-sm font-medium text-[var(--foreground)]">{user.name ?? "—"}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-xs uppercase tracking-wide text-[var(--muted)]">Зарегистрирован</dt>
          <dd className="mt-1 text-sm font-medium text-[var(--foreground)] tabular-nums">
            {formatDateTimeMoscow(user.createdAt)}
          </dd>
        </div>
      </dl>

      <p className="mt-4 text-sm text-[var(--muted)]">
        Для входа используйте логин или телефон. Пароль хранится в базе в зашифрованном виде.
      </p>

      <p className="mt-2 text-sm text-[var(--muted)]">
        <Link href="/" className="link-accent">
          Вернуться к калькуляторам
        </Link>
      </p>
    </div>
  );
}
