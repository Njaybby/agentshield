import type { Metadata } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const instrument = Instrument_Serif({
  variable: "--font-instrument",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "AgentShield | NOKARA Labs",
  description:
    "Pre-trade firewall for autonomous trading agents on Base: a Strands agent on Bedrock AgentCore that blocks prompt-injection drains and honeypots before the agent signs.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="bg-[#0a0a0a]">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${instrument.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
