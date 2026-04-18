import { NextResponse } from "next/server";
import { sessionStore } from "@/server/store";
import { sessionEvents } from "@/server/events";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const session = await sessionStore.get(id);
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  // Lazy-expire on read so demos don't depend on a background sweeper timer.
  if (
    session.status !== "PAID" &&
    session.status !== "FAILED" &&
    session.status !== "EXPIRED" &&
    new Date(session.expiresAt).getTime() < Date.now()
  ) {
    const expiredAt = new Date().toISOString();
    const expired = await sessionStore.update(id, { status: "EXPIRED", expiredAt });
    if (expired) {
      sessionEvents.emit(expired);
      return NextResponse.json(expired);
    }
  }

  return NextResponse.json(session);
}
