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

import {encode, decode} from 'xrpl';
import {XrplUnsignedTransaction} from '@coldtap/shared';

/** Build the signing hex: complete raw tx (without TxnSignature) encoded to hex */
export function encodeForSigning(
  unsignedTx: XrplUnsignedTransaction,
  buyerAddress: string,
  buyerPublicKey: string,
): string {
  const tx: Record<string, unknown> = {
    ...unsignedTx,
    Account: buyerAddress,
    SigningPubKey: buyerPublicKey.toUpperCase(),
    // Flags default: tfFullyCanonicalSig is deprecated in rippled 1.7+, don't set
  };

  // Defensive: remove any leftover signature fields
  delete tx.TxnSignature;

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
