import {create} from 'zustand';
import {Session} from '@coldtap/shared';

export type LedgerStep =
  | 'idle'
  | 'connecting'
  | 'reading_address'
  | 'building_tx'
  | 'awaiting_user_confirm'
  | 'submitting'
  | 'done'
  | 'error';

interface SessionStore {
  session: Session | null;
  ledgerStep: LedgerStep;
  ledgerError: string | null;
  setSession: (s: Session | null) => void;
  setLedgerStep: (step: LedgerStep) => void;
  setLedgerError: (err: string | null) => void;
  reset: () => void;
}

export const useSessionStore = create<SessionStore>(set => ({
  session: null,
  ledgerStep: 'idle',
  ledgerError: null,
  setSession: s => set({session: s}),
  setLedgerStep: step => set({ledgerStep: step}),
  setLedgerError: err => set({ledgerError: err}),
  reset: () => set({session: null, ledgerStep: 'idle', ledgerError: null}),
}));
