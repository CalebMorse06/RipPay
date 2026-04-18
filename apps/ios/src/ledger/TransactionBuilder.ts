/**
 * XRPL transaction construction and signature injection.
 *
 * Uses xrpl.js for canonical serialization.
 * The encoded hex is passed directly to the Ledger for signing.
 *
 * Phase 3: Uncomment xrpl imports once dependencies are installed.
 */

// import { encode, decode } from 'xrpl';

export interface PaymentTxParams {
  fromAddress: string;
  toAddress: string;
  amountDrops: string;
  memo?: string;
  sequence: number;
  fee: string;
  lastLedgerSequence: number;
}

export function buildPaymentTxHex(params: PaymentTxParams): string {
  // TODO Phase 3: Uncomment and use xrpl encode
  // const tx: any = {
  //   TransactionType: 'Payment',
  //   Account: params.fromAddress,
  //   Amount: params.amountDrops,
  //   Destination: params.toAddress,
  //   Sequence: params.sequence,
  //   Fee: params.fee,
  //   LastLedgerSequence: params.lastLedgerSequence,
  //   SigningPubKey: '',
  // };
  // if (params.memo) {
  //   tx.Memos = [{
  //     Memo: {
  //       MemoData: Buffer.from(params.memo, 'utf8').toString('hex').toUpperCase(),
  //       MemoType: Buffer.from('text/plain', 'utf8').toString('hex').toUpperCase(),
  //     },
  //   }];
  // }
  // return encode(tx);
  throw new Error('TransactionBuilder: xrpl.js not yet wired. See Phase 3.');
}

export function injectSignature(
  encodedTxHex: string,
  signature: string,
  publicKey: string,
): string {
  // TODO Phase 3: Uncomment
  // const decoded = decode(encodedTxHex) as any;
  // decoded.TxnSignature = signature.toUpperCase();
  // decoded.SigningPubKey = publicKey.toUpperCase();
  // return encode(decoded);
  void encodedTxHex;
  void signature;
  void publicKey;
  throw new Error('TransactionBuilder: xrpl.js not yet wired. See Phase 3.');
}
