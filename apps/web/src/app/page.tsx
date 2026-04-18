import { CreateCheckoutForm } from "@/components/CreateCheckoutForm";

export default function LandingPage() {
  return (
    <div className="grid gap-10 md:grid-cols-2">
      <section className="space-y-5">
        <h1 className="text-3xl font-bold leading-[1.05] tracking-tight md:text-5xl">
          Tap to initiate.
          <br />
          <span className="text-accent">Hardware-sign to pay.</span>
        </h1>
        <p className="max-w-md text-subtle leading-relaxed">
          ColdTap is an in-person XRPL checkout. The merchant creates a session. The buyer scans,
          reviews, and approves on a Ledger Nano X. The private key never leaves the hardware wallet.
        </p>
        <ul className="space-y-2.5 text-sm text-subtle">
          <Bullet>Session-based — web and iPhone apps share state only through the backend.</Bullet>
          <Bullet>QR + NFC fallback — either path lands in the same secure signing flow.</Bullet>
          <Bullet>Real XRPL testnet payments, tracked end-to-end.</Bullet>
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
