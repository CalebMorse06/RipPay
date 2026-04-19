/**
 * Client-side UI state for the buyer-side payment flow. Holds the currently
 * loaded Session plus ephemeral UI stage (BuyerStep) for progress rendering.
 *
 * The authoritative session record lives on the backend (polled + SSE from
 * /api/sessions/:id/events). Never treat anything in this store as source of
 * truth for payment status — re-read from the server before any state-changing
 * action.
 */
import {create} from 'zustand';
import {Session} from '@coldtap/shared';
import {releaseAll} from '../ledger/LedgerSession';
import type {LedgerDevice} from '../ledger/LedgerTransport';

export type BuyerStep =
  | 'idle'
  | 'preparing_payment'
  | 'scanning_ledger'
  | 'connecting_ledger'
  | 'fetching_account'
  | 'building_tx'
  | 'awaiting_confirmation'
  | 'unlocking_wallet'
  | 'signing'
  | 'submitting'
  | 'validating'
  | 'done'
  | 'error';

/** Legacy alias kept for backwards compatibility */
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

  /** Full reset — clears session, payment state, and releases prewarm transport */
  reset: () => void;
}

export const useSessionStore = create<SessionStore>(set => ({
  session: null,
  buyerStep: 'idle',
  buyerError: null,
  connectedDevice: null,

  setSession: s => set({session: s}),
  setBuyerStep: step => set({buyerStep: step, ledgerStep: step}),
  setBuyerError: err => set({buyerError: err, ledgerError: err}),
  setConnectedDevice: d => set({connectedDevice: d}),

  // Legacy aliases
  ledgerStep: 'idle',
  ledgerError: null,
  setLedgerStep: step => set({buyerStep: step, ledgerStep: step}),
  setLedgerError: err => set({buyerError: err, ledgerError: err}),

  reset: () => {
    releaseAll().catch(() => {}); // clean up pre-warmed transport if any
    set({
      session: null,
      buyerStep: 'idle',
      ledgerStep: 'idle',
      buyerError: null,
      ledgerError: null,
      connectedDevice: null,
    });
  },
}));
