"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PrepareSessionResponse, Session } from "@coldtap/shared";
import { StatusBadge } from "./StatusBadge";
import { TxLink } from "./TxLink";
import { DEFAULT_XRP_PATH, connectLedger, isWebBluetoothSupported, type LedgerAccount } from "@/lib/ledger";
import { buildSignedHex, buildUnsignedHex } from "@/lib/sign";

type Phase =
  | "idle"
  | "checking-support"
  | "unsupported"
  | "connecting"
  | "paired"
  | "preparing"
  | "signing"
  | "submitting"
  | "awaiting-validation"
  | "done"
  | "error";

const POLL_INTERVAL_MS = 1500;

export function LedgerPay({ initial }: { initial: Session }) {
  const [session, setSession] = useState<Session>(initial);
  const [phase, setPhase] = useState<Phase>("checking-support");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [account, setAccount] = useState<LedgerAccount | null>(null);
  const [txHash, setTxHash] = useState<string | null>(initial.txHash ?? null);
  const ledgerRef = useRef<Awaited<ReturnType<typeof connectLedger>> | null>(null);

  // Support check on mount — no user-gesture required for a feature-detect.
  useEffect(() => {
    setPhase(isWebBluetoothSupported() ? "idle" : "unsupported");
  }, []);

  // Poll for session state updates once a submission is in flight, so the
  // buyer's screen walks through SUBMITTED → VALIDATING → PAID without the
  // user doing anything.
  useEffect(() => {
    if (phase !== "submitting" && phase !== "awaiting-validation") return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const tick = async () => {
      if (cancelled) return;
      try {
        const res = await fetch(`/api/sessions/${initial.id}`, { cache: "no-store" });
        if (res.ok) {
          const next = (await res.json()) as Session;
          setSession(next);
          if (next.txHash) setTxHash(next.txHash);
          if (next.status === "PAID" || next.status === "FAILED" || next.status === "EXPIRED") {
            setPhase("done");
            return;
          }
          if (next.status === "VALIDATING") setPhase("awaiting-validation");
        }
      } catch {
        /* keep polling */
      }
      if (!cancelled) timer = setTimeout(tick, POLL_INTERVAL_MS);
    };
    tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [phase, initial.id]);

  // Best-effort cleanup — close the BLE transport if the page unmounts.
  useEffect(() => {
    return () => {
      ledgerRef.current?.disconnect().catch(() => undefined);
    };
  }, []);

  const onConnect = useCallback(async () => {
    setErrorMsg(null);
    setPhase("connecting");
    try {
      const ledger = await connectLedger();
      ledgerRef.current = ledger;
      const acct = await ledger.getAccount(DEFAULT_XRP_PATH);
      setAccount(acct);
      setPhase("paired");
    } catch (err) {
      setPhase("error");
      setErrorMsg(friendlyConnectError(err));
    }
  }, []);

  const onPay = useCallback(async () => {
    if (!ledgerRef.current || !account) return;
    setErrorMsg(null);
    try {
      setPhase("preparing");
      const prepareRes = await fetch(`/api/sessions/${session.id}/prepare`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ account: account.address }),
      });
      if (!prepareRes.ok) {
        const body = await prepareRes.json().catch(() => ({}));
        throw new Error(body?.error ?? `prepare failed (${prepareRes.status})`);
      }
      const prepared = (await prepareRes.json()) as PrepareSessionResponse;

      setPhase("signing");
      const { withPubKey, hex } = await buildUnsignedHex(prepared.unsignedTx, account.publicKey);
      const signature = await ledgerRef.current.signTxHex(DEFAULT_XRP_PATH, hex);
      const signedHex = await buildSignedHex(withPubKey, signature);

      setPhase("submitting");
      const submitRes = await fetch(`/api/sessions/${session.id}/submit-signed`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ txBlob: signedHex }),
      });
      if (!submitRes.ok) {
        const body = await submitRes.json().catch(() => ({}));
        throw new Error(body?.reason ?? body?.error ?? `submit failed (${submitRes.status})`);
      }
      const submitted = (await submitRes.json()) as { txHash: string };
      setTxHash(submitted.txHash);
      // Remain in "submitting" — the polling effect will advance to done.
    } catch (err) {
      setPhase("error");
      setErrorMsg(err instanceof Error ? err.message : String(err));
    }
  }, [account, session.id]);

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Pay with ColdTap</h1>
        <StatusBadge status={session.status} />
      </div>

      <div className="rounded-2xl border border-border bg-surface p-6">
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-subtle">You pay</div>
        <div className="mt-1 text-5xl font-bold tracking-tight leading-none">
          {session.amountDisplay}
        </div>
        <div className="mt-3 flex items-baseline justify-between gap-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-subtle">Merchant</div>
            <div className="text-base font-semibold">{session.merchantName}</div>
            <div className="text-sm text-subtle">{session.itemName}</div>
          </div>
          <span
            className="inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent-dim px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-accent"
          >
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />
            XRPL · {session.network}
          </span>
        </div>
      </div>

      {phase === "unsupported" && (
        <Notice tone="warn">
          This browser doesn&apos;t support WebBluetooth. Use Chrome on Android, or fall back to the
          iPhone app via the QR / NFC path.
        </Notice>
      )}

      {phase === "idle" && (
        <div className="space-y-3">
          <Button onClick={onConnect}>Connect Ledger Nano X</Button>
          <p className="text-center text-xs text-subtle">
            Make sure your Ledger is unlocked with the XRP app open.
          </p>
        </div>
      )}

      {phase === "connecting" && <Notice tone="info">Pairing — confirm the prompt on your phone.</Notice>}

      {(phase === "paired" ||
        phase === "preparing" ||
        phase === "signing" ||
        phase === "submitting" ||
        phase === "awaiting-validation") && (
        <div className="space-y-3">
          {account && (
            <div className="rounded-xl border border-border bg-surface p-4 text-xs">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-subtle">
                Paying from
              </div>
              <div className="mt-1 break-all font-mono text-ink">{account.address}</div>
            </div>
          )}

          {phase === "paired" && <Button onClick={onPay}>Approve payment on Ledger</Button>}

          {phase === "preparing" && <Notice tone="info">Asking backend for unsigned transaction…</Notice>}
          {phase === "signing" && (
            <Notice tone="info">
              Approve on your Ledger Nano X. Verify merchant, amount, and destination on-device.
            </Notice>
          )}
          {phase === "submitting" && <Notice tone="info">Submitting to XRPL…</Notice>}
          {phase === "awaiting-validation" && (
            <Notice tone="info">Awaiting ledger validation (typically 3–5 seconds)…</Notice>
          )}
        </div>
      )}

      {phase === "done" && session.status === "PAID" && (
        <Notice tone="success">Payment received · thanks</Notice>
      )}
      {phase === "done" && session.status === "FAILED" && (
        <Notice tone="error">Payment failed: {session.failureReason ?? "unknown"}</Notice>
      )}
      {phase === "done" && session.status === "EXPIRED" && (
        <Notice tone="warn">Session expired before payment completed.</Notice>
      )}

      {phase === "error" && (
        <div className="space-y-3">
          <Notice tone="error">{errorMsg ?? "Something went wrong."}</Notice>
          <Button onClick={onConnect} variant="outline">
            Try again
          </Button>
        </div>
      )}

      {txHash && (
        <div className="rounded-xl border border-border bg-surface p-4 text-sm">
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-subtle">
            Transaction
          </div>
          <TxLink hash={txHash} network={session.network} />
        </div>
      )}
    </div>
  );
}

