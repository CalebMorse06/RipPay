import { CreateCheckoutForm } from "@/components/CreateCheckoutForm";

export default function LandingPage() {
  return (
    <div className="grid gap-10 md:grid-cols-2">
      <section className="space-y-6">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent-dim px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            XRP Ledger · Testnet
          </div>
          <h1 className="text-3xl font-bold leading-[1.05] tracking-tight md:text-5xl">
            Your hardware wallet.
            <br />
            <span className="text-accent">Your payment terminal.</span>
          </h1>
        </div>
        <p className="max-w-md text-subtle leading-relaxed">
          RipPay brings self-custody to the point of sale. Create a session, tap the
          buyer's phone or show a QR code, and watch them approve on their Ledger Nano X.
          The private key never leaves the device. Settlement on XRPL in seconds.
        </p>
        <ul className="space-y-3 text-sm text-subtle">
          <Bullet>
            <strong className="text-ink">Hardware-first</strong> — private key stays on
            the Ledger, always.
          </Bullet>
          <Bullet>
            <strong className="text-ink">NFC + QR</strong> — two tap paths, one secure
            signing flow.
          </Bullet>
          <Bullet>
            <strong className="text-ink">On-chain proof</strong> — every payment settles
            on XRPL and is publicly verifiable.
          </Bullet>
        </ul>
      </section>

      <section className="rounded-2xl border border-border bg-surface p-6">
        <h2 className="mb-5 text-[11px] font-semibold uppercase tracking-[0.14em] text-subtle">
          New checkout
        </h2>
        <CreateCheckoutForm />
      </section>
    </div>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <span className="mt-[0.45em] inline-block h-1.5 w-1.5 flex-none rounded-full bg-accent" aria-hidden />
      <span>{children}</span>
    </li>
  );
}
