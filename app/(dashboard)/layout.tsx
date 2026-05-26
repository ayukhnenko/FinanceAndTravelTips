import AppNav from "@/components/AppNav";
import { VisitTracker } from "@/components/VisitBadge";
import { getCurrentUser } from "@/lib/get-current-user";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <VisitTracker />
      <AppNav isAdmin={Boolean(user?.isAdmin)} isLoggedIn={Boolean(user)} />
      <main className="relative z-0 min-w-0 flex-1">{children}</main>
    </div>
  );
}
