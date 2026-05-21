import type { Metadata } from "next";
import { withAdminAppStandLabel } from "@/lib/app-branding";

export const metadata: Metadata = {
  title: withAdminAppStandLabel("Вход в админ-панель"),
};

export default function AdminLoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
