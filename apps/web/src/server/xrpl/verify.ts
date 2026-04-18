import type { Session } from "@coldtap/shared";
import { invoiceIdFor } from "../invoice";

export interface VerifyResult {
  ok: boolean;
  /** Non-null when ok=false. Use for reject reason + failure logs. */
  reason?: string;
  /** The decoded transaction object. Null when the blob is structurally unparseable. */
  decoded?: DecodedPayment;
}

export interface DecodedPayment {
  TransactionType: string;
  Account?: string;
  Destination?: string;
  Amount?: string | { value: string; currency: string; issuer?: string };
  InvoiceID?: string;
  Fee?: string;
  Sequence?: number;
  LastLedgerSequence?: number;
  SigningPubKey?: string;
  TxnSignature?: string;
  // Memos are not verified by the backend — InvoiceID is the trust anchor.
  Memos?: unknown;
}

/**
 * Decode a hex-encoded signed XRPL transaction blob and confirm that its
 * destination / amount / invoice match the session. Called by /submit-signed
 * before anything is forwarded to the XRPL network — the backend is the
 * merchant trust anchor and we do not forward tx blobs we have not inspected.
 */
export async function verifySignedBlob(
  txBlob: string,
  session: Session,
): Promise<VerifyResult> {
  let decoded: DecodedPayment;
  try {
    const { decode } = await import("xrpl");
    decoded = decode(txBlob) as unknown as DecodedPayment;
  } catch (err) {
    return {
      ok: false,
      reason: `blob decode failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  if (decoded.TransactionType !== "Payment") {
    return {
      ok: false,
      reason: `expected Payment transaction, got ${decoded.TransactionType}`,
      decoded,
    };
  }
  if (!decoded.TxnSignature || !decoded.SigningPubKey) {
    return { ok: false, reason: "transaction is not signed", decoded };
  }
  if (decoded.Destination !== session.destinationAddress) {
    return {
      ok: false,
      reason: `Destination mismatch: tx ${decoded.Destination} vs session ${session.destinationAddress}`,
      decoded,
    };
  }

  // Amount: for an XRP payment the decoded value is a drops-string. For an IOU
  // it is an object with {value, currency, issuer}. ColdTap is XRP-only today.
  if (typeof decoded.Amount !== "string") {
    return {
      ok: false,
      reason: "Amount must be XRP drops (string), not an IOU object",
      decoded,
    };
  }
  if (decoded.Amount !== session.amountDrops) {
    return {
      ok: false,
      reason: `Amount mismatch: tx ${decoded.Amount} drops vs session ${session.amountDrops} drops`,
      decoded,
    };
  }

  const expectedInvoice = invoiceIdFor(session.id);
  if (!decoded.InvoiceID || decoded.InvoiceID.toUpperCase() !== expectedInvoice) {
    return {
      ok: false,
      reason: `InvoiceID mismatch (expected ${expectedInvoice}, got ${decoded.InvoiceID ?? "<missing>"})`,
      decoded,
    };
  }

  return { ok: true, decoded };
}

/**
 * Compute the transaction hash of a signed blob without hitting the network.
 * Used so the backend can record txHash on SUBMITTED before the network ack returns.
 */
export async function hashSignedBlob(txBlob: string): Promise<string> {
  const { hashes } = await import("xrpl");
  return hashes.hashSignedTx(txBlob);
}
