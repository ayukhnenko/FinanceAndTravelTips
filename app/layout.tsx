import type { Metadata } from "next";
import "./globals.css";
import DynamicFavicon from "@/components/DynamicFavicon";
import { I18nProvider } from "@/components/I18nProvider";
import { withAppStandLabel } from "@/lib/app-branding";
import { resolveSiteUrl } from "@/lib/site-url";

const siteUrl = resolveSiteUrl();

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: withAppStandLabel("Калькуляторы для жизни"),
  description: "Финансовые сервисы для жизни",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body className="antialiased">
        <DynamicFavicon />
        <I18nProvider>{children}</I18nProvider>
      </body>
    </html>
  );
}
