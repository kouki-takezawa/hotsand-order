import type { Metadata } from "next";
import { Noto_Sans_JP } from "next/font/google";
import { getSettings } from "@/lib/data";
import "./globals.css";

const notoSansJP = Noto_Sans_JP({
  variable: "--font-noto-sans-jp",
  subsets: ["latin"],
  weight: ["400", "500", "700", "900"],
});

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  return {
    title: `${settings.restaurantName} | QR注文システム`,
    description: "QRコードから注文できる、飲食店向けの注文・厨房管理システム",
  };
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ja" className={`${notoSansJP.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
