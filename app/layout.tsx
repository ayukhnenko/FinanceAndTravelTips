import type { Metadata } from "next";
import "./globals.css";
import { I18nProvider } from "@/components/I18nProvider";

export const metadata: Metadata = {
  title: "Калькуляторы для жизни",
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
        <I18nProvider>{children}</I18nProvider>
      </body>
    </html>
  );
}
