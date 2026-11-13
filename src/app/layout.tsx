import type { Metadata } from "next";
import "./globals.css";
import { config } from "@/lib/config";

export const metadata: Metadata = {
  title: { default: `${config.orgShort} IT Portal`, template: `%s · ${config.orgShort} IT Portal` },
  description: `Internal IT portal for ${config.orgName}`,
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
