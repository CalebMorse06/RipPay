import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { Wallet } from "xrpl";
import type { PrepareSessionResponse, Session } from "@coldtap/shared";
import { sessionStore } from "@/server/store";
import { sessionEvents } from "@/server/events";
import { invoiceIdFor, sessionMemo } from "@/server/invoice";

/**
 * Full-lifecycle integration test against the Next.js route handlers. Mock
 * mode only — the XRPL submit path is simulated, but /prepare and
 * /submit-signed run their real code paths (including blob decoding and
 * session-id binding).
 */

const DEST = "rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe";

// Route handlers — imported at top level so vitest resolves `@coldtap/shared`
// once before the sessions are created.
let POST_create: (req: Request) => Promise<Response>;
let GET_one: (req: Request, ctx: { params: Promise<{ id: string }> }) => Promise<Response>;
let POST_prepare: (req: Request, ctx: { params: Promise<{ id: string }> }) => Promise<Response>;
let POST_submitSigned: (req: Request, ctx: { params: Promise<{ id: string }> }) => Promise<Response>;

beforeAll(async () => {
  process.env.XRPL_MODE = "mock";
  ({ POST: POST_create } = await import("./route"));
  ({ GET: GET_one } = await import("./[id]/route"));
  ({ POST: POST_prepare } = await import("./[id]/prepare/route"));
  ({ POST: POST_submitSigned } = await import("./[id]/submit-signed/route"));
});

function mkCtx(id: string) {
  return { params: Promise.resolve({ id }) };
}

async function createSession(overrides?: Partial<{ amountDrops: string }>): Promise<Session> {
  const body = {
    merchantName: "Flow Test",
    itemName: "Widget",
    amountDrops: overrides?.amountDrops ?? "1000000",
    destinationAddress: DEST,
  };
  const req = new Request("http://localhost/api/sessions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const res = await POST_create(req);
  expect(res.status).toBe(201);
  return res.json() as Promise<Session>;
}

afterEach(() => {
  // Detach any subscriptions left over from SSE tests that didn't run here.
  void sessionEvents;
});

describe("create + prepare + submit-signed flow", () => {
  it("walks AWAITING_BUYER → AWAITING_SIGNATURE → SUBMITTED → PAID in mock mode", async () => {
    const session = await createSession();
    expect(session.status).toBe("AWAITING_BUYER");
    expect(session.network).toBe("mock");

    // prepare
    const wallet = Wallet.generate();
    const prepRes = await POST_prepare(
      new Request(`http://localhost/api/sessions/${session.id}/prepare`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ account: wallet.classicAddress }),
      }),
      mkCtx(session.id),
    );
    expect(prepRes.status).toBe(200);
    const prepared = (await prepRes.json()) as PrepareSessionResponse;
    expect(prepared.unsignedTx.Destination).toBe(DEST);
    expect(prepared.unsignedTx.Amount).toBe("1000000");
    expect(prepared.unsignedTx.InvoiceID).toBe(invoiceIdFor(session.id));
    expect(prepared.immutableFields).toContain("InvoiceID");

    // Session should now be AWAITING_SIGNATURE
    const afterPrepare = await sessionStore.get(session.id);
    expect(afterPrepare?.status).toBe("AWAITING_SIGNATURE");

    // Sign the returned unsigned tx
    const { tx_blob } = wallet.sign({
      TransactionType: "Payment",
      Account: wallet.classicAddress,
      Destination: DEST,
      Amount: "1000000",
      InvoiceID: prepared.unsignedTx.InvoiceID,
      Fee: prepared.unsignedTx.Fee,
      Sequence: 1,
      LastLedgerSequence: 1_000_000,
      Memos: [sessionMemo(session.id)],
      SigningPubKey: wallet.publicKey,
    });

    // submit-signed
    const submitRes = await POST_submitSigned(
      new Request(`http://localhost/api/sessions/${session.id}/submit-signed`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ txBlob: tx_blob }),
      }),
      mkCtx(session.id),
    );
    expect(submitRes.status).toBe(200);
    const submitted = (await submitRes.json()) as { status: string; txHash: string };
    expect(submitted.status).toBe("SUBMITTED");
    expect(submitted.txHash).toMatch(/^[0-9A-F]{64}$/);

    // Mock progression: VALIDATING after ~1.2s, PAID after ~3.2s
    await wait(4000);
    const getRes = await GET_one(new Request("http://localhost"), mkCtx(session.id));
    const final = (await getRes.json()) as Session;
    expect(final.status).toBe("PAID");
    expect(final.txHash).toBe(submitted.txHash);
    expect(final.paidAt).toBeTruthy();
  });

  it("rejects submit-signed when Amount is tampered after prepare", async () => {
    const session = await createSession({ amountDrops: "500000" });
    const wallet = Wallet.generate();

    await POST_prepare(
      new Request(`http://localhost/api/sessions/${session.id}/prepare`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ account: wallet.classicAddress }),
      }),
      mkCtx(session.id),
    );

    // Attacker signs a DIFFERENT amount.
    const tampered = wallet.sign({
      TransactionType: "Payment",
      Account: wallet.classicAddress,
      Destination: DEST,
      Amount: "999999", // does not match the session
      InvoiceID: invoiceIdFor(session.id),
      Fee: "12",
      Sequence: 1,
      LastLedgerSequence: 1_000_000,
      SigningPubKey: wallet.publicKey,
    });

    const res = await POST_submitSigned(
      new Request(`http://localhost/api/sessions/${session.id}/submit-signed`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ txBlob: tampered.tx_blob }),
      }),
      mkCtx(session.id),
    );
    expect(res.status).toBe(422);
    const body = (await res.json()) as { error: string; reason: string };
    expect(body.reason).toMatch(/Amount mismatch/);
    const stored = await sessionStore.get(session.id);
    expect(stored?.status).toBe("AWAITING_SIGNATURE"); // not advanced
  });

  it("returns 404 for an unknown session id", async () => {
    const res = await GET_one(new Request("http://localhost"), mkCtx("s_does_not_exist"));
    expect(res.status).toBe(404);
  });

  it("rejects prepare on an expired session with 410", async () => {
    const session = await createSession();
    // Force expiry by rewriting the store entry directly.
    sessionStore.update(session.id, {
      expiresAt: new Date(Date.now() - 1000).toISOString(),
    });

    const res = await POST_prepare(
      new Request(`http://localhost/api/sessions/${session.id}/prepare`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ account: Wallet.generate().classicAddress }),
      }),
      mkCtx(session.id),
    );
    expect(res.status).toBe(410);
    const stored = await sessionStore.get(session.id);
    expect(stored?.status).toBe("EXPIRED");
  });
});

function wait(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
