import type { Session } from "@coldtap/shared";
import { sessionStore } from "@/server/store";
import { sessionEvents } from "@/server/events";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Server-Sent Events stream of Session snapshots.
 *
 * One `data:` frame is emitted on every status/field change. The first frame is
 * the current state at the time of connection, so clients never miss a transition
 * that already happened. If the session reaches a terminal state the stream closes.
 *
 * Clients should still implement a polling fallback against GET /api/sessions/:id
 * in case the SSE connection drops (mobile network transitions, proxy buffers, etc).
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const initial = await sessionStore.get(id);
  if (!initial) {
    return new Response("Session not found", { status: 404 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (session: Session) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(session)}\n\n`));
      };

      // Emit the current state immediately.
      send(initial);

      const TERMINAL = new Set(["PAID", "FAILED", "EXPIRED"]);
      let closed = false;
      const unsubscribe = sessionEvents.subscribe(id, (session) => {
        if (closed) return;
        send(session);
        if (TERMINAL.has(session.status)) {
          closed = true;
          unsubscribe();
          heartbeat && clearInterval(heartbeat);
          try {
            controller.close();
          } catch {
            /* already closed */
          }
        }
      });

      // Heartbeat comment every 15s keeps proxies from closing idle connections.
      const heartbeat: ReturnType<typeof setInterval> | null = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`: heartbeat\n\n`));
        } catch {
          /* stream gone */
        }
      }, 15_000);

      // If the client aborts, clean up.
      const abort = () => {
        closed = true;
        unsubscribe();
        if (heartbeat) clearInterval(heartbeat);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };
      req.signal?.addEventListener?.("abort", abort);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
