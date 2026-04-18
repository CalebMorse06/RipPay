import type { Session } from "@coldtap/shared";

type Subscriber = (session: Session) => void;

class SessionEventBus {
  private readonly subs = new Map<string, Set<Subscriber>>();

  subscribe(id: string, cb: Subscriber): () => void {
    let set = this.subs.get(id);
    if (!set) {
      set = new Set();
      this.subs.set(id, set);
    }
    set.add(cb);
    return () => {
      const current = this.subs.get(id);
      if (!current) return;
      current.delete(cb);
      if (current.size === 0) this.subs.delete(id);
    };
  }

  emit(session: Session): void {
    const set = this.subs.get(session.id);
    if (!set) return;
    for (const cb of set) {
      try {
        cb(session);
      } catch {
        // Never let one bad subscriber break the bus.
      }
    }
  }
}

declare global {
  // eslint-disable-next-line no-var
  var __coldtapEvents: SessionEventBus | undefined;
}

export const sessionEvents: SessionEventBus =
  globalThis.__coldtapEvents ?? (globalThis.__coldtapEvents = new SessionEventBus());
