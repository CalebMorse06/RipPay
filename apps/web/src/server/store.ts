import type { Session, SessionStatus } from "@coldtap/shared";

declare global {
  // eslint-disable-next-line no-var
  var __coldtapStore: import("./store").SessionStore | undefined;
}

const SESSION_TTL_SEC = 3600; // 1 hour — well beyond the 10-min session expiry

export interface SessionStore {
  create(session: Session): Promise<Session>;
  get(id: string): Promise<Session | undefined>;
  update(id: string, patch: Partial<Session>): Promise<Session | undefined>;
  list(): Promise<Session[]>;
}

// ── In-memory implementation (local dev / tests) ─────────────────────────────

class InMemoryStore implements SessionStore {
  private readonly sessions = new Map<string, Session>();

  async create(session: Session): Promise<Session> {
    this.sessions.set(session.id, session);
    return session;
  }

  async get(id: string): Promise<Session | undefined> {
    return this.sessions.get(id);
  }

  async update(id: string, patch: Partial<Session>): Promise<Session | undefined> {
    const current = this.sessions.get(id);
    if (!current) return undefined;
    const next: Session = { ...current, ...patch, updatedAt: new Date().toISOString() };
    this.sessions.set(id, next);
    return next;
  }

  async list(): Promise<Session[]> {
    return Array.from(this.sessions.values());
  }
}

// ── Vercel KV implementation (production) ────────────────────────────────────

class KvStore implements SessionStore {
  private kv: import("@upstash/redis").Redis;

  constructor(kv: import("@upstash/redis").Redis) {
    this.kv = kv;
  }

  async create(session: Session): Promise<Session> {
    await this.kv.set(`session:${session.id}`, session, { ex: SESSION_TTL_SEC });
    return session;
  }

  async get(id: string): Promise<Session | undefined> {
    const val = await this.kv.get<Session>(`session:${id}`);
    return val ?? undefined;
  }

  async update(id: string, patch: Partial<Session>): Promise<Session | undefined> {
    const current = await this.get(id);
    if (!current) return undefined;
    const next: Session = { ...current, ...patch, updatedAt: new Date().toISOString() };
    await this.kv.set(`session:${id}`, next, { ex: SESSION_TTL_SEC });
    return next;
  }

  async list(): Promise<Session[]> {
    return [];
  }
}

// ── Store singleton ───────────────────────────────────────────────────────────

function createStore(): SessionStore {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    const { Redis } = require("@upstash/redis") as typeof import("@upstash/redis");
    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
    return new KvStore(redis);
  }

  // Fallback: in-memory with globalThis so Next.js hot-reload doesn't wipe state.
  return (globalThis.__coldtapStore as InMemoryStore | undefined) ?? (globalThis.__coldtapStore = new InMemoryStore());
}

export const sessionStore: SessionStore = createStore();

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
