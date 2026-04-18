/**
 * Merchant tap resolution.
 *
 * The NFC sticker encodes a merchant/table identity, not a per-payment session.
 * This module resolves merchantId → current active Session.
 *
 * Route preference order (first 2xx wins, 404 continues to next):
 *   GET /api/merchants/:id/active-session
 *   GET /api/tap/:id
 *   GET /api/merchant/:id/session
 *
 * Add new routes here if the backend contract changes — nowhere else in the
 * app should know about this URL shape.
 */

import {Session} from '@coldtap/shared';
import client from './client';
import {extractApiErrorMessage} from './sessions';

export class NoActiveSessionError extends Error {
  constructor(public readonly merchantId: string) {
    super(`No active checkout at this table`);
    this.name = 'NoActiveSessionError';
  }
}

const MERCHANT_ROUTES = (id: string) => [
  `/api/merchants/${id}/active-session`,
  `/api/tap/${id}`,
  `/api/merchant/${id}/session`,
];

/**
 * Resolve a merchant ID to the currently active checkout session.
 * Throws NoActiveSessionError if no session is active (all routes 404).
 * Throws on network errors / 5xx.
 */
export async function resolveActiveSession(merchantId: string): Promise<Session> {
  const routes = MERCHANT_ROUTES(merchantId);
  let lastError: unknown = null;

  for (const route of routes) {
    try {
      const res = await client.get<Session>(route);
      if (res.data?.id) return res.data;
    } catch (e: any) {
      const status = e?.response?.status;
      if (status === 404) {
        lastError = e;
        continue; // try next route
      }
      // 4xx other than 404, 5xx, or network error — surface immediately
      throw new Error(extractApiErrorMessage(e));
    }
  }

  // All routes returned 404
  throw new NoActiveSessionError(merchantId);
}
