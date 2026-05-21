import type { Metadata } from "next";
import { withAdminAppStandLabel } from "@/lib/app-branding";

export const metadata: Metadata = {
  title: withAdminAppStandLabel("Настройки администратора"),
};

export default function AdminSettingsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
