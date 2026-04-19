import type { Session } from "@coldtap/shared";
import { getXrplMode, getXrplRpcUrl } from "../config";
import { sessionEvents } from "../events";
import { sessionStore } from "../store";

/**
 * XRPL submit + validation tracking.
 *
 * Serverless-safe: uses HTTP JSON-RPC (not WebSocket). Vercel's Lambda workers
 * freeze between invocations and WebSocket connections die silently, producing
 * "WebSocket is closed" errors on the second `request()`. HTTP is stateless
 * and reliable.
 *
 * XRPL_MODE=mock  — fake SUBMITTED → VALIDATING → PAID progression, no network
 * XRPL_MODE=real  — POST to XRPL JSON-RPC, poll tx by hash until validated
 */

type Logger = (msg: string, meta?: Record<string, unknown>) => void;

const log: Logger = (msg, meta) => {
  const prefix = "[coldtap:xrpl]";
  if (meta) console.log(`${prefix} ${msg}`, meta);
  else console.log(`${prefix} ${msg}`);
};

/**
 * Legacy entrypoint — fire-and-forget submit + validation. Only safe on a
 * long-lived Node process (local dev, tests). Vercel route handlers must use
 * `markSubmittedOnly` + `submitToNetwork` (inline) + `runValidation` (after()).
 */
export async function submitSignedBlob(args: {
  sessionId: string;
  txBlob: string;
  txHash: string;
}): Promise<void> {
  await markSubmittedOnly(args.sessionId, args.txHash);

  if (getXrplMode() === "mock") {
    void runMockProgression(args.sessionId);
    return;
  }

  void (async () => {
    const submitResult = await submitToNetwork(args.txBlob);
    if (!submitResult.ok) {
      await markFailed(args.sessionId, submitResult.reason);
      return;
    }
    await markValidating(args.sessionId);
    await trackValidation(args.sessionId, args.txHash);
  })();
}

/** Synchronous half: update Redis to SUBMITTED so pollers see immediate progress. */
export async function markSubmittedOnly(sessionId: string, txHash: string): Promise<void> {
  await markSubmitted(sessionId, txHash);
}

export interface SubmitResult {
  ok: boolean;
  engineResult?: string;
  /** When ok=false. Sets session.failureReason on the merchant page. */
  reason: string;
}

/**
 * Submit the signed blob to XRPL via JSON-RPC. Single HTTP round-trip.
 * Returns {ok: true} on provisional success, {ok: false, reason} otherwise.
 * Route handlers call this inline so iPhone sees the real error, not a
 * delayed SSE-only failure.
 */
export async function submitToNetwork(txBlob: string): Promise<SubmitResult> {
  if (getXrplMode() === "mock") {
    return { ok: true, engineResult: "tesSUCCESS", reason: "" };
  }

  try {
    const result = await jsonRpc<{ engine_result?: string; engine_result_message?: string }>(
      "submit",
      { tx_blob: txBlob, fail_hard: false },
    );
    const engineResult = result.engine_result ?? "";
    log("submit", { engineResult, message: result.engine_result_message });

    if (!isProvisionallySuccessful(engineResult)) {
      return {
        ok: false,
        engineResult,
        reason: `submit: ${engineResult || "unknown"}${result.engine_result_message ? ` — ${result.engine_result_message}` : ""}`,
      };
    }
    return { ok: true, engineResult, reason: "" };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    log("submit error", { reason });
    return { ok: false, reason };
  }
}

/**
 * Awaitable validation tracker. Wrap in Next.js `after()` so Vercel keeps the
 * function warm past the response. Polls `tx` via JSON-RPC until validated,
 * then writes PAID/FAILED to Redis.
 */
export async function runValidation(args: {
  sessionId: string;
  txHash: string;
}): Promise<void> {
  if (getXrplMode() === "mock") {
    await runMockProgression(args.sessionId);
    return;
  }
  await trackValidation(args.sessionId, args.txHash);
}

async function trackValidation(sessionId: string, txHash: string): Promise<void> {
  const deadline = Date.now() + 50_000; // leave headroom under 60s maxDuration
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 2000));
    try {
      const result = await jsonRpc<{
        validated?: boolean;
        meta?: unknown;
        status?: string;
        error?: string;
      }>("tx", { transaction: txHash, binary: false });

      // "txnNotFound" just means the tx hasn't been validated yet; keep polling.
      if (result.error === "txnNotFound" || result.status === "error") continue;

      if (result.validated !== true) continue;

      const resultCode =
        typeof result.meta === "object" && result.meta !== null && "TransactionResult" in result.meta
          ? String((result.meta as { TransactionResult: string }).TransactionResult)
          : "";

      if (resultCode === "tesSUCCESS") {
        log("validated paid", { sessionId, txHash });
        await markPaid(sessionId, txHash);
      } else {
        log("validated failed", { sessionId, txHash, resultCode });
        await markFailed(sessionId, `validated: ${resultCode || "unknown"}`);
      }
      return;
    } catch (err) {
      // Transient HTTP/network hiccup; keep polling until deadline.
      log("tx poll error", { reason: err instanceof Error ? err.message : String(err) });
    }
  }
  log("validation timeout", { sessionId, txHash });
  await markFailed(sessionId, "validation timeout");
}

async function runMockProgression(sessionId: string): Promise<void> {
  await new Promise((r) => setTimeout(r, 1200));
  await markValidating(sessionId);
  await new Promise((r) => setTimeout(r, 2000));
  const current = await sessionStore.get(sessionId);
  if (current && current.status === "VALIDATING" && current.txHash) {
    await markPaid(sessionId, current.txHash);
  }
}

function isProvisionallySuccessful(engineResult: string): boolean {
  return (
    engineResult === "tesSUCCESS" ||
    engineResult.startsWith("tes") ||
    engineResult.startsWith("tec") ||
    engineResult.startsWith("ter")
  );
}

/**
 * Minimal rippled JSON-RPC client. No xrpl.js / WebSocket dependency.
 * https://xrpl.org/docs/references/http-websocket-apis/
 */
async function jsonRpc<T>(method: string, params: Record<string, unknown>): Promise<T> {
  const url = getXrplRpcUrl();
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ method, params: [params] }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`JSON-RPC HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  const json = (await res.json()) as { result?: T & { error?: string; error_message?: string } };
  if (!json.result) {
    throw new Error(`JSON-RPC no result in response`);
  }
  return json.result;
}

async function markSubmitted(sessionId: string, txHash: string): Promise<Session | undefined> {
  return emit(await sessionStore.update(sessionId, { status: "SUBMITTED", txHash }));
}
async function markValidating(sessionId: string): Promise<Session | undefined> {
  return emit(await sessionStore.update(sessionId, { status: "VALIDATING" }));
}
async function markPaid(sessionId: string, txHash: string): Promise<Session | undefined> {
  return emit(
    await sessionStore.update(sessionId, {
      status: "PAID",
      txHash,
      paidAt: new Date().toISOString(),
    }),
  );
}
async function markFailed(sessionId: string, reason: string): Promise<Session | undefined> {
  return emit(
    await sessionStore.update(sessionId, {
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
