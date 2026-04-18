import type { Session } from "@coldtap/shared";
import { sessionStore } from "./store";
import { sessionEvents } from "./events";

/**
 * XRPL submit + validation tracking.
 *
 * Two modes are supported so the demo stays reliable:
 *
 *   XRPL_MODE=mock  (default in dev) — simulates SUBMITTED → VALIDATING → PAID
 *                   so the iOS agent can integrate against the contract before
 *                   real XRPL signing lands, and so the demo has a reliable
 *                   fallback if testnet flakes.
 *
 *   XRPL_MODE=real — opens an `xrpl.Client` against testnet, submits the signed
 *                    blob, polls for ledger validation, and classifies the result.
 */

type XrplMode = "mock" | "real";

function getMode(): XrplMode {
  const raw = (process.env.XRPL_MODE ?? "mock").toLowerCase();
  return raw === "real" ? "real" : "mock";
}

function getWsUrl(): string {
  return process.env.XRPL_WS_URL ?? "wss://s.altnet.rippletest.net:51233";
}

/**
 * Accept a signed transaction blob, record SUBMITTED state on the session, and
 * kick off async validation tracking. Returns the computed txHash immediately.
 */
export async function submitSignedBlob(
  sessionId: string,
  txBlob: string,
): Promise<{ txHash: string }> {
  const mode = getMode();

  if (mode === "mock") {
    const txHash = fakeTxHash(sessionId, txBlob);
    markSubmitted(sessionId, txHash);
    scheduleMockProgression(sessionId);
    return { txHash };
  }

  // Real XRPL path. Lazy-load the SDK so the mock path stays zero-dep.
  const { Client, hashes } = await import("xrpl");
  const client = new Client(getWsUrl());
  await client.connect();

  try {
    const txHash = hashes.hashSignedTx(txBlob);
    markSubmitted(sessionId, txHash);

    const submit = await client.request({ command: "submit", tx_blob: txBlob });
    const engineResult = (submit.result as { engine_result?: string }).engine_result ?? "";

    if (!isProvisionallySuccessful(engineResult)) {
      markFailed(sessionId, `submit: ${engineResult || "unknown"}`);
      return { txHash };
    }

    markValidating(sessionId);

    // Fire-and-forget validation watcher. Awaiting here would block the HTTP
    // response; the client gets status updates through SSE / polling instead.
    void trackValidation(client, sessionId, txHash).finally(async () => {
      try {
        await client.disconnect();
      } catch {
        /* ignore */
      }
    });

    return { txHash };
  } catch (err) {
    markFailed(sessionId, err instanceof Error ? err.message : "unknown error");
    try {
      await client.disconnect();
    } catch {
      /* ignore */
    }
    throw err;
  }
}

function isProvisionallySuccessful(engineResult: string): boolean {
  // tesSUCCESS, tec* codes and ter* codes are provisionally accepted; only tem*/tef*/tel* fail hard.
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
      const res = await client.request({
        command: "tx",
        transaction: txHash,
      });
      const validated = (res.result as { validated?: boolean }).validated === true;
      const meta = (res.result as { meta?: unknown }).meta;
      const resultCode =
        typeof meta === "object" && meta !== null && "TransactionResult" in meta
          ? String((meta as { TransactionResult: string }).TransactionResult)
          : "";

      if (!validated) continue;

      if (resultCode === "tesSUCCESS") {
        markPaid(sessionId, txHash);
      } else {
        markFailed(sessionId, `validated: ${resultCode || "unknown"}`);
      }
      return;
    } catch {
      // Transaction may not be visible yet; keep polling until deadline.
    }
  }
  markFailed(sessionId, "validation timeout");
}

function markSubmitted(sessionId: string, txHash: string): Session | undefined {
  return emit(sessionStore.update(sessionId, { status: "SUBMITTED", txHash }));
}
function markValidating(sessionId: string): Session | undefined {
  return emit(sessionStore.update(sessionId, { status: "VALIDATING" }));
}
function markPaid(sessionId: string, txHash: string): Session | undefined {
  return emit(sessionStore.update(sessionId, { status: "PAID", txHash }));
}
function markFailed(sessionId: string, _reason: string): Session | undefined {
  return emit(sessionStore.update(sessionId, { status: "FAILED" }));
}
function emit(session: Session | undefined): Session | undefined {
  if (session) sessionEvents.emit(session);
  return session;
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

function fakeTxHash(sessionId: string, txBlob: string): string {
  // Deterministic hex-ish string keyed by session + blob length so re-submissions
  // in mock mode stay idempotent enough for the demo.
  const seed = `${sessionId}:${txBlob.length}:${Date.now()}`;
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  const base = Math.abs(h).toString(16).padStart(8, "0").toUpperCase();
  return base.repeat(8).slice(0, 64);
}
