import type { Metadata } from "next";
import type { ReactNode } from "react";

import { AuthHashHandler } from "@/components/auth/auth-hash-handler";
import { PwaManager } from "@/components/pwa/pwa-manager";

import "./globals.css";

export const metadata: Metadata = {
  title: "DIINI AI Real Estate",
  description: "AI real estate sales and reception system",
  applicationName: "DIINI AI Real Estate",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "DIINI AI" },
  icons: {
    icon: [
      { url: "/icons/favicon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/diini-192.png", sizes: "192x192", type: "image/png" },
    ],
    shortcut: "/icons/favicon-32.png",
    apple: [{ url: "/icons/diini-apple-180.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport = { themeColor: "#08111f", width: "device-width", initialScale: 1, viewportFit: "cover" };

type RootLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-950 antialiased">
        <AuthHashHandler />
        <PwaManager />
        {children}
      </body>
    </html>
  );
}

