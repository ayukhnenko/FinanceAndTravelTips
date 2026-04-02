import AppNav from "@/components/AppNav";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <AppNav />
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
