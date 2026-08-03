import Link from "next/link";
import CasesPanel from "@/components/CasesPanel";
import { getCurrentUser } from "@/lib/get-current-user";

type CasesPageProps = {
  searchParams?: {
    case?: string;
    token?: string;
  };
};

export default async function CasesPage({ searchParams }: CasesPageProps) {
  const user = await getCurrentUser();

  return (
    <div className="mx-auto max-w-6xl p-5 md:p-6 lg:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Кейсы</h1>
          <p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">
            Опишите финансовую ситуацию и отправьте кейс на анализ. Ответ придёт на e-mail;
            после ответа можно продолжить переписку с аналитиком.
          </p>
        </div>
        <Link href="/" className="btn-primary px-3 py-2">
          На главную
        </Link>
      </div>

      <CasesPanel
        isLoggedIn={Boolean(user)}
        userEmail={user?.email ?? null}
        initialCaseId={searchParams?.case ?? null}
        initialGuestToken={searchParams?.token ?? null}
      />
    </div>
  );
}
