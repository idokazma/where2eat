import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Where2Eat Admin Dashboard",
  description: "Admin panel for Where2Eat restaurant management system",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
