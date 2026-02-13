import type { Metadata, Viewport } from "next";
import "./globals.css";
import { FavoritesProvider } from "@/contexts/favorites-context";
import { ClientLayout } from "@/components/client-layout";

export const metadata: Metadata = {
  title: "Where2Eat - Discover Recommended Restaurants from Podcasts",
  description: "The advanced system that analyzes food podcasts and brings you the most recommended restaurants",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Where2Eat",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#E63B2E",
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
        <meta name="theme-color" content="#E63B2E" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        {/* Preconnect to Google Fonts */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* Preload Space Grotesk accent font */}
        <link
          rel="preload"
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&display=swap"
          as="style"
        />
      </head>
      <body className="antialiased">
        <ClientLayout>
          <FavoritesProvider>
            {children}
          </FavoritesProvider>
        </ClientLayout>
      </body>
    </html>
  );
}
