import Link from "next/link";
import { redirect } from "next/navigation";
import AccountMessagesPanel from "@/components/AccountMessagesPanel";
import { getCurrentUser } from "@/lib/get-current-user";

export default async function AccountMessagesPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/account/login?from=/account/messages");
  }

  return (
    <div className="mx-auto max-w-6xl p-5 md:p-6 lg:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-2xl font-bold text-[var(--foreground)]">Сообщения</h1>
        <Link href="/" className="btn-primary px-3 py-2">
          На главную
        </Link>
      </div>

      <AccountMessagesPanel />
    </div>
  );
}
