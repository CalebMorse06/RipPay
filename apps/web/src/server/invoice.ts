import { createHash } from "node:crypto";

/**
 * Session ↔ InvoiceID / Memo encoding.
 *
 * The iOS app signs a transaction whose `InvoiceID` is derived from the session id.
 * When the signed blob comes back to /submit-signed, the backend recomputes the
 * expected InvoiceID and rejects the submission if it does not match — this is
 * what binds a signed blob to a specific session and stops replay into another.
 *
 * We also include a human-readable Memo carrying the raw session id for
 * debuggability on an XRPL explorer. The backend does not trust the memo for
 * identity — that's what InvoiceID is for — but it's useful for operators.
 */

const MEMO_TYPE = "coldtap/session";
const MEMO_FORMAT = "text/plain";

export function invoiceIdFor(sessionId: string): string {
  return createHash("sha256").update(sessionId, "utf8").digest("hex").toUpperCase();
}

export function sessionMemo(sessionId: string): {
  Memo: { MemoType: string; MemoData: string; MemoFormat: string };
} {
  return {
    Memo: {
      MemoType: toHex(MEMO_TYPE),
      MemoData: toHex(sessionId),
      MemoFormat: toHex(MEMO_FORMAT),
    },
  };
}

export function toHex(s: string): string {
  return Buffer.from(s, "utf8").toString("hex").toUpperCase();
}

export function fromHex(h: string): string {
  return Buffer.from(h, "hex").toString("utf8");
}
