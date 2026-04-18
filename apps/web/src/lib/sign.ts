"use client";

import type { UnsignedPayment } from "@coldtap/shared";

/**
 * XRPL transaction serialization helpers for the browser-side Ledger flow.
 *
 * Workflow:
 *   1. `/prepare` gives us an `UnsignedPayment` JSON.
 *   2. Merge in `SigningPubKey` read from the Ledger device.
 *   3. Serialize with `xrpl.encode` to get the hex the Ledger will sign.
 *   4. Hand that hex to the Ledger; it returns a DER/ed25519 signature.
 *   5. Merge the signature in as `TxnSignature`, re-serialize, post to
 *      `/submit-signed`.
 *
 * All xrpl imports are dynamic so the module stays compatible with Next.js SSR.
 */

type XrplTxJson = UnsignedPayment & {
  SigningPubKey?: string;
  TxnSignature?: string;
};

type XrplEncode = (tx: unknown) => string;

async function xrplEncode(): Promise<XrplEncode> {
  const xrpl = await import("xrpl");
  return xrpl.encode as unknown as XrplEncode;
}

/** Produces the hex blob the Ledger XRP app will sign. */
export async function buildUnsignedHex(
  unsignedTx: UnsignedPayment,
  signingPubKey: string,
): Promise<{ withPubKey: XrplTxJson; hex: string }> {
  const encode = await xrplEncode();
  const withPubKey: XrplTxJson = {
    ...unsignedTx,
    SigningPubKey: signingPubKey,
  };
  return { withPubKey, hex: encode(withPubKey) };
}

/** Produces the final signed hex blob ready for POST /submit-signed. */
export async function buildSignedHex(
  withPubKey: XrplTxJson,
  signatureHex: string,
): Promise<string> {
  const encode = await xrplEncode();
  const signed: XrplTxJson = { ...withPubKey, TxnSignature: signatureHex };
  return encode(signed);
}
