import * as Keychain from 'react-native-keychain';
import {Wallet} from 'xrpl';
import type {Payment} from 'xrpl';
import type {XrplUnsignedTransaction} from '@coldtap/shared';
import type {BuyerStep} from '../store/sessionStore';
import type {Signer} from './Signer';

/**
 * Signs locally using an XRPL family seed held in the iOS Keychain. Every call
 * to `prepare()` triggers a Face ID prompt (access control enforces biometrics
 * on read). No BLE, no hardware round-trip — signing is near-instant once the
 * keychain unlocks.
 *
 * The seed never leaves the device: xrpl.Wallet.sign runs in JS memory, and
 * we zero out the in-memory wallet in cleanup().
 */

const SEED_SERVICE = 'com.rippay.wallet.seed';
const SEED_USERNAME = 'xrpl-seed';

export async function saveSeed(seed: string): Promise<string> {
  const trimmed = seed.trim();
  const wallet = Wallet.fromSeed(trimmed); // throws on invalid seed format
  await Keychain.setGenericPassword(SEED_USERNAME, trimmed, {
    service: SEED_SERVICE,
    accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_CURRENT_SET_OR_DEVICE_PASSCODE,
    accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
  return wallet.classicAddress;
}

export async function removeSeed(): Promise<void> {
  await Keychain.resetGenericPassword({service: SEED_SERVICE});
}

export async function hasStoredSeed(): Promise<boolean> {
  try {
    return await Keychain.hasGenericPassword({service: SEED_SERVICE});
  } catch {
    return false;
  }
}

/**
 * Preview the address for the currently-stored seed. Triggers Face ID.
 * Used by SettingsScreen when the user re-visits the "Sign on this phone"
 * section and we want to confirm what's set up.
 */
export async function revealLocalAddress(): Promise<string | null> {
  const creds = await Keychain.getGenericPassword({
    service: SEED_SERVICE,
    authenticationPrompt: {title: 'Show wallet'},
  });
  if (!creds) return null;
  try {
    return Wallet.fromSeed(creds.password).classicAddress;
  } catch {
    return null;
  }
}

export class LocalSigner implements Signer {
  private wallet: Wallet | null = null;

  progressSteps(): BuyerStep[] {
    return ['unlocking_wallet', 'signing', 'submitting', 'validating'];
  }

  async prepare(
    onStep: (s: BuyerStep) => void,
  ): Promise<{address: string; publicKey: string}> {
    onStep('unlocking_wallet');
    const creds = await Keychain.getGenericPassword({
      service: SEED_SERVICE,
      authenticationPrompt: {title: 'Approve payment'},
    });
    if (!creds) {
      throw new Error('No wallet set up on this device.');
    }
    this.wallet = Wallet.fromSeed(creds.password);
    return {
      address: this.wallet.classicAddress,
      publicKey: this.wallet.publicKey,
    };
  }

  async sign(
    unsignedTx: XrplUnsignedTransaction,
    address: string,
    _publicKey: string,
    onStep: (s: BuyerStep) => void,
  ): Promise<string> {
    if (!this.wallet) throw new Error('Wallet not prepared');
    onStep('signing');
    // xrpl.Wallet.sign needs Account set and no stray signature fields.
    const payment: Payment = {
      ...(unsignedTx as unknown as Payment),
      Account: address,
    };
    const {tx_blob} = this.wallet.sign(payment);
    return tx_blob;
  }

  async cleanup(): Promise<void> {
    this.wallet = null;
  }
}
