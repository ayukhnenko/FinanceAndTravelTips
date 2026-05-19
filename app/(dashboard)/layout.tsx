import AppNav from "@/components/AppNav";
import { VisitTracker } from "@/components/VisitBadge";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <VisitTracker />
      <AppNav />
      <main className="relative z-0 min-w-0 flex-1">{children}</main>
    </div>
  );
}
