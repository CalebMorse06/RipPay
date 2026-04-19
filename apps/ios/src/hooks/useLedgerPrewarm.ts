/**
 * Scans and opens a BLE transport to the Ledger *while the user is on
 * CheckoutScreen* so ProcessingScreen can consume a live, ready transport
 * the moment the user taps Approve. This removes ~3–5s of BLE handshake
 * from the critical path and makes the "approve → sign" UX feel instant.
 *
 * The transport handle lives in LedgerSession (singleton) so navigation
 * state changes don't drop it; consumePrewarm() is called by LedgerSigner.
 */
export type PrewarmStatus =
  | 'idle'
  | 'scanning'
  | 'connecting'
  | 'ready'
  | 'failed';

export interface PrewarmResult {
  status: PrewarmStatus;
  failReason: string | null;
}

// No-op stub — background BLE scan caused race conditions with the explicit
// connect path in ProcessingScreen. ProcessingScreen's slow path handles the
// full scan → connect → read-account flow reliably on its own.
export function useLedgerPrewarm(_enabled: boolean): PrewarmResult {
  return {status: 'idle', failReason: null};
}
