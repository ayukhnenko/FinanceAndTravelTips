import type { Metadata } from "next";
import { withAdminAppStandLabel } from "@/lib/app-branding";

export const metadata: Metadata = {
  title: withAdminAppStandLabel("Кейсы на анализ"),
};

export default function AdminCasesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
