# ColdTap

**Self-custody, in-person XRPL checkout.** Tap to initiate. Hardware-sign to pay.

A merchant creates a checkout session on the web. A buyer taps or scans a QR with their iPhone, reviews the payment, and approves it on a Ledger Nano X — the private key never leaves the hardware wallet. The backend submits the signed transaction to XRPL and the merchant sees live confirmation.

> **This is not** Apple Pay, phone-as-card, or a shallow blockchain demo.
> **This is** session-based, hardware-signed, self-custody checkout over a real XRPL payment.

---

## Architecture

```
┌──────────────────┐        ┌─────────────────────────────────┐        ┌───────────────────┐
│  Merchant (web)  │◀──────▶│     Backend (Next.js API)       │◀──────▶│  Buyer (iPhone)   │
│   apps/web       │  HTTP  │    source of truth for status   │  HTTP  │    apps/ios       │
│   QR + live view │  +SSE  │   InMemoryStore · SSE · XRPL    │        │   Ledger signing  │
└──────────────────┘        └────────────────┬────────────────┘        └───────────────────┘
                                             │
                                             ▼
                                       ┌───────────┐
                                       │  XRPL     │  xrpl npm SDK
                                       │  testnet  │  wss://s.altnet.rippletest.net:51233
                                       └───────────┘
```

**Rule:** the web app and the iPhone app never talk directly. They share state only via the backend, keyed by session ID.

---

## Repo layout

```
coldtap/
├── apps/
│   ├── web/                 Next.js 15 merchant app + API routes (backend)
│   └── ios/                 buyer app (separate agent)
├── packages/
│   └── shared/              canonical Session types, zod schemas, examples
├── package.json             npm workspaces
├── tsconfig.base.json
└── README.md                you are here
```

---

## Setup

```bash
# from the repo root
npm install
npm run dev                  # starts the web app at http://localhost:3000
```

### Environment

Copy or set the following when you want to run against real XRPL:

| Variable | Default | Meaning |
|---|---|---|
| `XRPL_MODE` | `mock` | `mock` simulates SUBMITTED→VALIDATING→PAID; `real` uses the XRPL SDK |
| `XRPL_WS_URL` | `wss://s.altnet.rippletest.net:51233` | XRPL WebSocket endpoint (testnet by default) |
| `NEXT_PUBLIC_BASE_URL` | inferred from `window.location.origin` | Used in the QR payload as `api=...` so the iOS app knows where to call |

---

## Canonical API contract

All routes live under `apps/web/src/app/api/`. The shared types are in `packages/shared/src/session.ts`.

| Method | Route | Purpose |
|---|---|---|
| `POST` | `/api/sessions` | Merchant creates a session. Body: `CreateSessionRequest`. Returns `Session` with status `AWAITING_BUYER`. |
| `GET`  | `/api/sessions/:id` | Fetch current `Session`. Lazily transitions to `EXPIRED` when `expiresAt` has passed. |
| `POST` | `/api/sessions/:id/submit` | Buyer (iOS) posts a signed XRPL tx blob. Returns `{txHash, status: "SUBMITTED"}`. Backend then drives `VALIDATING → PAID / FAILED`. |
| `POST` | `/api/sessions/:id/status` | Manual status override. Used by iOS to advance `AWAITING_BUYER → AWAITING_SIGNATURE`, and by demo tooling. |
| `GET`  | `/api/sessions/:id/events` | Server-Sent Events stream of `Session` snapshots on every change. Closes when a terminal state is reached. |

### `SessionStatus`

```
CREATED · AWAITING_BUYER · AWAITING_SIGNATURE · SUBMITTED · VALIDATING · PAID · FAILED · EXPIRED
```

### Transitions

```
AWAITING_BUYER  ──(iOS: POST /status)───▶  AWAITING_SIGNATURE
AWAITING_SIGN.  ──(iOS: POST /submit)──▶  SUBMITTED
SUBMITTED       ──(backend: XRPL pool)─▶  VALIDATING
VALIDATING      ──(backend: tesSUCCESS)▶  PAID
VALIDATING      ──(backend: non-tes / timeout)──▶  FAILED
any             ──(expiresAt passed)───▶  EXPIRED
```

