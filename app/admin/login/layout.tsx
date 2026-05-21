import type { Metadata } from "next";
import { withAppStandLabel } from "@/lib/app-branding";

export const metadata: Metadata = {
  title: withAppStandLabel("Вход в админ-панель"),
};

export default function AdminLoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
