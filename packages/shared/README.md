# @coldtap/shared

TypeScript types and Zod schemas shared across all RipPay apps (iOS, Android helper scripts, web backend + frontend). This package is **the API contract** — if it's not defined here, it isn't part of the protocol.

> Package name is `@coldtap/shared` for monorepo-import continuity; the product is branded RipPay. See the [root README](../../README.md#brand-note).

## Files

| File | What's in it |
|---|---|
| [`src/session.ts`](./src/session.ts) | `Session`, `SessionStatus`, `UnsignedPayment`, and all request/response types for the HTTP API (`POST /api/sessions`, `POST /api/sessions/:id/prepare`, `POST /api/sessions/:id/submit-signed`, etc.). |
| [`src/schemas.ts`](./src/schemas.ts) | Zod schemas mirroring the types in `session.ts`. Used by the web backend to validate every inbound request body. XRPL-specific regex (drops, r-addresses, 64-char hex for InvoiceID/TxnSignature) lives here. |
| [`src/index.ts`](./src/index.ts) | Re-exports both. |

## Why a shared package

Three separate codebases (Next.js web app, React Native iOS app, Android native app via generated Kotlin data classes) all speak the same JSON protocol. Centralizing the types here means the iOS client cannot drift from the backend's expected payload shape without the TypeScript compiler catching it at build time.

For the full API surface, see [`apps/web/README.md`](../../apps/web/README.md#api-surface).
