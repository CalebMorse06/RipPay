import { NextResponse } from "next/server";
import { StatusUpdateSchema } from "@coldtap/shared";
import { sessionStore, TERMINAL_STATUSES } from "@/server/store";
import { sessionEvents } from "@/server/events";

/**
 * Manual status transition endpoint.
 *
 * Used by:
 *   - the iOS app to advance AWAITING_BUYER → AWAITING_SIGNATURE when the buyer
 *     opens the approval screen on their phone
 *   - demo/ops tools to drive a session by hand (useful during the hackathon
 *     demo as a fallback if real XRPL signing is unavailable)
 *
 * The real submit flow (iOS posts a signed tx blob) goes through /submit instead,
 * which drives SUBMITTED → VALIDATING → PAID / FAILED internally.
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

  const parsed = StatusUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const updated = sessionStore.update(id, {
    status: parsed.data.status,
    ...(parsed.data.txHash ? { txHash: parsed.data.txHash } : {}),
  });
  if (!updated) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  sessionEvents.emit(updated);
  return NextResponse.json(updated);
}
