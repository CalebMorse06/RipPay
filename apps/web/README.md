# RipPay — Merchant Web App + Backend

Next.js 15 app that serves three audiences:

1. **Merchants** — dashboard for creating checkout sessions, watching them go green live (SSE), and reviewing history.
2. **Buyers on a browser** — a WebBluetooth-based Ledger-signing flow at `/pay/:id` (Flow C in `DEMO.md`) so you can complete a real XRPL testnet payment from Chrome on Android without installing an app.
3. **All clients** — the HTTP + SSE backend the iOS and Android apps talk to.

The backend and the frontend live in the same Next.js project. Backend handlers are under `src/app/api/`, backend-only modules under `src/server/`.

---

## API surface

All request/response types are defined in [`packages/shared/src/session.ts`](../../packages/shared/src/session.ts) — the single source of truth shared across iOS, Android, and web.

| Method | Route | Purpose |
|---|---|---|
| `POST` | `/api/sessions` | Create a checkout session (`CREATED` → `AWAITING_BUYER`). |
| `GET`  | `/api/sessions/:id` | Full session record. |
| `POST` | `/api/sessions/:id/status` | Advance status (buyer-opened → `AWAITING_SIGNATURE`, etc.). |
| `POST` | `/api/sessions/:id/prepare` | Return the canonical unsigned XRPL `Payment`. Autofills `Sequence` and `LastLedgerSequence` from the network when in real mode. |
| `POST` | `/api/sessions/:id/submit-signed` | Accept a signed `tx_blob`, decode + verify it server-side, compute hash, mark `SUBMITTED`, submit to XRPL, poll validation (via Next.js `after()`). |
| `POST` | `/api/sessions/:id/submit`    | Legacy alias — some older clients call this. Internally routes to the signed-submit path. |
| `GET`  | `/api/sessions/:id/events` | Server-Sent Events stream for live merchant dashboard updates. Falls back to polling when SSE is unavailable. |
| `GET`  | `/api/health` | Liveness check. |

### Verification done server-side on every submission

Before any blob is forwarded to rippled, [`server/xrpl/verify.ts`](./src/server/xrpl/verify.ts) decodes it and rejects unless **all four** hold:

- `TransactionType === "Payment"` and has both `TxnSignature` and `SigningPubKey`
- `Destination` matches the session's `destinationAddress`
- `Amount` (XRP drops as string) matches the session's `amountDrops` exactly
- `InvoiceID === SHA256(sessionId)` — this binds the signed blob to a single session; a blob signed for one checkout cannot be replayed against another

---

## XRPL integration

Backend XRPL logic lives entirely under [`src/server/xrpl/`](./src/server/xrpl/):

- **`prepare.ts`** — builds the unsigned Payment. In real mode, opens an `xrpl.Client` over WebSocket, calls `account_info` for the buyer's current `Sequence`, calls `ledger_current`, and sets `LastLedgerSequence = current + XRPL_LEDGER_OFFSET` (default 40 ledgers ≈ 50s validity window).
- **`verify.ts`** — `decode(tx_blob)` from xrpl.js (binary codec), schema and identity checks above, and `hashes.hashSignedTx` for the tx hash.
- **`submit.ts`** — minimal JSON-RPC client to rippled. Chose HTTP over WebSocket because Vercel serverless freezes between invocations and stale WebSockets surface as "WebSocket is closed" on the second `request()`. Validation tracker polls `tx` by hash every 2s for up to 50s (ample headroom under Vercel's 60s timeout), inspects `meta.TransactionResult`, and writes `PAID` or `FAILED`.
- **`config.ts`** — single-source env reads. `XRPL_MODE=mock|real`, `XRPL_NETWORK=testnet|mainnet`, overrides for RPC/WS URLs, fee, ledger offset.

See the [root README](../../README.md#xrpl-integration) for the per-primitive breakdown.

---

## Environment

Copy `.env.example` → `.env.local`. Every variable is optional — defaults keep mock mode running.

| Variable | Default | Notes |
|---|---|---|
| `XRPL_MODE` | `mock` | `real` submits to the live network. |
| `XRPL_NETWORK` | `testnet` | `mainnet` is supported but the hackathon build targets testnet. |
| `XRPL_WS_URL` | `wss://s.altnet.rippletest.net:51233` | Used for `Sequence`/`LastLedgerSequence` autofill only. |
| `XRPL_RPC_URL` | `https://s.altnet.rippletest.net:51234` | Preferred for submit/validation on serverless. |
| `XRPL_DEFAULT_FEE_DROPS` | `12` | Reference cost is 10; 12 gives headroom. |
| `XRPL_LEDGER_OFFSET` | `40` | LastLedgerSequence = current + offset (~50s validity). |
| `PUBLIC_BASE_URL` | derived from request | Set on Vercel for QR code generation. |

---

## Local dev

```bash
# from monorepo root
npm install
npm run dev -w apps/web    # starts Next.js on http://localhost:3000
```

Useful routes while developing:

- `/` — merchant dashboard (create session)
- `/session/:id` — merchant-side live view (SSE)
- `/pay/:id` — browser buyer flow (WebBluetooth + Ledger Nano X)
- `/s/:id`   — universal-link landing for the native iOS app

---

## Type-check and tests

```bash
npm run typecheck          # from monorepo root, types the whole workspace
npm run lint -w apps/web   # lint just this package
npm run test -w apps/web   # vitest — unit tests for session flow, verify.ts
```

---

## Deployment

Deployed to Vercel at [`coldtap-web.vercel.app`](https://coldtap-web.vercel.app) against XRPL testnet in real mode (`XRPL_MODE=real`, `XRPL_NETWORK=testnet`). Production-relevant settings:

- **Node runtime** for every route — `runtime = "nodejs"` on the `api/sessions/*` handlers so `xrpl` (which uses Node crypto) can load.
- **`maxDuration = 60`** on `submit-signed` so `after()` has headroom for validation polling.
- **`PUBLIC_BASE_URL`** set to the Vercel URL so QR codes render absolute links.

---

## File map

```
apps/web/
├── src/
│   ├── app/
│   │   ├── page.tsx                 # merchant dashboard (create session)
│   │   ├── session/[id]/            # merchant live view (SSE)
│   │   ├── pay/[id]/                # browser buyer (WebBluetooth + Ledger)
│   │   ├── s/[id]/page.tsx          # universal link landing for iOS app
│   │   └── api/
│   │       ├── sessions/            # create + list
│   │       ├── sessions/[id]/       # get, events (SSE), status, prepare,
│   │       │                        # submit-signed, submit (legacy)
│   │       └── health/
│   ├── server/
│   │   ├── xrpl/
│   │   │   ├── prepare.ts           # unsigned Payment builder + autofill
│   │   │   ├── verify.ts            # decode + reject-unless-bound checks
│   │   │   ├── submit.ts            # JSON-RPC submit + validation tracker
│   │   │   └── index.ts
│   │   ├── invoice.ts               # SHA256(sessionId) → InvoiceID; Memo encoding
│   │   ├── config.ts                # env reads (XRPL_MODE, NETWORK, URLs, fee)
│   │   ├── rates.ts                 # XRP/USD rate cache
│   │   ├── events.ts                # in-process event bus → SSE
│   │   ├── store.ts                 # session store (in-memory / Redis)
│   │   └── invoice.ts
│   ├── lib/
│   │   ├── ledger.ts                # WebBluetooth + hw-app-xrp
│   │   └── sign.ts                  # encode / build signed blob on the web client
│   └── components/
└── WEB_LEDGER.md                    # real-device test runbook for Flow C
```
