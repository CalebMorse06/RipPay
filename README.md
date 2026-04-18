# ColdTap

**Self-custody, in-person XRPL checkout.** Tap to initiate. Hardware-sign to pay.

A merchant creates a checkout session on the web. A buyer scans a QR on their iPhone, reviews the payment, and approves it on a Ledger Nano X — the private key never leaves the hardware wallet. The backend submits the signed transaction to XRPL and the merchant sees live confirmation.

> **This is not** Apple Pay, phone-as-card, or a shallow blockchain demo.
> **This is** session-based, hardware-signed, self-custody checkout over a real XRPL payment.

---

## Launch paths

The iPhone enters the checkout flow via one of two mechanisms. Both end at the same place — `GET /api/sessions/:id` followed by `POST /prepare` and `POST /submit-signed`. The backend contract does not care how the iPhone learned the session id.

1. **HTTPS QR (primary, always works).** Merchant session page encodes `https://<base>/s/<id>`. iPhone scans with the camera; a universal link opens the app. Manual session-id entry is available as a fallback on the same URL. This path is fully documented in `apps/ios/README.md` §3.
2. **Android HCE NFC tap (spike, additive).** Merchant runs the tiny Android app in `apps/android/`, which emulates an NFC card target. The iPhone reads one short APDU (`SESSION:<id>`) and enters the same flow. See `apps/android/README.md` for the APDU contract, device requirements, and routing caveats.

The NFC path is additive and does not replace the QR path. If NFC misbehaves on demo day, the QR on the merchant screen is still live.

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

**Rule:** the web app and the iPhone app never talk directly. They share state only via the backend, keyed by session ID. The backend owns `Destination`, `Amount`, and `InvoiceID` — the client cannot invent them and a mismatched signed blob is rejected.

---

## Repo layout

```
coldtap/
├── apps/
│   ├── web/                 Next.js 15 merchant app + API routes (backend)
│   │   └── src/server/xrpl/ prepare · verify · submit
│   └── ios/                 buyer app (separate agent)
├── packages/
│   └── shared/              canonical Session types, zod schemas, examples
├── package.json             npm workspaces
└── README.md                you are here
```

---

## Setup

```bash
# from the repo root
npm install
cp apps/web/.env.example apps/web/.env.local    # optional — defaults run mock mode
npm run dev                                     # http://localhost:3000
```

### Modes

| Env | Behavior |
|---|---|
| `XRPL_MODE=mock` (default) | Full lifecycle simulated: `SUBMITTED → VALIDATING → PAID` in ~3s. No network I/O. The `/submit` endpoint also accepts test blobs that won't decode, so curl-driven demos keep working. |
| `XRPL_MODE=real` + `XRPL_NETWORK=testnet` | Opens an `xrpl.Client` against testnet. `/prepare` autofills `Sequence` + `LastLedgerSequence` when the client sends `{account}`. `/submit-signed` decodes, verifies, submits, polls for validation, and classifies on `tesSUCCESS` vs. any other result. |

### Environment variables

See [`apps/web/.env.example`](./apps/web/.env.example) for the full list with defaults.

| Variable | Default | Purpose |
|---|---|---|
| `XRPL_MODE` | `mock` | `mock` or `real`. |
| `XRPL_NETWORK` | `testnet` | `testnet` or `mainnet`. Ignored in mock. |
| `XRPL_WS_URL` | network-derived | Override rippled WebSocket. |
| `XRPL_DEFAULT_FEE_DROPS` | `12` | Fee suggested in `/prepare`. |
| `XRPL_LEDGER_OFFSET` | `40` | Ledgers ahead to set `LastLedgerSequence`. |
| `PUBLIC_BASE_URL` | from request | Canonical public URL for QR / universal links. |
| `NEXT_PUBLIC_BASE_URL` | `http://localhost:3000` | Client-bundled fallback base URL. |

---

## API contract

All routes live under `apps/web/src/app/api/`. Types: [`packages/shared/src/session.ts`](./packages/shared/src/session.ts). Examples: [`packages/shared/src/examples.ts`](./packages/shared/src/examples.ts).

| Method | Route | Purpose |
|---|---|---|
| `POST` | `/api/sessions` | Merchant creates a session. Returns `Session` with `status=AWAITING_BUYER` and `network`. |
| `GET`  | `/api/sessions/:id` | Fetch current `Session`. Lazily transitions to `EXPIRED` past `expiresAt`. |
| `POST` | `/api/sessions/:id/prepare` | **Canonical integration path.** iOS posts `{account}`. Server returns a `PrepareSessionResponse` containing a canonical unsigned `Payment` with `Destination`, `Amount`, and `InvoiceID` fixed. Side effect: advances `AWAITING_BUYER → AWAITING_SIGNATURE`. |
| `POST` | `/api/sessions/:id/submit-signed` | iOS posts `{txBlob}` (hex). Server decodes the blob, verifies it matches the session, computes the tx hash, records `SUBMITTED`, and kicks off validation tracking. Returns `{txHash, status: "SUBMITTED"}`. |
| `POST` | `/api/sessions/:id/submit` | Legacy. In real mode it's a thin alias to `/submit-signed`. In mock mode it also accepts non-XRPL blobs so curl smoke tests keep working. |
| `POST` | `/api/sessions/:id/status` | Admin / demo tool for manual transitions. Prefer `/prepare` + `/submit-signed` for the real flow. |
| `GET`  | `/api/sessions/:id/events` | Server-Sent Events stream of `Session` snapshots on every change. Heartbeats every 15s. Closes when a terminal state is reached. |

