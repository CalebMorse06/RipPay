# ColdTap

Self-custody, in-person XRPL checkout using a Ledger Nano X hardware wallet.

## What it does

A merchant creates a checkout session. A buyer taps or scans to load it on their iPhone. The buyer reviews the payment and approves it with their Ledger Nano X — the private key never leaves the hardware wallet. The transaction is submitted on the XRP Ledger. The merchant sees live confirmation.

## Monorepo Structure

```
coldtap/
  apps/
    ios/        # React Native iPhone buyer app
    web/        # Merchant web app
  packages/
    shared/     # Canonical session types and API contract
```

## Shared Contract

All clients use types from `packages/shared`. See [`packages/shared/src/session.ts`](packages/shared/src/session.ts).

**SessionStatus:** `CREATED | AWAITING_BUYER | AWAITING_SIGNATURE | SUBMITTED | VALIDATING | PAID | FAILED | EXPIRED`

**API routes:**
- `POST /api/sessions` — create session
- `GET /api/sessions/:id` — get session
- `POST /api/sessions/:id/status` — update status
- `POST /api/sessions/:id/submit` — submit signed tx blob
- `GET /api/sessions/:id/events` — SSE stream

## Apps

- [iPhone Buyer App](apps/ios/README.md)