### Example payloads

See [`packages/shared/src/examples.ts`](./packages/shared/src/examples.ts) for a full set of copy-pasteable requests and responses.

---

## Demo flow

1. Open `http://localhost:3000`. Fill in merchant, item, amount, XRPL destination, (optional) memo. Submit.
2. You land on `/session/<id>`. The QR encodes `coldtap://session/<id>?api=http://localhost:3000`. The raw session ID is printed beneath the QR for manual entry.
3. The buyer (iPhone) scans the QR, or types the session ID. The iOS app fetches `/api/sessions/<id>`, shows the payment summary, and (on Approve) calls `POST /status` to advance to `AWAITING_SIGNATURE`.
4. The buyer approves on the Ledger Nano X. The iOS app gets a signed blob and posts it to `POST /submit`.
5. Backend records `SUBMITTED` with the tx hash, walks to `VALIDATING`, then `PAID` (or `FAILED`). The merchant page updates live through SSE (polling fallback).

---

## What's real vs. mocked

| Area | State |
|---|---|
| Session create / get | ✅ real, backed by in-memory store |
| Expiry → `EXPIRED` | ✅ lazy transition on read |
| QR generation | ✅ real (`qrcode` npm package) |
| SSE events + polling fallback | ✅ real |
| Manual status transitions | ✅ real |
| Submit endpoint | ✅ real — validates body, writes `SUBMITTED`, drives progression |
| XRPL submission (`XRPL_MODE=real`) | ✅ implemented via `xrpl` SDK; tested by running against testnet |
| XRPL submission (`XRPL_MODE=mock`, default) | ✅ simulated progression for demo reliability |
| Persistence | ⚠️ in-memory only — resets on server restart. Intentional for hackathon; swap the `SessionStore` interface for SQLite/Postgres later. |
| `/pay/[id]` Android buyer web | ❌ not built — optional, native iOS is the primary buyer path. |

---

## XRPL integration notes / TODO

- **Tx hash vs. signed blob.** The iOS app signs via Ledger and posts the resulting tx blob (hex). The backend derives the hash with `hashes.hashSignedTx` from the `xrpl` SDK, so both sides agree on the identifier before validation completes.
- **Validation strategy.** Real mode polls the `tx` command every 2s up to a 60s deadline, checks `validated === true`, and classifies on `meta.TransactionResult`. Subscribing to the `transactions` stream for the destination address would be marginally more efficient — currently polling for simplicity. TODO.
- **Failure classification.** `tes*/tec*/ter*` are provisionally accepted on submit. Final classification happens only from the validated ledger metadata. `tem*/tef*/tel*` at submit are treated as immediate `FAILED`.
- **Fees and LastLedgerSequence.** Handled by the iOS/Ledger flow when constructing the tx. The backend does not currently re-check or rebuild the transaction.

---

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the web app on port 3000 |
| `npm run build` | Production build of the web app |
| `npm run start` | Serve the production build |
| `npm run typecheck` | Type-check both workspaces |

---

## Design decisions

- **Next.js App Router, co-located API routes.** Single deployable unit for demo simplicity; cleanly splittable later.
- **In-memory store behind a `SessionStore` interface.** Demo-reliable, zero external dependencies; swap for SQLite/Postgres by implementing the same interface.
- **Polling first, SSE additive.** Guarantees the iOS app can integrate without implementing SSE. SSE is a nice-to-have for the merchant screen.
- **`coldtap://` custom URL scheme in the QR.** iOS app handles it natively; web fallback could be added via a universal link if needed.
- **Testnet only.** Hardcoded WebSocket endpoint. Mainnet would require explicit configuration.

---

## Working together

If you are the iOS agent: read [`apps/ios/README.md`](./apps/ios/README.md) and [`packages/shared/src`](./packages/shared/src). Everything the backend expects is documented there. Do not invent new routes or statuses — the contract is frozen.
