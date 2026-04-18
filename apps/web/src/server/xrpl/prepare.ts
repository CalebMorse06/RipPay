import type { Session, UnsignedPayment } from "@coldtap/shared";
import { getDefaultFeeDrops, getLedgerOffset, getXrplMode, getXrplWsUrl } from "../config";
import { invoiceIdFor, sessionMemo } from "../invoice";

/**
 * Build the canonical unsigned Payment for a session.
 *
 * When `account` is provided AND we are in real mode, we open an XRPL client
 * and autofill `Sequence` and `LastLedgerSequence` from the network. Otherwise
 * we return a payload without those fields and the client must autofill before
 * signing. The server is authoritative for every other field.
 */
export async function buildUnsignedPayment(
  session: Session,
  account: string | undefined,
): Promise<{ unsignedTx: UnsignedPayment; autofilled: boolean }> {
  const base: UnsignedPayment = {
    TransactionType: "Payment",
    Account: account ?? "",
    Destination: session.destinationAddress,
    Amount: session.amountDrops,
    InvoiceID: invoiceIdFor(session.id),
    Fee: getDefaultFeeDrops(),
    Memos: [sessionMemo(session.id)],
  };

  if (!account || getXrplMode() === "mock") {
    return { unsignedTx: base, autofilled: false };
  }

  const { Client } = await import("xrpl");
  const client = new Client(getXrplWsUrl());
  await client.connect();
  try {
    const accountInfo = await client.request({
      command: "account_info",
      account,
      ledger_index: "current",
    });
    const ledgerCurrent = await client.request({
      command: "ledger_current",
    });
    const sequence = Number(
      (accountInfo.result as { account_data: { Sequence: number } }).account_data.Sequence,
    );
    const currentLedger = Number(
      (ledgerCurrent.result as { ledger_current_index: number }).ledger_current_index,
    );
    return {
      unsignedTx: {
        ...base,
        Sequence: sequence,
        LastLedgerSequence: currentLedger + getLedgerOffset(),
      },
      autofilled: true,
    };
  } finally {
    try {
      await client.disconnect();
    } catch {
      /* ignore */
    }
  }
}
