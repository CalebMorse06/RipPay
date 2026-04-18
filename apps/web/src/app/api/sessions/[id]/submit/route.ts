import { NextResponse } from "next/server";
import { SubmitSessionSchema } from "@coldtap/shared";
import { sessionStore, TERMINAL_STATUSES } from "@/server/store";
import { submitSignedBlob } from "@/server/xrpl";

/**
 * Buyer (iOS) posts a hardware-signed XRPL transaction blob here.
 *
 * The backend records SUBMITTED with the tx hash immediately, then asynchronously
 * drives VALIDATING → PAID / FAILED via the XRPL layer. The iOS app does not wait
 * for final validation on this call — it subscribes to /events or polls the
 * session to observe the final state.
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

  const parsed = SubmitSessionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const { txHash } = await submitSignedBlob(id, parsed.data.txBlob);
    return NextResponse.json({ txHash, status: "SUBMITTED" });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Submit failed" },
      { status: 502 },
    );
  }
}
