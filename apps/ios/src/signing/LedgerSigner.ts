import type {XrplUnsignedTransaction} from '@coldtap/shared';
import type {BuyerStep} from '../store/sessionStore';
import {
  findFirstLedgerDevice,
  openTransport,
  closeTransport,
} from '../ledger/LedgerTransport';
import {getXrplAccount, signXrplTransaction} from '../ledger/XrplSigner';
import {encodeForSigning, buildSignedBlob} from '../ledger/TransactionBuilder';
import {consumePrewarm} from '../ledger/LedgerSession';
import type {Signer} from './Signer';

/**
 * Wraps the existing BLE + hw-app-xrp flow. Lifts the logic previously inline
 * in ProcessingScreen.tsx — behaviour is identical, including the prewarm
 * fast-path established by CheckoutScreen.
 */
export class LedgerSigner implements Signer {
  private transport: any = null;

  progressSteps(): BuyerStep[] {
    return [
      'scanning_ledger',
      'fetching_account',
      'building_tx',
      'awaiting_confirmation',
      'submitting',
      'validating',
    ];
  }

  async prepare(
    onStep: (s: BuyerStep) => void,
  ): Promise<{address: string; publicKey: string}> {
    const prewarm = consumePrewarm();
    if (prewarm.transport && prewarm.account) {
      this.transport = prewarm.transport;
      return {
        address: prewarm.account.address,
        publicKey: prewarm.account.publicKey,
      };
    }

    onStep('scanning_ledger');
    const device = await findFirstLedgerDevice();

    onStep('connecting_ledger');
    this.transport = await openTransport(device);

    onStep('fetching_account');
    const account = await getXrplAccount(this.transport);
    return {address: account.address, publicKey: account.publicKey};
  }

  async sign(
    unsignedTx: XrplUnsignedTransaction,
    address: string,
    publicKey: string,
    onStep: (s: BuyerStep) => void,
  ): Promise<string> {
    if (!this.transport) throw new Error('Ledger transport not ready');
    const txHex = encodeForSigning(unsignedTx, address, publicKey);

    onStep('awaiting_confirmation');
    const signatureHex = await signXrplTransaction(this.transport, txHex);

    onStep('signing');
    return buildSignedBlob(unsignedTx, address, publicKey, signatureHex);
  }

  async cleanup(): Promise<void> {
    if (this.transport) {
      await closeTransport(this.transport).catch(() => {});
      this.transport = null;
    }
  }
}
