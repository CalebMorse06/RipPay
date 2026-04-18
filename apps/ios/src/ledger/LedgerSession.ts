/**
 * Module-level singleton for the pre-warmed Ledger transport + account.
 *
 * Why a singleton (not Zustand)?
 * React Navigation native-stack keeps the Checkout screen mounted while
 * navigating forward to Processing. If we stored transport in Zustand/React
 * state, lifecycle cleanup would race with ProcessingScreen mounting.
 * A module-level singleton lets ProcessingScreen atomically CONSUME the
 * transport (take ownership) before any cleanup can run.
 *
 * Lifecycle:
 *   1. Checkout mounts → useLedgerPrewarm starts BLE scan
 *   2. Scan completes → LedgerSession.setPrewarmed(transport, account, device)
 *   3. User taps Approve → ProcessingScreen.runPaymentFlow() starts
 *   4. ProcessingScreen calls LedgerSession.consumePrewarm() SYNCHRONOUSLY
 *      (before any await) → takes ownership of transport
 *   5. On success/error, ProcessingScreen closes transport
 *   6. If user goes Home: reset() calls LedgerSession.releaseAll()
 *   7. If Checkout regains focus (back from Processing): useLedgerPrewarm restarts
 */

import {closeTransport} from './LedgerTransport';
import type {LedgerDevice} from './LedgerTransport';
import type {XrplAccountInfo} from './XrplSigner';

interface PrewarmSlot {
  transport: any | null;  // BleTransport
  account: XrplAccountInfo | null;
  device: LedgerDevice | null;
}

const slot: PrewarmSlot = {
  transport: null,
  account: null,
  device: null,
};

export type PrewarmReadiness = 'none' | 'ready';

export function setPrewarmed(
  transport: any,
  account: XrplAccountInfo,
  device: LedgerDevice,
): void {
  // Close any stale transport before replacing
  if (slot.transport && slot.transport !== transport) {
    closeTransport(slot.transport).catch(() => {});
  }
  slot.transport = transport;
  slot.account = account;
  slot.device = device;
}

/**
 * Atomically take ownership of the pre-warmed transport + account.
 * Returns null fields if nothing was pre-warmed.
 * Caller is responsible for closing the transport when done.
 */
export function consumePrewarm(): PrewarmSlot {
  const snap = {
    transport: slot.transport,
    account: slot.account,
    device: slot.device,
  };
  slot.transport = null;
  slot.account = null;
  slot.device = null;
  return snap;
}

/** Release and close any held transport. Safe to call multiple times. */
export async function releaseAll(): Promise<void> {
  if (slot.transport) {
    await closeTransport(slot.transport);
    slot.transport = null;
  }
  slot.account = null;
  slot.device = null;
}

export function readiness(): PrewarmReadiness {
  return slot.transport && slot.account ? 'ready' : 'none';
}
