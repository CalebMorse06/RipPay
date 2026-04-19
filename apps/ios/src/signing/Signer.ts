import type {XrplUnsignedTransaction} from '@coldtap/shared';
import type {BuyerStep} from '../store/sessionStore';

/**
 * Signing backend. Two implementations today:
 *   - LedgerSigner: BLE + hw-app-xrp (marquee demo, zero behaviour change)
 *   - LocalSigner : xrpl.Wallet from Keychain-stored seed behind Face ID
 *
 * ProcessingScreen drives the flow; the signer reports progress via `onStep`
 * so the UI can render mode-specific step labels and dots.
 */
export interface Signer {
  /** Progress-dot steps to render for this signer, in user-visible order. */
  progressSteps(): BuyerStep[];

  /**
   * Acquire the signing identity.
   *   Ledger: scan → connect → getAddress (or consume prewarm).
   *   Local : Face ID unlock → Wallet.fromSeed.
   */
  prepare(onStep: (s: BuyerStep) => void): Promise<{address: string; publicKey: string}>;

  /**
   * Sign the unsigned transaction. Returns the signed tx_blob hex ready for
   * `submitSignedBlob`. Ledger path runs encode→sign-over-BLE→buildSignedBlob;
   * local path calls xrpl.Wallet.sign directly.
   */
  sign(
    unsignedTx: XrplUnsignedTransaction,
    address: string,
    publicKey: string,
    onStep: (s: BuyerStep) => void,
  ): Promise<string>;

  /** Release resources. Ledger: closeTransport. Local: clears in-memory wallet. */
  cleanup(): Promise<void>;
}
