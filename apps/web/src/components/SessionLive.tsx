"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
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
  const [liveOk, setLiveOk] = useState(true);
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
          setLiveOk(true);
        }
      } catch {
        setLiveOk(false);
      }
      if (!cancelled) pollTimer = setTimeout(poll, POLL_INTERVAL_MS);
    }

    try {
      es = new EventSource(`/api/sessions/${initial.id}/events`);
      es.onmessage = (ev) => {
        try {
          const next = JSON.parse(ev.data) as Session;
          setSession(next);
          setLiveOk(true);
        } catch { /* ignore */ }
      };
      es.onerror = () => {
        es?.close();
        es = null;
        if (!pollTimer) pollTimer = setTimeout(poll, POLL_INTERVAL_MS);
      };
    } catch {
      if (!pollTimer) pollTimer = setTimeout(poll, POLL_INTERVAL_MS);
    }

    const reconcile = setTimeout(poll, POLL_INTERVAL_MS * 2);

    return () => {
      cancelled = true;
      ac.abort();
      es?.close();
      if (pollTimer) clearTimeout(pollTimer);
      clearTimeout(reconcile);
    };
  }, [initial.id]);

  const expiresLabel = useMemo(() => {
    if (session.status === "EXPIRED") return "expired";
    const ms = new Date(session.expiresAt).getTime() - Date.now();
    if (ms <= 0) return "expired";
    const totalSec = Math.round(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  }, [session.expiresAt, session.updatedAt, session.status]);

  async function copyId() {
    try {
      await navigator.clipboard.writeText(session.id);
      setCopied(true);
      if (copyResetTimer.current) clearTimeout(copyResetTimer.current);
      copyResetTimer.current = setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard unavailable */ }
  }

  const isTerminal = ["PAID", "FAILED", "EXPIRED"].includes(session.status);

  return (
    <div className="space-y-6">
      {/* PAID celebration — full-width hero */}
      {session.status === "PAID" && (
        <div className="rounded-2xl border border-success/30 bg-success-dim p-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border-2 border-success bg-white text-3xl text-success shadow-sm">
            ✓
          </div>
          <div className="text-4xl font-bold tracking-tight text-success">
            {session.amountDisplay} XRP
          </div>
          <div className="mt-1 text-base font-medium text-success/80">
            Payment confirmed
          </div>
          <div className="mt-2 text-sm text-success/70">
            {session.merchantName} · {session.itemName}
          </div>
          {session.txHash && (
            <div className="mt-4 inline-block rounded-xl border border-success/20 bg-white/60 px-4 py-2 text-xs">
              <TxLink hash={session.txHash} network={session.network} />
            </div>
          )}
          <div className="mt-6">
            <Link
              href="/"
              className="inline-flex h-11 items-center justify-center rounded-xl bg-success px-6 text-sm font-bold text-white transition hover:bg-success/90"
            >
              New checkout
            </Link>
          </div>
        </div>
      )}

      <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_300px]">
        <section className="space-y-5">
          {/* Status row */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <StatusBadge status={session.status} />
              <NetworkBadge network={session.network} />
            </div>
            <LiveDot ok={liveOk} />
          </div>

          {/* Session detail card */}
          <div className="rounded-2xl border border-border bg-surface p-6">
            <div className="flex items-baseline justify-between gap-4">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-subtle">
                  Merchant
                </div>
                <div className="text-lg font-semibold">{session.merchantName}</div>
              </div>
              <div className="text-right">
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-subtle">
                  Amount
                </div>
                <div className="text-3xl font-bold tracking-tight">
                  {session.amountDisplay}
                  <span className="ml-1.5 text-base font-semibold text-subtle">XRP</span>
                </div>
              </div>
            </div>

            <div className="mt-5 grid gap-3 border-t border-border pt-4 text-sm">
              <KV label="Item" value={session.itemName} />
              <KV label="Destination" value={session.destinationAddress} mono />
              {session.memo && <KV label="Memo" value={session.memo} />}
              <KV label="Session ID" value={session.id} mono />
              <KV label="Expires" value={expiresLabel} />
            </div>

            {/* Transaction hash */}
            {session.txHash && session.status !== "PAID" && (
              <div className="mt-5 rounded-xl border border-border bg-bg p-4 text-sm">
                <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-subtle">
                  Transaction
                </div>
                <TxLink hash={session.txHash} network={session.network} />
              </div>
            )}

            {/* Failure */}
            {session.status === "FAILED" && (
              <div className="mt-5 rounded-xl border border-danger/30 bg-danger/10 p-4 text-sm text-danger">
                <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em]">
                  Failure reason
                </div>
                <div className="break-all font-mono text-xs">
                  {session.failureReason ?? "Transaction rejected by XRPL"}
                </div>
              </div>
            )}

            {/* Expired */}
            {session.status === "EXPIRED" && (
              <div className="mt-5 rounded-xl border border-border bg-surface-2 p-4 text-sm text-subtle">
                Session expired without payment.
              </div>
            )}
          </div>

          {/* New checkout CTA on non-PAID terminal states */}
          {(session.status === "FAILED" || session.status === "EXPIRED") && (
            <Link
              href="/"
              className="flex h-11 items-center justify-center rounded-xl border border-border bg-surface text-sm font-semibold text-ink transition hover:border-accent hover:text-accent"
            >
              ← Start new checkout
            </Link>
          )}
        </section>

        {/* QR sidebar */}
        <aside className="space-y-4">
          <div className="rounded-2xl border border-border bg-surface p-5">
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-subtle">
              Scan to pay
            </div>
            <SessionQR sessionId={session.id} baseUrl={baseUrl} />
            <button
              onClick={copyId}
              className="mt-3 w-full rounded-xl border border-border bg-bg px-3 py-2 text-xs font-mono text-ink transition hover:border-accent hover:text-accent"
              type="button"
            >
              {copied ? "copied ✓" : `copy · ${session.id}`}
            </button>
            <p className="mt-3 text-center text-[11px] text-subtle">
              Open ColdTap on iPhone and tap or paste this ID.
            </p>
          </div>

          {/* Signing steps legend */}
          {!isTerminal && (
            <div className="rounded-xl border border-border bg-surface p-4 text-xs text-subtle space-y-2">
              <div className="font-semibold text-ink text-[11px] uppercase tracking-[0.14em]">What happens next</div>
              <Step n={1} label="Buyer scans QR or taps NFC" />
              <Step n={2} label="Reviews amount on iPhone" />
              <Step n={3} label="Approves on Ledger Nano X" />
              <Step n={4} label="Transaction settles on XRPL" />
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function Step({ n, label }: { n: number; label: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-5 w-5 flex-none items-center justify-center rounded-full bg-accent-dim text-[10px] font-bold text-accent">
        {n}
      </span>
      <span>{label}</span>
    </div>
  );
}

function LiveDot({ ok }: { ok: boolean }) {
  return (
    <span className="flex items-center gap-1.5 text-[11px] text-subtle">
      <span
        className={`inline-block h-1.5 w-1.5 rounded-full ${ok ? "bg-success animate-pulse" : "bg-danger"}`}
      />
      {ok ? "live" : "reconnecting…"}
    </span>
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
      ? "border-success/40 bg-success-dim text-success"
      : network === "testnet"
        ? "border-accent/40 bg-accent-dim text-accent"
        : "border-border bg-surface text-subtle";
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] ${style}`}
    >
      {network}
    </span>
  );
}