### `SessionStatus`

```
CREATED · AWAITING_BUYER · AWAITING_SIGNATURE · SUBMITTED · VALIDATING · PAID · FAILED · EXPIRED
```

### Transitions

```
AWAITING_BUYER     ─(iOS: POST /prepare)──────▶  AWAITING_SIGNATURE
AWAITING_SIGNATURE ─(iOS: POST /submit-signed)▶  SUBMITTED
SUBMITTED          ─(backend: xrpl submit ok)─▶  VALIDATING
VALIDATING         ─(backend: tesSUCCESS)─────▶  PAID
VALIDATING         ─(backend: non-tes / timeout)▶ FAILED
any                ─(expiresAt passed)────────▶  EXPIRED
```

---

## Launch URL strategy

The QR encodes an HTTPS URL so it works without any app registration:

```
https://<base>/s/<sessionId>
```

- **iPhone with the ColdTap app** — the associated-domain universal-link rule intercepts the URL and opens the native app directly with the session id.
- **iPhone without the app, or any desktop browser** — the URL serves a lightweight buyer landing page (`apps/web/src/app/s/[id]/page.tsx`) that shows the checkout summary plus the raw session id for manual entry.

The `coldtap://session/<id>?api=<base>` custom URL scheme is still exported by `apps/web/src/lib/qr.ts` for simulator testing and can be re-enabled if the iOS build prefers a custom scheme during development.

---

## Deployment

This app is designed to deploy on Vercel without code changes.

```bash
# first time
vercel link            # project root: coldtap/apps/web
vercel env pull        # optional
vercel --prod
```

Set these in the Vercel project env:

```
XRPL_MODE=real
XRPL_NETWORK=testnet
PUBLIC_BASE_URL=https://<your-vercel-domain>
```

Notes:

- **SSE on Vercel.** `/api/sessions/:id/events` uses `runtime = "nodejs"` and emits a heartbeat every 15s. On the Hobby plan an individual function invocation is capped — if a session runs longer than the cap the connection will close and the client's polling fallback takes over. No code changes needed.
- **In-memory store.** Sessions live in process memory. On Vercel different invocations may land on different instances. For the hackathon demo this is fine (sessions are short; usually a single instance warm). For production, implement the `SessionStore` interface in `apps/web/src/server/store.ts` against Redis / Postgres / KV.
- **Custom domain.** Set `PUBLIC_BASE_URL` to your custom domain so the QR encodes it rather than the Vercel preview URL.

---

## Demo flow

1. Open `http://localhost:3000`. Create a session (merchant, item, amount, r-address).
2. You land on `/session/<id>`. The QR encodes `<base>/s/<id>`.
3. The iPhone app opens the URL (universal link) or the buyer types the session id. iOS calls `POST /prepare` with its buyer account. Backend returns the canonical unsigned Payment.
4. Buyer reviews, approves on Ledger Nano X. iOS posts `{txBlob}` to `/submit-signed`.
5. Backend verifies the blob (Destination / Amount / InvoiceID all match), submits to XRPL, polls for validation.
6. Merchant screen walks through `AWAITING_BUYER → AWAITING_SIGNATURE → SUBMITTED → VALIDATING → PAID` live.

---

## What's real vs. mocked

| Area | State |
|---|---|
| Session create / get | ✅ real, in-memory store |
| Expiry → `EXPIRED` | ✅ lazy transition on read |
| QR generation | ✅ real (`qrcode` npm) |
| SSE events + polling fallback | ✅ real, both transports wired |
| Manual status transitions | ✅ real |
| Canonical unsigned tx from `/prepare` | ✅ real; autofills `Sequence` / `LastLedgerSequence` in real mode |
| Signed-blob verification | ✅ real — decodes via `xrpl.decode` and checks Destination / Amount / InvoiceID |
| XRPL submission (`XRPL_MODE=real`) | ✅ real — submit + validation polling + result classification |
| XRPL submission (`XRPL_MODE=mock`) | ✅ simulated progression for demo reliability |
| Persistence | ⚠️ in-memory only — resets on restart. Intentional for hackathon. Swap `SessionStore` for SQLite/Postgres later. |
| `/pay/[id]` Android buyer web | ❌ not built — optional; native iOS is the primary buyer path. |

---

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the web app on port 3000 |
| `npm run build` | Production build of the web app |
| `npm run start` | Serve the production build |
| `npm run typecheck` | Type-check both workspaces |
| `npm test -w apps/web` | Run the vitest suite (verify helpers + routes) |

---

## iOS agent

Integration docs for the separate iOS / Ledger agent are in [`apps/ios/README.md`](./apps/ios/README.md). They describe exactly which routes to call, what the signed tx must contain, and what the backend will reject.
