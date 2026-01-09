import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { FavoritesProvider } from "@/contexts/favorites-context";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Where2Eat - גלו מסעדות מומלצות מפודקאסטים",
  description: "המערכת המתקדמת שמנתחת פודקאסטים על אוכל ומביאה לכם את המסעדות הכי מומלצות בארץ",
  manifest: "/manifest.json",
  themeColor: "#F97066",
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 5,
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Where2Eat",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="he" dir="rtl">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#F97066" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased font-hebrew`}
      >
        <FavoritesProvider>
          {children}
        </FavoritesProvider>
      </body>
    </html>
  );
}
