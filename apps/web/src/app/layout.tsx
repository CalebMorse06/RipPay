import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "ColdTap — Self-custody XRPL checkout",
  description:
    "Tap to initiate. Hardware-sign to pay. ColdTap is an in-person XRPL checkout where the private key never leaves the Ledger.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-bg text-ink">
        <header className="border-b border-border">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
            <Link href="/" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-accent" aria-hidden />
              ColdTap
            </Link>
            <span className="text-xs uppercase tracking-widest text-subtle">
              XRPL · hardware-signed · in-person
            </span>
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-6 py-10">{children}</main>
        <footer className="mx-auto max-w-5xl px-6 py-8 text-xs text-subtle">
          The web app and the iPhone app never talk directly. They share state through the backend via session IDs.
        </footer>
      </body>
    </html>
  );
}
