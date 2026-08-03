import AdminCasesPanel from "@/components/AdminCasesPanel";

type AdminCasesPageProps = {
  searchParams?: {
    case?: string;
  };
};

export default function AdminCasesPage({ searchParams }: AdminCasesPageProps) {
  return <AdminCasesPanel initialCaseId={searchParams?.case ?? null} />;
}
