import { NextResponse } from "next/server";
import { SubmitSignedSchema, type SubmitSignedResponse } from "@coldtap/shared";
import { sessionStore } from "@/server/store";
import { sessionEvents } from "@/server/events";
import { hashSignedBlob, submitSignedBlob, verifySignedBlob } from "@/server/xrpl";

/**
 * POST /api/sessions/:id/submit-signed
 *
 * Accepts a hex-encoded signed XRPL transaction blob from the iPhone app.
 * Before forwarding to the XRPL network the backend:
 *
 *   1. Confirms the session is still accepting a signature (not expired,
 *      not already terminal, not already submitted).
 *   2. Decodes the blob and verifies Destination / Amount / InvoiceID match
 *      this session. Any mismatch is rejected without being forwarded.
 *   3. Computes the tx hash locally so SUBMITTED is recorded with the final
 *      identifier, giving the merchant screen a stable reference immediately.
 *
 * Validation and final status (PAID / FAILED) are driven asynchronously by the
 * xrpl submit worker; clients observe those via /events or polling.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const session = sessionStore.get(id);
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  if (new Date(session.expiresAt).getTime() < Date.now()) {
    const expiredAt = new Date().toISOString();
    const expired = sessionStore.update(id, { status: "EXPIRED", expiredAt });
    if (expired) sessionEvents.emit(expired);
    return NextResponse.json({ error: "Session expired" }, { status: 410 });
  }

  if (session.status === "PAID") {
    return NextResponse.json(
      { error: "Session already paid", txHash: session.txHash },
      { status: 409 },
    );
  }
  if (session.status === "FAILED") {
    return NextResponse.json(
      { error: "Session already failed", failureReason: session.failureReason },
      { status: 409 },
    );
  }
  if (session.status === "SUBMITTED" || session.status === "VALIDATING") {
    return NextResponse.json(
      { error: `Transaction already in-flight (${session.status})`, txHash: session.txHash },
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

  const verified = await verifySignedBlob(parsed.data.txBlob, session);
  if (!verified.ok) {
    return NextResponse.json(
      { error: "Signed transaction did not match session", reason: verified.reason },
      { status: 422 },
    );
  }

  let txHash: string;
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
