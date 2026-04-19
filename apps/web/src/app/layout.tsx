import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "RipPay — Hardware-secured XRPL payments",
  description:
    "Tap. Sign. Settle. RipPay is a self-custody point-of-sale on the XRP Ledger. The private key never leaves the Ledger hardware wallet.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-bg text-ink antialiased">
        <header className="border-b border-border bg-bg">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
            <Link
              href="/"
              className="flex items-center gap-2.5 text-lg font-bold tracking-tight text-ink"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-[11px] font-black text-white tracking-tighter">
                RP
              </span>
              RipPay
            </Link>
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-subtle">
              Tap · Sign · Settle
            </span>
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-6 py-10">{children}</main>
        <footer className="mx-auto max-w-5xl px-6 py-8 text-xs text-tertiary">
          Private key never leaves the hardware wallet. Settlement on XRP Ledger.
        </footer>
      </body>
    </html>
  );
}
