import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { StatusBar } from "@/components/StatusBar";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Merger Arb Tracker",
  description: "Track spreads, annualized returns, and downside on announced all-cash M&A deals.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <header className="sticky top-0 z-20 border-b border-border bg-bg/80 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-[88rem] items-center px-4">
            <Link href="/" className="font-mono text-[16px] font-bold tracking-[0.16em]">
              MERGER ARB TRACKER
            </Link>
          </div>
        </header>
        {/* Bottom padding keeps content clear of the fixed status bar. */}
        <main className="mx-auto w-full max-w-[88rem] flex-1 px-4 pb-20 pt-8">{children}</main>
        <StatusBar />
      </body>
    </html>
  );
}
