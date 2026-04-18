import {
  Session,
  SessionStatus,
  PrepareSessionResponse,
  SubmitSessionResponse,
} from '@coldtap/shared';
import client from './client';

export async function getSession(id: string): Promise<Session> {
  const res = await client.get<Session>(`/api/sessions/${id}`);
  return res.data;
}

export async function updateSessionStatus(
  id: string,
  status: SessionStatus,
): Promise<void> {
  await client.post(`/api/sessions/${id}/status`, {status});
}

/**
 * Ask backend to prepare an unsigned XRPL transaction for this session.
 * Backend returns a fully-formed unsigned tx (destination, amount, sequence,
 * fee, lastLedgerSequence). The iOS app injects Account + SigningPubKey from
 * Ledger before signing.
 *
 * Falls back to building a minimal unsigned tx from session data + fetching
 * network params directly from XRPL if the /prepare route is not yet live.
 */
export async function prepareSession(
  id: string,
): Promise<PrepareSessionResponse> {
  try {
    const res = await client.post<PrepareSessionResponse>(
      `/api/sessions/${id}/prepare`,
    );
    return res.data;
  } catch (e: any) {
    if (e?.response?.status === 404 || e?.response?.status === 405) {
      // Backend does not yet have /prepare — caller must use fallback
      throw new ApiError('PREPARE_NOT_IMPLEMENTED', 'Backend /prepare endpoint not yet available. Network params must be fetched client-side.');
    }
    throw e;
  }
}

/**
 * Submit signed transaction blob to backend.
 * Tries preferred route /submit-signed first, falls back to /submit.
 */
export async function submitSignedBlob(
  id: string,
  signedTxBlob: string,
): Promise<SubmitSessionResponse> {
  try {
    const res = await client.post<SubmitSessionResponse>(
      `/api/sessions/${id}/submit-signed`,
      {signedTxBlob},
    );
    return res.data;
  } catch (e: any) {
    if (e?.response?.status === 404 || e?.response?.status === 405) {
      // Fall back to original route
      const res = await client.post<SubmitSessionResponse>(
        `/api/sessions/${id}/submit`,
        {signedTxBlob},
      );
      return res.data;
    }
    throw e;
  }
}

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Human-readable error from any API call */
export function extractApiErrorMessage(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  const axiosErr = e as any;
  const serverMsg = axiosErr?.response?.data?.message ?? axiosErr?.response?.data?.error;
  if (serverMsg) return serverMsg;
  if (axiosErr?.code === 'ECONNREFUSED' || axiosErr?.code === 'ERR_NETWORK') {
    return 'Cannot reach backend. Check your network and BACKEND_URL.';
  }
  if (axiosErr?.code === 'ECONNABORTED') {
    return 'Request timed out. Check your network connection.';
  }
  return axiosErr?.message ?? 'Unknown error';
}