function friendlyConnectError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/NotFoundError|cancelled/i.test(msg)) return "No Ledger selected. Try again and pick your Nano X.";
  if (/Bluetooth adapter not available/i.test(msg)) return "Turn Bluetooth on, then try again.";
  if (/GATT|disconnected/i.test(msg)) return "Bluetooth disconnected. Try again.";
  return msg || "Failed to connect to Ledger.";
}

function Button({
  children,
  onClick,
  variant = "solid",
}: {
  children: React.ReactNode;
  onClick: () => void;
  variant?: "solid" | "outline";
}) {
  const base =
    "flex h-14 w-full items-center justify-center rounded-2xl px-6 text-center font-bold transition active:translate-y-[1px]";
  const style =
    variant === "solid"
      ? "bg-accent text-white hover:bg-accent-pressed"
      : "border border-border bg-bg text-ink hover:border-accent hover:text-accent";
  return (
    <button type="button" onClick={onClick} className={`${base} ${style}`}>
      {children}
    </button>
  );
}

function Notice({
  tone,
  children,
}: {
  tone: "info" | "success" | "warn" | "error";
  children: React.ReactNode;
}) {
  const styles: Record<typeof tone, string> = {
    info: "border-accent/30 bg-accent-dim text-accent",
    success: "border-success/30 bg-success-dim text-success",
    warn: "border-warn/30 bg-warn/10 text-warn",
    error: "border-danger/30 bg-danger/10 text-danger",
  };
  return (
    <div className={`rounded-xl border p-4 text-sm font-medium ${styles[tone]}`}>{children}</div>
  );
}
