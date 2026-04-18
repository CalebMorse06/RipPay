import Link from "next/link";
import { notFound } from "next/navigation";
import { sessionStore } from "@/server/store";
import { StatusBadge } from "@/components/StatusBadge";

export const dynamic = "force-dynamic";

/**
 * Buyer launch page.
 *
 * This is the target of the QR code / universal link. On an iPhone with the
 * ColdTap app installed the associated domain's universal-link rules will
 * intercept the URL and open the native app before this page renders. Without
 * the app (or in a browser on desktop) the page shows a summary of the
 * checkout plus the raw session id for manual entry into the iPhone app.
 */
export default async function BuyerLaunchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = sessionStore.get(id);
  if (!session) notFound();

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Pay with ColdTap</h1>
        <StatusBadge status={session.status} />
      </div>

      <div className="rounded-xl border border-border bg-surface/60 p-5">
        <div className="flex items-baseline justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-widest text-subtle">Merchant</div>
            <div className="text-lg font-medium">{session.merchantName}</div>
          </div>
          <div className="text-right">
            <div className="text-xs uppercase tracking-widest text-subtle">Amount</div>
            <div className="text-2xl font-semibold tracking-tight">{session.amountDisplay}</div>
          </div>
        </div>
        <div className="mt-3 text-sm text-subtle">{session.itemName}</div>
      </div>

      <div className="rounded-xl border border-dashed border-border bg-surface/30 p-4 text-sm leading-relaxed text-subtle">
        <p className="mb-2">
          Open this page on the <strong className="text-ink">ColdTap iPhone app</strong> to review
          and approve this payment on your Ledger Nano X.
        </p>
        <p>
          If the app didn&apos;t open automatically, open it and enter the session id below.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-surface/60 p-4">
        <div className="mb-1 text-xs uppercase tracking-widest text-subtle">Session id</div>
        <div className="break-all font-mono text-sm">{session.id}</div>
      </div>

      <div className="text-center text-xs text-subtle">
        <Link href="/" className="hover:text-ink">
          ColdTap — self-custody XRPL checkout
        </Link>
      </div>
    </div>
  );
}
