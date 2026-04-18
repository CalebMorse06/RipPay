import type { Session, SessionStatus } from "@coldtap/shared";

export interface SessionStore {
  create(session: Session): Session;
  get(id: string): Session | undefined;
  update(id: string, patch: Partial<Session>): Session | undefined;
  list(): Session[];
}

class InMemoryStore implements SessionStore {
  private readonly sessions = new Map<string, Session>();

  create(session: Session): Session {
    this.sessions.set(session.id, session);
    return session;
  }

  get(id: string): Session | undefined {
    return this.sessions.get(id);
  }

  update(id: string, patch: Partial<Session>): Session | undefined {
    const current = this.sessions.get(id);
    if (!current) return undefined;
    const next: Session = {
      ...current,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    this.sessions.set(id, next);
    return next;
  }

  list(): Session[] {
    return Array.from(this.sessions.values());
  }
}

// Attach to globalThis so Next.js dev hot-reload does not wipe session state
// between edits — the module is re-evaluated but the object reference survives.
declare global {
  // eslint-disable-next-line no-var
  var __coldtapStore: InMemoryStore | undefined;
}

export const sessionStore: SessionStore =
  globalThis.__coldtapStore ?? (globalThis.__coldtapStore = new InMemoryStore());

export const ACTIVE_STATUSES: ReadonlySet<SessionStatus> = new Set([
  "CREATED",
  "AWAITING_BUYER",
  "AWAITING_SIGNATURE",
  "SUBMITTED",
  "VALIDATING",
]);

export const TERMINAL_STATUSES: ReadonlySet<SessionStatus> = new Set([
  "PAID",
  "FAILED",
  "EXPIRED",
]);
