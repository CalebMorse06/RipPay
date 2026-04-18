import type { Session } from "@coldtap/shared";
import { getXrplMode, getXrplWsUrl } from "../config";
import { sessionEvents } from "../events";
import { sessionStore } from "../store";

/**
 * XRPL submit + validation tracking.
 *
 * Behavior is split by `XRPL_MODE`:
 *
 *   mock  (default, dev + demo fallback) — simulates SUBMITTED → VALIDATING → PAID
 *         with reliable timing so the demo never flakes on network conditions.
 *         Uses the caller-supplied txHash as-is; no XRPL client is opened.
 *
 *   real  — submits the signed blob over a WebSocket Client, polls for ledger
 *           validation up to a deadline, maps the final result code to PAID
 *           or FAILED, and records a failureReason on failure.
 */

type Logger = (msg: string, meta?: Record<string, unknown>) => void;

const log: Logger = (msg, meta) => {
  const prefix = "[coldtap:xrpl]";
  if (meta) {
    console.log(`${prefix} ${msg}`, meta);
  } else {
    console.log(`${prefix} ${msg}`);
  }
};

/**
 * Record SUBMITTED state and kick off provider-specific progression in the
 * background. Returns immediately with the already-known tx hash.
 */
export async function submitSignedBlob(args: {
  sessionId: string;
  txBlob: string;
  txHash: string;
}): Promise<void> {
  markSubmitted(args.sessionId, args.txHash);

  if (getXrplMode() === "mock") {
    scheduleMockProgression(args.sessionId);
    return;
  }

  void submitReal(args.sessionId, args.txBlob, args.txHash);
}

async function submitReal(sessionId: string, txBlob: string, txHash: string): Promise<void> {
  let client: import("xrpl").Client | null = null;
  try {
    const { Client } = await import("xrpl");
    client = new Client(getXrplWsUrl());
    await client.connect();

    const submit = await client.request({ command: "submit", tx_blob: txBlob });
    const engineResult =
      (submit.result as { engine_result?: string }).engine_result ?? "";
    log("submit", { sessionId, txHash, engineResult });

    if (!isProvisionallySuccessful(engineResult)) {
      markFailed(sessionId, `submit: ${engineResult || "unknown"}`);
      return;
    }

    markValidating(sessionId);
    await trackValidation(client, sessionId, txHash);
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    log("submit error", { sessionId, reason });
    markFailed(sessionId, reason);
  } finally {
    try {
      await client?.disconnect();
    } catch {
      /* ignore */
    }
  }
}

function isProvisionallySuccessful(engineResult: string): boolean {
  // tesSUCCESS, tec* codes and ter* codes are provisionally accepted; only
  // tem*/tef*/tel* fail hard at submit time.
  return (
    engineResult === "tesSUCCESS" ||
    engineResult.startsWith("tes") ||
    engineResult.startsWith("tec") ||
    engineResult.startsWith("ter")
  );
}

async function trackValidation(
  client: import("xrpl").Client,
  sessionId: string,
  txHash: string,
): Promise<void> {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 2000));
    try {
      const res = await client.request({ command: "tx", transaction: txHash });
      const validated = (res.result as { validated?: boolean }).validated === true;
      const meta = (res.result as { meta?: unknown }).meta;
      const resultCode =
        typeof meta === "object" && meta !== null && "TransactionResult" in meta
          ? String((meta as { TransactionResult: string }).TransactionResult)
          : "";

      if (!validated) continue;

      if (resultCode === "tesSUCCESS") {
        log("validated paid", { sessionId, txHash });
        markPaid(sessionId, txHash);
      } else {
        log("validated failed", { sessionId, txHash, resultCode });
        markFailed(sessionId, `validated: ${resultCode || "unknown"}`);
      }
      return;
    } catch {
      // Transaction may not be visible yet; keep polling until deadline.
    }
  }
  log("validation timeout", { sessionId, txHash });
  markFailed(sessionId, "validation timeout");
}

function scheduleMockProgression(sessionId: string) {
  setTimeout(() => markValidating(sessionId), 1200);
  setTimeout(() => {
    const current = sessionStore.get(sessionId);
    if (current && current.status === "VALIDATING" && current.txHash) {
      markPaid(sessionId, current.txHash);
    }
  }, 3200);
}

function markSubmitted(sessionId: string, txHash: string): Session | undefined {
  return emit(sessionStore.update(sessionId, { status: "SUBMITTED", txHash }));
}
function markValidating(sessionId: string): Session | undefined {
  return emit(sessionStore.update(sessionId, { status: "VALIDATING" }));
}
function markPaid(sessionId: string, txHash: string): Session | undefined {
  return emit(
    sessionStore.update(sessionId, {
      status: "PAID",
      txHash,
      paidAt: new Date().toISOString(),
    }),
  );
}
function markFailed(sessionId: string, reason: string): Session | undefined {
  return emit(
    sessionStore.update(sessionId, {
      status: "FAILED",
      failureReason: reason,
      failedAt: new Date().toISOString(),
    }),
  );
}
function emit(session: Session | undefined): Session | undefined {
  if (session) sessionEvents.emit(session);
  return session;
}
