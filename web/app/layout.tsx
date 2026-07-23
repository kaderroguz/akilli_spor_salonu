import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Akıllı Spor Salonu",
  description: "Next.js tabanli akilli spor salonu web arayuzu",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
