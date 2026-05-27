import Link from "next/link";
import { redirect } from "next/navigation";
import { formatDateTimeMoscow } from "@/lib/date-utils";
import { getCurrentUser } from "@/lib/get-current-user";
import AccountLogoutButton from "@/components/AccountLogoutButton";
import AccountProfileForm from "@/components/AccountProfileForm";

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
          <p className="mt-1 text-sm text-[var(--muted)]">Редактируйте профиль и данные для входа.</p>
        </div>
        <AccountLogoutButton />
      </div>

      <AccountProfileForm
        user={{
          login: user.login,
          name: user.name,
          phone: user.phone,
          email: user.email,
          emailVerifiedAt: user.emailVerifiedAt,
          createdAt: user.createdAt,
        }}
        createdAtLabel={formatDateTimeMoscow(user.createdAt)}
      />

      <p className="mt-4 text-sm text-[var(--muted)]">
        Для входа используйте логин или подтверждённый e-mail. Пароль хранится в базе в
        зашифрованном виде.
      </p>

      <p className="mt-2 text-sm text-[var(--muted)]">
        <Link href="/account/messages" className="link-accent">
          Сообщения
        </Link>
        {" · "}
        <Link href="/" className="link-accent">
          Вернуться к калькуляторам
        </Link>
      </p>
    </div>
  );
}
