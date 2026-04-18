import { NextResponse } from "next/server";
import { SubmitSignedSchema, type SubmitSignedResponse } from "@coldtap/shared";
import { sessionStore, TERMINAL_STATUSES } from "@/server/store";
import { sessionEvents } from "@/server/events";
import { getXrplMode } from "@/server/config";
import { hashSignedBlob, submitSignedBlob, verifySignedBlob } from "@/server/xrpl";

/**
 * Legacy submit endpoint — prefer POST /api/sessions/:id/submit-signed.
 *
 * In real mode this is a thin alias: same verification, same XRPL submit path.
 * In mock mode it additionally accepts an unverifiable blob (no InvoiceID match
 * required) so that demo tooling and curl smoke tests keep working without
 * constructing a real signed transaction.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const existing = sessionStore.get(id);
  if (!existing) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }
  if (TERMINAL_STATUSES.has(existing.status)) {
    return NextResponse.json(
      { error: `Session is already terminal (${existing.status})` },
      { status: 409 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = SubmitSignedSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const isMock = getXrplMode() === "mock";

  let txHash: string;
  if (isMock && !looksLikeRealXrplBlob(parsed.data.txBlob)) {
    // Dev/demo path: fabricate a deterministic-looking tx hash so downstream
    // code and SSE clients observe a stable identifier through the lifecycle.
    txHash = fakeTxHashFor(id, parsed.data.txBlob);
  } else {
    const verified = await verifySignedBlob(parsed.data.txBlob, existing);
    if (!verified.ok) {
      return NextResponse.json(
        { error: "Signed transaction did not match session", reason: verified.reason },
        { status: 422 },
      );
    }
    try {
      txHash = await hashSignedBlob(parsed.data.txBlob);
    } catch (err) {
      return NextResponse.json(
        {
          error: "Could not hash signed transaction",
          detail: err instanceof Error ? err.message : String(err),
        },
        { status: 422 },
      );
    }
  }

  try {
    await submitSignedBlob({ sessionId: id, txBlob: parsed.data.txBlob, txHash });
  } catch (err) {
    return NextResponse.json(
      {
        error: "Submit failed",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 502 },
    );
  }

  const response: SubmitSignedResponse = { txHash, status: "SUBMITTED" };
  return NextResponse.json(response);
}

function looksLikeRealXrplBlob(hex: string): boolean {
  // Real XRPL signed blobs start with TransactionType Payment (0x12 0x00 0x00)
  // and include a SigningPubKey (tag 0x73) and TxnSignature (tag 0x74). A lazy
  // but effective check for "this isn't the curl-smoke-test fake blob" is a
  // length floor — signed XRPL transactions are well over 100 hex chars.
  return hex.length >= 200;
}

function fakeTxHashFor(sessionId: string, txBlob: string): string {
  const seed = `${sessionId}:${txBlob.length}:${Date.now()}`;
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  const base = Math.abs(h).toString(16).padStart(8, "0").toUpperCase();
  return base.repeat(8).slice(0, 64);
}

// Re-export with the noop suppression hint so ESLint doesn't complain when
// this file is only kept for backwards compatibility.
void sessionEvents;
