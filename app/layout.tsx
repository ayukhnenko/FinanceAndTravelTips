import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Финансовая логика жизни",
  description:
    "Финансовая логика жизни — калькуляторы кредита, досрочного погашения и сложных процентов",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body className="antialiased">{children}</body>
    </html>
  );
}
