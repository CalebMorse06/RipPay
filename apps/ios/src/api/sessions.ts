import {
  Session,
  SessionStatus,
  SubmitSessionRequest,
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

export async function submitSession(
  id: string,
  signedTxBlob: string,
): Promise<SubmitSessionResponse> {
  const body: SubmitSessionRequest = {signedTxBlob};
  const res = await client.post<SubmitSessionResponse>(
    `/api/sessions/${id}/submit`,
    body,
  );
  return res.data;
}
