import {create} from 'zustand';
import {Session} from '@coldtap/shared';
import type {LedgerDevice} from '../ledger/LedgerTransport';

/** Full buyer flow state — drives ProcessingScreen UI labels */
export type BuyerStep =
  | 'idle'
  | 'preparing_payment'     // POST /prepare to backend
  | 'scanning_ledger'       // BLE scan for nearby Ledger
  | 'connecting_ledger'     // BleTransport.open
  | 'fetching_account'      // getXrplAddress
  | 'building_tx'           // TransactionBuilder.encodeForSigning
  | 'awaiting_confirmation' // user must press buttons on Ledger
  | 'signing'               // signTransaction in progress (after user confirms)
  | 'submitting'            // POST /submit-signed to backend
  | 'done'
  | 'error';

/** Legacy alias — kept so existing ProcessingScreen references compile */
export type LedgerStep = BuyerStep;

interface SessionStore {
  session: Session | null;
  buyerStep: BuyerStep;
  buyerError: string | null;
  connectedDevice: LedgerDevice | null;

  setSession: (s: Session | null) => void;
  setBuyerStep: (step: BuyerStep) => void;
  setBuyerError: (err: string | null) => void;
  setConnectedDevice: (d: LedgerDevice | null) => void;

  /** @deprecated use setBuyerStep */
  setLedgerStep: (step: BuyerStep) => void;
  /** @deprecated use buyerStep */
  ledgerStep: BuyerStep;
  /** @deprecated use buyerError */
  ledgerError: string | null;
  /** @deprecated use setBuyerError */
  setLedgerError: (err: string | null) => void;

  reset: () => void;
}

export const useSessionStore = create<SessionStore>(set => ({
  session: null,
  buyerStep: 'idle',
  buyerError: null,
  connectedDevice: null,

  setSession: s => set({session: s}),
  setBuyerStep: step =>
    set({buyerStep: step, ledgerStep: step}),
  setBuyerError: err =>
    set({buyerError: err, ledgerError: err}),
  setConnectedDevice: d => set({connectedDevice: d}),

  // Legacy aliases kept for compatibility
  ledgerStep: 'idle',
  ledgerError: null,
  setLedgerStep: step => set({buyerStep: step, ledgerStep: step}),
  setLedgerError: err => set({buyerError: err, ledgerError: err}),

  reset: () =>
    set({
      session: null,
      buyerStep: 'idle',
      ledgerStep: 'idle',
      buyerError: null,
      ledgerError: null,
      connectedDevice: null,
    }),
}));
