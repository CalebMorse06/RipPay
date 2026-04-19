/**
 * XRPL transaction construction for the Ledger signing flow.
 *
 * Flow:
 *   1. Backend provides unsignedTransaction (destination, amount, sequence, fee, etc.)
 *   2. iOS injects Account + SigningPubKey from Ledger
 *   3. encode(tx) → hex for Ledger to sign
 *   4. Ledger returns DER signature hex
 *   5. Inject TxnSignature + re-encode → signed blob for submission
 *
 * Backend controls: Destination, Amount, Sequence, Fee, LastLedgerSequence, Memos
 * iOS controls: Account, SigningPubKey, TxnSignature
 *
 * Uses encode/decode from xrpl package (re-exports ripple-binary-codec).
 * If xrpl import fails, use: import { encode, decode } from 'ripple-binary-codec'
 */

import {encode, decode, isValidClassicAddress} from 'xrpl';
import {XrplUnsignedTransaction} from '@coldtap/shared';

function assertValidAddress(role: 'Account' | 'Destination', addr: unknown): void {
  if (typeof addr !== 'string' || !isValidClassicAddress(addr)) {
    const shown = typeof addr === 'string' ? addr : String(addr);
    throw new Error(
      role === 'Destination'
        ? `Merchant's XRPL address is invalid (${shown}). Ask them to re-enter it on the checkout form.`
        : `Your Ledger returned an invalid XRPL address (${shown}). Re-open the XRP app on the Ledger and try again.`,
    );
  }
}

/** Build the signing hex: complete raw tx (without TxnSignature) encoded to hex */
export function encodeForSigning(
  unsignedTx: XrplUnsignedTransaction,
  buyerAddress: string,
  buyerPublicKey: string,
): string {
  const tx: Record<string, unknown> = {
    ...unsignedTx,
    Account: buyerAddress,
    SigningPubKey: buyerPublicKey.toUpperCase(), // XRPL canonical format is uppercase hex.
    // Flags default: tfFullyCanonicalSig is deprecated in rippled 1.7+, don't set
  };

  // Defensive: remove any leftover signature fields
  delete tx.TxnSignature;

  assertValidAddress('Account', tx.Account);
  assertValidAddress('Destination', tx.Destination);

  const hex = encode(tx as any);
  __DEV__ && console.log('[TransactionBuilder] encodeForSigning:', JSON.stringify(tx, null, 2));
  return hex;
}

/** Inject signature into the transaction and encode final signed blob for submission */
export function buildSignedBlob(
  unsignedTx: XrplUnsignedTransaction,
  buyerAddress: string,
  buyerPublicKey: string,
  signatureHex: string,
): string {
  const signedTx: Record<string, unknown> = {
    ...unsignedTx,
    Account: buyerAddress,
    SigningPubKey: buyerPublicKey.toUpperCase(),
    TxnSignature: signatureHex.toUpperCase(),
  };

  assertValidAddress('Account', signedTx.Account);
  assertValidAddress('Destination', signedTx.Destination);

  const blob = encode(signedTx as any);
  __DEV__ && console.log('[TransactionBuilder] buildSignedBlob txHash preview available after submission');
  return blob;
}

/**
 * Build a minimal unsigned transaction from session data.
 * Used when backend /prepare endpoint is not yet available.
 * Caller must provide networkParams from fetchNetworkParams().
 */
export function buildUnsignedTxFromSession(params: {
  destinationAddress: string;
  amountDrops: string;
  memo?: string;
  sequence: number;
  fee: string;
  lastLedgerSequence: number;
}): XrplUnsignedTransaction {
  const tx: XrplUnsignedTransaction = {
    TransactionType: 'Payment',
    Destination: params.destinationAddress,
    Amount: params.amountDrops,
    Sequence: params.sequence,
    Fee: params.fee,
    LastLedgerSequence: params.lastLedgerSequence,
    Flags: 0,
  };

  if (params.memo) {
    tx.Memos = [
      {
        Memo: {
          MemoData: Buffer.from(params.memo, 'utf8').toString('hex').toUpperCase(),
          MemoType: Buffer.from('text/plain', 'utf8').toString('hex').toUpperCase(),
        },
      },
    ];
  }

  return tx;
}
