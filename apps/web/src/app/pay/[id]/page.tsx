import Link from "next/link";
import { notFound } from "next/navigation";
import { sessionStore } from "@/server/store";
import { LedgerPay } from "@/components/LedgerPay";

export const dynamic = "force-dynamic";

/**
 * Web buyer page — self-custody XRPL checkout in a browser.
 *
 * Flow:
 *   1. Buyer lands here (via QR scan, NFC sticker tap, or manual URL entry).
 *   2. Browser pairs to a Ledger Nano X over WebBluetooth.
 *   3. Browser reads the buyer's XRP account from the device.
 *   4. POST /prepare with that account → canonical unsigned Payment.
 *   5. Ledger signs.
 *   6. POST /submit-signed with the signed blob.
 *   7. Poll until PAID / FAILED / EXPIRED.
 *
 * This page requires Chrome on Android (WebBluetooth + Ledger transport).
 * iOS Safari cannot pair with Bluetooth devices from a web page; iPhone
 * buyers use the native iOS app path documented in apps/ios/README.md.
 */
export default async function PayPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await sessionStore.get(id);
  if (!session) notFound();

  return (
    <div className="space-y-6">
      <LedgerPay initial={session} />
      <div className="text-center text-xs text-subtle">
        <Link href={`/s/${session.id}`} className="hover:text-ink">
          Use the iPhone app instead →
        </Link>
      </div>
    </div>
  );
}
