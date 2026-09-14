import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE = "https://agentshield-lyart.vercel.app";
const DESCRIPTION =
  "A Strands agent that reviews every transaction your trading agents propose, blocks drains and honeypots, and pages you only for judgment calls.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: {
    default: "AgentShield | Stop the agent before it signs the drain",
    template: "%s | AgentShield",
  },
  description: DESCRIPTION,
  applicationName: "AgentShield",
  keywords: [
    "AgentShield",
    "AI agent security",
    "trading agents",
    "prompt injection",
    "wallet drainer",
    "honeypot",
    "Strands Agents",
    "Amazon Bedrock",
    "Base",
    "x402",
  ],
  authors: [{ name: "NOKARA Labs" }],
  creator: "NOKARA Labs",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: SITE,
    siteName: "AgentShield",
    title: "AgentShield",
    description: "Stop the agent before it signs the drain. Pre-signing review for autonomous trading agents.",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "AgentShield",
    description: "Stop the agent before it signs the drain. Pre-signing review for autonomous trading agents.",
  },
  appleWebApp: {
    capable: true,
    title: "AgentShield",
    statusBarStyle: "black-translucent",
  },
  formatDetection: { telephone: false, address: false, email: false },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0b",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="bg-[#0a0a0b]">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>{children}</body>
    </html>
  );
}
