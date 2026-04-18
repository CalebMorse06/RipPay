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
