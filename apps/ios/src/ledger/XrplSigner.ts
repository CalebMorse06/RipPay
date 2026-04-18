/**
 * Phase 3: Replace stubs with real hw-app-xrp calls.
 *
 * Real implementation:
 *   import XrpApp from '@ledgerhq/hw-app-xrp';
 *   const xrp = new XrpApp(transport);
 *   const { address, publicKey } = await xrp.getAddress("44'/144'/0'/0/0");
 *   const { signature } = await xrp.signTransaction("44'/144'/0'/0/0", txHex);
 */

import {XRPL_DERIVATION_PATH} from '../constants';

export interface XrplAccountInfo {
  address: string;
  publicKey: string;
}

export async function getXrplAddress(transport: unknown): Promise<XrplAccountInfo> {
  // TODO Phase 3:
  //   const xrp = new XrpApp(transport);
  //   const result = await xrp.getAddress(XRPL_DERIVATION_PATH);
  //   return { address: result.address, publicKey: result.publicKey };
  void transport;
  void XRPL_DERIVATION_PATH;
  throw new Error('XrplSigner: Ledger not yet implemented. See Phase 3.');
}

export async function signTransaction(
  transport: unknown,
  encodedTxHex: string,
): Promise<string> {
  // TODO Phase 3:
  //   const xrp = new XrpApp(transport);
  //   const { signature } = await xrp.signTransaction(XRPL_DERIVATION_PATH, encodedTxHex);
  //   return signature;
  void transport;
  void encodedTxHex;
  throw new Error('XrplSigner: Ledger not yet implemented. See Phase 3.');
}
