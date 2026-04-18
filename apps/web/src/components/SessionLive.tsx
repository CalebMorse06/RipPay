"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { NetworkId, Session } from "@coldtap/shared";
import { StatusBadge } from "./StatusBadge";
import { SessionQR } from "./SessionQR";
import { TxLink } from "./TxLink";

const POLL_INTERVAL_MS = 1500;

export function SessionLive({
  initial,
  baseUrl,
}: {
  initial: Session;
  baseUrl: string;
}) {
  const [session, setSession] = useState<Session>(initial);
  const [transport, setTransport] = useState<"sse" | "polling">("polling");
  const [copied, setCopied] = useState(false);
  const copyResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    let es: EventSource | null = null;
    let pollTimer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    async function poll() {
      if (cancelled) return;
      try {
        const res = await fetch(`/api/sessions/${initial.id}`, {
          signal: ac.signal,
          cache: "no-store",
        });
        if (res.ok) {
          const next = (await res.json()) as Session;
          setSession(next);
        }
      } catch {
        // Ignore transient errors; keep polling.
      }
      if (!cancelled) pollTimer = setTimeout(poll, POLL_INTERVAL_MS);
    }

    try {
      es = new EventSource(`/api/sessions/${initial.id}/events`);
      es.onopen = () => setTransport("sse");
      es.onmessage = (ev) => {
        try {
          const next = JSON.parse(ev.data) as Session;
          setSession(next);
        } catch {
          // Ignore malformed events.
        }
      };
      es.onerror = () => {
        // Fall back to polling if SSE drops.
        setTransport("polling");
        es?.close();
        es = null;
        if (!pollTimer) pollTimer = setTimeout(poll, POLL_INTERVAL_MS);
      };
    } catch {
      if (!pollTimer) pollTimer = setTimeout(poll, POLL_INTERVAL_MS);
    }

    // Always run at least one reconciliation poll a moment after mount —
    // covers the case where SSE connects but misses an early transition.
    const reconcile = setTimeout(poll, POLL_INTERVAL_MS * 2);

    return () => {
      cancelled = true;
      ac.abort();
      es?.close();
      if (pollTimer) clearTimeout(pollTimer);
      clearTimeout(reconcile);
    };
  }, [initial.id]);

  const expiresInSec = useMemo(() => {
    const ms = new Date(session.expiresAt).getTime() - Date.now();
    return Math.max(0, Math.round(ms / 1000));
  }, [session.expiresAt, session.updatedAt]);

  async function copyId() {
    try {
      await navigator.clipboard.writeText(session.id);
      setCopied(true);
      if (copyResetTimer.current) clearTimeout(copyResetTimer.current);
      copyResetTimer.current = setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable — user can still read the id on screen */
    }
  }

  return (
    <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_320px]">
      <section className="space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <StatusBadge status={session.status} />
            <NetworkBadge network={session.network} />
          </div>
          <span className="text-xs text-subtle">
            live via <span className="font-mono">{transport}</span>
          </span>
        </div>

        <div className="rounded-xl border border-border bg-surface/60 p-6">
          <div className="flex items-baseline justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-widest text-subtle">Merchant</div>
              <div className="text-lg font-medium">{session.merchantName}</div>
            </div>
            <div className="text-right">
              <div className="text-xs uppercase tracking-widest text-subtle">Amount</div>
              <div className="text-2xl font-semibold tracking-tight">{session.amountDisplay}</div>
            </div>
          </div>

          <div className="mt-4 grid gap-3 border-t border-border pt-4 text-sm">
            <KV label="Item" value={session.itemName} />
            <KV label="Destination" value={session.destinationAddress} mono />
            {session.memo && <KV label="Memo" value={session.memo} />}
            <KV label="Session ID" value={session.id} mono />
            <KV
              label="Expires in"
              value={session.status === "EXPIRED" ? "expired" : `${expiresInSec}s`}
            />
          </div>

          {session.txHash && (
            <div className="mt-5 rounded-md border border-border bg-bg/60 p-3 text-sm">
              <div className="mb-1 text-xs uppercase tracking-widest text-subtle">
                Transaction
              </div>
              <TxLink hash={session.txHash} network={session.network} />
            </div>
          )}

          {session.status === "FAILED" && session.failureReason && (
            <div className="mt-5 rounded-md border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
              <div className="mb-1 text-xs uppercase tracking-widest">Failure reason</div>
              <div className="break-all font-mono text-xs">{session.failureReason}</div>
            </div>
          )}
          {session.status === "PAID" && (
            <div className="mt-5 rounded-md border border-success/40 bg-success/10 p-3 text-sm text-success">
              Payment received · thanks
            </div>
          )}
          {session.status === "EXPIRED" && (
            <div className="mt-5 rounded-md border border-border bg-bg/40 p-3 text-sm text-subtle">
              Session expired without payment. Create a new one to retry.
            </div>
          )}
        </div>

        <div className="rounded-xl border border-dashed border-border/80 bg-surface/30 p-4 text-xs text-subtle">
          <strong className="font-semibold text-ink">Demo tip.</strong> Drive the session from another
          terminal:
          <pre className="mt-2 overflow-x-auto rounded bg-bg/70 p-3 font-mono text-[11px] leading-relaxed text-ink/90">
{`curl -X POST ${baseUrl}/api/sessions/${session.id}/status \\
  -H 'content-type: application/json' \\
  -d '{"status":"AWAITING_SIGNATURE"}'`}
          </pre>
        </div>
      </section>

      <aside className="space-y-4">
        <div className="rounded-xl border border-border bg-surface/60 p-5">
          <div className="mb-3 text-xs uppercase tracking-widest text-subtle">Buyer scans</div>
          <SessionQR sessionId={session.id} baseUrl={baseUrl} />
          <button
            onClick={copyId}
            className="mt-3 w-full rounded-md border border-border bg-bg/60 px-3 py-2 text-xs font-mono text-ink transition hover:border-accent/60"
            type="button"
          >
            {copied ? "copied ✓" : `copy id · ${session.id}`}
          </button>
          <p className="mt-2 text-center text-[11px] text-subtle">
            Or open the ColdTap iPhone app and enter the id manually.
          </p>
        </div>
      </aside>
    </div>
  );
}

function KV({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-subtle">{label}</span>
      <span className={`text-right ${mono ? "break-all font-mono text-xs" : ""}`}>{value}</span>
    </div>
  );
}

function NetworkBadge({ network }: { network: NetworkId }) {
  const style =
    network === "mainnet"
      ? "border-success/40 text-success"
      : network === "testnet"
        ? "border-accent/40 text-accent"
        : "border-subtle/40 text-subtle";
  return (
    <span
      className={`inline-flex items-center rounded-full border bg-surface px-2 py-0.5 text-[10px] font-medium uppercase tracking-widest ${style}`}
      title="XRPL network this session settles on"
    >
      {network}
    </span>
  );
}
