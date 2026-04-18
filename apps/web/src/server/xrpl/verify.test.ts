import { beforeAll, describe, expect, it } from "vitest";
import { Wallet, encode } from "xrpl";
import type { Session } from "@coldtap/shared";
import { invoiceIdFor, sessionMemo } from "../invoice";
import { verifySignedBlob } from "./verify";

/**
 * End-to-end verify test: build a real unsigned XRPL Payment, sign it with an
 * ephemeral wallet, hand the resulting blob to verifySignedBlob, and assert
 * that tampering with any of the bound fields causes rejection.
 */

const DESTINATION = "rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe";
const AMOUNT_DROPS = "2500000";
const SESSION_ID = "s_verifyTest";

function baseSession(): Session {
  const now = new Date().toISOString();
  return {
    id: SESSION_ID,
    merchantName: "Test",
    itemName: "Item",
    amountDrops: AMOUNT_DROPS,
    amountDisplay: "2.5 XRP",
    currency: "XRP",
    destinationAddress: DESTINATION,
    status: "AWAITING_SIGNATURE",
    network: "mock",
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    createdAt: now,
    updatedAt: now,
  };
}

let wallet: Wallet;
let signedBlob: string;

beforeAll(() => {
  wallet = Wallet.generate();
  // Construct the exact kind of payload buildUnsignedPayment produces.
  const tx = {
    TransactionType: "Payment" as const,
    Account: wallet.classicAddress,
    Destination: DESTINATION,
    Amount: AMOUNT_DROPS,
    InvoiceID: invoiceIdFor(SESSION_ID),
    Fee: "12",
    Sequence: 1,
    LastLedgerSequence: 1_000_000,
    Memos: [sessionMemo(SESSION_ID)],
    SigningPubKey: wallet.publicKey,
  };
  // Sign to produce a real hex blob.
  const { tx_blob } = wallet.sign(tx);
  signedBlob = tx_blob;
});

describe("verifySignedBlob", () => {
  it("accepts a signed blob whose fields match the session", async () => {
    const session = baseSession();
    const result = await verifySignedBlob(signedBlob, session);
    expect(result.ok).toBe(true);
    expect(result.decoded?.TransactionType).toBe("Payment");
  });

  it("rejects when Destination differs from the session", async () => {
    const session = { ...baseSession(), destinationAddress: "rDifferentAddressAbcDefGhiJklMnoPqr" };
    const result = await verifySignedBlob(signedBlob, session);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/Destination mismatch/);
  });

  it("rejects when Amount differs from the session", async () => {
    const session = { ...baseSession(), amountDrops: "999999" };
    const result = await verifySignedBlob(signedBlob, session);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/Amount mismatch/);
  });

  it("rejects when the session id (and thus InvoiceID) differs", async () => {
    const session = { ...baseSession(), id: "s_differentSession" };
    const result = await verifySignedBlob(signedBlob, session);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/InvoiceID mismatch/);
  });

  it("rejects an unsigned transaction", async () => {
    // Encode the same payload without signing — no TxnSignature.
    const unsignedHex = encode({
      TransactionType: "Payment",
      Account: wallet.classicAddress,
      Destination: DESTINATION,
      Amount: AMOUNT_DROPS,
      InvoiceID: invoiceIdFor(SESSION_ID),
      Fee: "12",
      Sequence: 1,
      LastLedgerSequence: 1_000_000,
      SigningPubKey: wallet.publicKey,
    });
    const result = await verifySignedBlob(unsignedHex, baseSession());
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/not signed/);
  });

  it("rejects a structurally malformed blob", async () => {
    const result = await verifySignedBlob("NOTHEX", baseSession());
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/decode failed/);
  });
});
