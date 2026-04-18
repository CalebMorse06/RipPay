/**
 * XRP-specific Ledger operations.
 *
 * Derivation path: 44'/144'/0'/0/0
 *   - 44' = BIP44 purpose
 *   - 144' = XRP coin type (SLIP-44)
 *   - 0' = account
 *   - 0/0 = external chain, first address
 *
 * This is the standard path used by Ledger Live and all major XRP wallets.
 * Keep it fixed for hackathon — no multi-account complexity needed.
 *
 * API notes (from hw-app-xrp 6.x source):
 *   getAddress → { publicKey: string, address: string }
 *   signTransaction → returns raw hex string (not { signature } object)
 */

import Xrp from '@ledgerhq/hw-app-xrp';
import {XRPL_DERIVATION_PATH} from '../constants';

export interface XrplAccountInfo {
  address: string;
  publicKey: string;  // hex, uncompressed or compressed — use as-is for SigningPubKey
}

/**
 * Read the active XRP address and public key from the connected Ledger.
 * The XRP app must be open on the Ledger.
 *
 * @param transport - BleTransport from LedgerTransport.openTransport
 */
export async function getXrplAccount(transport: any): Promise<XrplAccountInfo> {
  try {
    const xrp = new Xrp(transport);
    const result = await xrp.getAddress(XRPL_DERIVATION_PATH);
    return {
      address: result.address,
      publicKey: result.publicKey.toUpperCase(),
    };
  } catch (err: any) {
    throw new Error(humanizeLedgerError(err));
  }
}

/**
 * Ask the Ledger to sign a serialized XRP transaction.
 * The user must physically approve on the Ledger hardware.
 *
 * @param transport - BleTransport from LedgerTransport.openTransport
 * @param rawTxHex  - Binary-codec-encoded unsigned transaction hex
 *                    (from TransactionBuilder.encodeForSigning)
 * @returns DER-encoded signature hex string (inject as TxnSignature)
 */
export async function signXrplTransaction(
  transport: any,
  rawTxHex: string,
): Promise<string> {
  try {
    const xrp = new Xrp(transport);
    // signTransaction returns raw hex string in hw-app-xrp 6.x
    const signatureHex = await xrp.signTransaction(XRPL_DERIVATION_PATH, rawTxHex);
    return (signatureHex as string).toUpperCase();
  } catch (err: any) {
    throw new Error(humanizeLedgerError(err));
  }
}

function humanizeLedgerError(err: any): string {
  const msg: string = err?.message ?? String(err);

  if (msg.includes('0x6e00') || msg.includes('6e00'))
    return 'XRP app is not open on your Ledger. Please open it and try again.';
  if (msg.includes('0x6985') || msg.includes('6985') || msg.includes('deny') || msg.includes('Denied'))
    return 'Transaction rejected on Ledger.';
  if (msg.includes('0x6986') || msg.includes('locked'))
    return 'Ledger is locked. Please unlock it and open the XRP app.';
  if (msg.includes('0x5515') || msg.includes('NotOpenError'))
    return 'Ledger disconnected during signing. Please try again.';
  if (msg.includes('TransportError') || msg.includes('disconnected'))
    return 'Lost connection to Ledger. Please keep the app open and try again.';

  return msg || 'Ledger signing failed';
}
