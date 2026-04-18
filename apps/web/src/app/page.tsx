import { CreateCheckoutForm } from "@/components/CreateCheckoutForm";

export default function LandingPage() {
  return (
    <div className="grid gap-10 md:grid-cols-2">
      <section className="space-y-4">
        <h1 className="text-3xl font-semibold leading-tight tracking-tight md:text-4xl">
          Tap to initiate.
          <br />
          <span className="text-accent">Hardware-sign to pay.</span>
        </h1>
        <p className="max-w-md text-subtle">
          ColdTap is an in-person XRPL checkout. The merchant creates a session. The buyer scans, reviews, and approves
          on a Ledger Nano X. The private key never leaves the hardware wallet.
        </p>
        <ul className="space-y-2 text-sm text-subtle">
          <Bullet>Session-based — web and iPhone apps share state only through the backend.</Bullet>
          <Bullet>QR + manual load — no dependency on NFC or direct device talk.</Bullet>
          <Bullet>Real XRPL testnet payments, tracked end-to-end.</Bullet>
        </ul>
      </section>

      <section className="rounded-xl border border-border bg-surface/60 p-6 shadow-lg shadow-black/20 backdrop-blur">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-subtle">
          New checkout
        </h2>
        <CreateCheckoutForm />
      </section>
    </div>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2">
      <span className="mt-1 inline-block h-1.5 w-1.5 flex-none rounded-full bg-accent" aria-hidden />
      <span>{children}</span>
    </li>
  );
}
