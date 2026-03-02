// Root layout — wraps all pages with fonts, global styles, and navigation

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import Navbar from "@/app/components/navbar";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SpawnAI — Create AI Agents in Seconds",
  description:
    "Describe an AI agent in plain English. Get a working, shareable agent live in under 60 seconds. No code, no API keys.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://spawnai.vercel.app"),
  openGraph: {
    title: "SpawnAI — Create AI Agents in Seconds",
    description:
      "Describe an AI agent in plain English. Get a working, shareable agent live in under 60 seconds.",
    siteName: "SpawnAI",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "SpawnAI — Create AI Agents in Seconds",
    description:
      "Describe an AI agent in plain English. Get a working, shareable agent live in under 60 seconds.",
    creator: "@Skunkworks0x",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Navbar />
        {children}
        <Analytics />
      </body>
    </html>
  );
}
