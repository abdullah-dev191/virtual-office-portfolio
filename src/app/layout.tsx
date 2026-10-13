import type { Metadata, Viewport } from "next";
import { Geist, Newsreader } from "next/font/google";
import "./globals.css";
import "./ui.css";
import { profile } from "@/content/profile";

const display = Newsreader({ subsets: ["latin"], variable: "--font-display", display: "swap" });
const body = Geist({ subsets: ["latin"], variable: "--font-body", display: "swap" });

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://example.com";
const description =
  "Walk through an interactive 3D office to explore the work, skills and experience of Muhammad Abdullah, a full stack developer working with React, Next.js, React Native and NestJS.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: `${profile.name} | ${profile.role}`, template: `%s | ${profile.name}` },
  description,
  authors: [{ name: profile.name }],
  openGraph: { type: "website", title: `${profile.name} | ${profile.role}`, description, siteName: profile.name, url: "/" },
  twitter: { card: "summary", title: `${profile.name} | ${profile.role}`, description },
  alternates: { canonical: "/" },
};

export const viewport: Viewport = { themeColor: "#DDEBE3" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
