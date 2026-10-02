import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "新楊平在地知識庫｜新楊平社區大學",
  description: "收錄新屋、楊梅、平鎮的教學與田野成果，以語意檢索串連地方知識，讓每一個回答都能回到來源。",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-Hant">
      <body className="antialiased">{children}</body>
    </html>
  );
}
