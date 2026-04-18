import {useEffect, useState, useCallback} from 'react';
import {Session} from '@coldtap/shared';
import {getSession} from '../api/sessions';

export function useSession(sessionId: string | null, pollInterval = 3000) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!sessionId) return;
    try {
      const s = await getSession(sessionId);
      setSession(s);
      setError(null);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? e?.message ?? 'Failed to load session');
    }
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) return;
    setLoading(true);
    fetch().finally(() => setLoading(false));

    const timer = setInterval(() => {
      fetch();
    }, pollInterval);
    return () => clearInterval(timer);
  }, [sessionId, fetch, pollInterval]);

  return {session, loading, error, refetch: fetch};
}
