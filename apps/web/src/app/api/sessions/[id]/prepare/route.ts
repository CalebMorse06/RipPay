import { NextResponse } from "next/server";
import { PrepareSessionSchema, type PrepareSessionResponse } from "@coldtap/shared";
import { sessionStore } from "@/server/store";
import { sessionEvents } from "@/server/events";
import { buildUnsignedPayment } from "@/server/xrpl";

/**
 * POST /api/sessions/:id/prepare
 *
 * Returns a canonical unsigned Payment for the session. The client (iOS app)
 * passes its XRPL source account; the backend owns Destination, Amount, and
 * the InvoiceID that binds the tx to this session.
 *
 * Side effect: advances AWAITING_BUYER → AWAITING_SIGNATURE. The iOS app
 * does not need to call /status separately — opening the prepare endpoint
 * signals that the buyer has the session in hand and is about to sign.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const session = await sessionStore.get(id);
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  if (new Date(session.expiresAt).getTime() < Date.now()) {
    const expiredAt = new Date().toISOString();
    const expired = await sessionStore.update(id, { status: "EXPIRED", expiredAt });
    if (expired) sessionEvents.emit(expired);
    return NextResponse.json({ error: "Session expired" }, { status: 410 });
  }

  if (session.status === "PAID" || session.status === "FAILED") {
    return NextResponse.json(
      { error: `Session is already terminal (${session.status})` },
      { status: 409 },
    );
  }

  let body: unknown = {};
  try {
    body = (await req.json().catch(() => ({}))) ?? {};
  } catch {
    /* empty body is fine */
  }

  const parsed = PrepareSessionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  let built;
  try {
    built = await buildUnsignedPayment(session, parsed.data.account);
  } catch (err) {
    return NextResponse.json(
      {
        error: "Failed to build unsigned transaction",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 502 },
    );
  }

  // Advance the session so the merchant screen shows "Awaiting signature".
  if (session.status === "AWAITING_BUYER") {
    const advanced = await sessionStore.update(id, { status: "AWAITING_SIGNATURE" });
    if (advanced) sessionEvents.emit(advanced);
  }

  const response: PrepareSessionResponse = {
    sessionId: session.id,
    network: session.network,
    expiresAt: session.expiresAt,
    merchant: {
      name: session.merchantName,
      itemName: session.itemName,
      amountDrops: session.amountDrops,
      amountDisplay: session.amountDisplay,
      memo: session.memo,
    },
    unsignedTx: built.unsignedTx,
    immutableFields: ["TransactionType", "Destination", "Amount", "InvoiceID", "Memos"],
    autofilled: built.autofilled,
  };
  return NextResponse.json(response);
}
