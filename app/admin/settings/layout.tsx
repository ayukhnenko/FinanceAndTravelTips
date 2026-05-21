import type { Metadata } from "next";
import { withAppStandLabel } from "@/lib/app-branding";

export const metadata: Metadata = {
  title: withAppStandLabel("Настройки администратора"),
};

export default function AdminSettingsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
