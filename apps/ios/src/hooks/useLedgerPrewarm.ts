/**
 * Silent background Ledger discovery + connection + account fetch.
 *
 * Called from CheckoutScreen as soon as the session is loaded and valid.
 * Results are stored in LedgerSession singleton so ProcessingScreen can
 * consume them for a fast approval path.
 *
 * - Uses useFocusEffect so prewarm restarts if CheckoutScreen regains focus
 *   (e.g. user comes back from a failed Processing attempt)
 * - All failures are silent to the caller — status is exposed for optional
 *   UI display (readiness badge), but never blocks the payment flow
 */

import {useRef, useState} from 'react';
import {useFocusEffect} from '@react-navigation/native';
import React from 'react';
import {
  findFirstLedgerDevice,
  openTransport,
  closeTransport,
} from '../ledger/LedgerTransport';
import {getXrplAccount} from '../ledger/XrplSigner';
import {setPrewarmed, releaseAll, readiness} from '../ledger/LedgerSession';

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

/**
 * @param enabled - set to false if session is not in a payable state;
 *                  prewarm is a no-op when disabled.
 */
export function useLedgerPrewarm(enabled: boolean): PrewarmResult {
  const [status, setStatus] = useState<PrewarmStatus>(() =>
    readiness() === 'ready' ? 'ready' : 'idle',
  );
  const [failReason, setFailReason] = useState<string | null>(null);
  const cancelledRef = useRef(false);
  const localTransportRef = useRef<any>(null);

  useFocusEffect(
    React.useCallback(() => {
      if (!enabled) return;

      // If already warmed from a previous focus, show ready immediately
      if (readiness() === 'ready') {
        setStatus('ready');
        return;
      }

      cancelledRef.current = false;
      localTransportRef.current = null;
      setStatus('scanning');
      setFailReason(null);

      (async () => {
        try {
          const device = await findFirstLedgerDevice();
          if (cancelledRef.current) return;

          setStatus('connecting');
          const transport = await openTransport(device);
          localTransportRef.current = transport;
          if (cancelledRef.current) {
            await closeTransport(transport);
            return;
          }

          const account = await getXrplAccount(transport);
          if (cancelledRef.current) {
            await closeTransport(transport);
            return;
          }

          setPrewarmed(transport, account, device);
          localTransportRef.current = null; // owned by singleton now
          setStatus('ready');
        } catch (e: any) {
          if (!cancelledRef.current) {
            setStatus('failed');
            setFailReason(e?.message ?? 'Could not reach Ledger');
          }
        }
      })();

      return () => {
        cancelledRef.current = true;
        // Close any transport that didn't make it into the singleton
        if (localTransportRef.current) {
          closeTransport(localTransportRef.current).catch(() => {});
          localTransportRef.current = null;
        }
        // Do NOT release the singleton — ProcessingScreen will consume it.
        // releaseAll() is called from reset() when user goes to Home.
      };
    }, [enabled]),
  );

  return {status, failReason};
}
