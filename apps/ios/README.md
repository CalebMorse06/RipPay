# ColdTap iOS — buyer app

This directory is a placeholder for the iPhone buyer app, built by a separate agent.

## Integration boundary

- The iOS app and the merchant web app **never communicate directly**.
- Both clients share state only through the backend, keyed by session ID.
- The backend (Next.js API routes under `apps/web/src/app/api`) is the source of truth for session status.

## Source of truth for the contract

Mirror the types and schemas from [`packages/shared/src`](../../packages/shared/src):

- `session.ts` — `SessionStatus`, `Session`, request/response shapes
- `schemas.ts` — zod validators (reference, not imported by Swift)
- `examples.ts` — copy-pasteable example payloads

## QR payload format

The merchant page encodes a `coldtap://` URL:

```
coldtap://session/{sessionId}?api={encodedBackendBaseUrl}
```

Register `coldtap://` as a URL scheme in the iOS app. On receipt, parse the session ID and use `api` as the backend base URL for polling / submit.

Manual session loading (user types the `sessionId`) must also be supported. The web app shows the raw session ID alongside the QR.

## HTTP calls from iOS

| When | Call |
|---|---|
| After scanning QR or manual load | `GET {api}/api/sessions/{id}` |
| When buyer opens the approve screen | `POST {api}/api/sessions/{id}/status` with `{"status":"AWAITING_SIGNATURE"}` |
| After Ledger returns a signed blob | `POST {api}/api/sessions/{id}/submit` with `{"txBlob":"<hex>"}` |
| To observe final state | poll `GET {api}/api/sessions/{id}` every ~1.5s until status is `PAID`, `FAILED`, or `EXPIRED` |

SSE is also exposed at `GET {api}/api/sessions/{id}/events` (optional; polling is sufficient).

## Status lifecycle

```
AWAITING_BUYER → AWAITING_SIGNATURE → SUBMITTED → VALIDATING → PAID
                                                           ↘ FAILED
any → EXPIRED (after expiresAt)
```

The iOS app advances `AWAITING_BUYER → AWAITING_SIGNATURE` via `/status`. The backend owns every transition from `SUBMITTED` onward.
