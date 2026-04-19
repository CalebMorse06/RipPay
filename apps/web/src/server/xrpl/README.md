# XRPL integration

This directory is the entire XRPL surface area for RipPay's backend. If you're
reviewing the project for XRPL primitive coverage, **start here**.

## Files

| File | Responsibility | XRPL primitives |
|---|---|---|
| [`prepare.ts`](./prepare.ts) | Build the unsigned `Payment`. In real mode opens an `xrpl.Client` over WebSocket, calls `account_info` for the buyer's current `Sequence`, and `ledger_current` to set `LastLedgerSequence = current + offset` (default 40 ledgers ≈ 50s validity window). | `Payment`, `Sequence`, `LastLedgerSequence`, `Fee`, `Destination`, `Amount`, `InvoiceID`, `Memos` |
| [`verify.ts`](./verify.ts) | Decode the signed `tx_blob` (via `xrpl`'s binary codec) and reject it unless Destination, Amount, and `InvoiceID === SHA256(sessionId)` all match the session being paid for. This is the replay-prevention anchor. | `TransactionType`, `TxnSignature`, `SigningPubKey`, `InvoiceID` |
| [`submit.ts`](./submit.ts) | Minimal JSON-RPC client to rippled. Submits the signed blob, then polls `tx` by hash every 2s until `meta.TransactionResult` is set. Chose HTTP over WebSocket because Vercel's Lambda freezes between invocations and stale sockets surface as "WebSocket is closed" on the next request. | `submit`, `tx`, `meta.TransactionResult` |
| [`config.ts`](../config.ts) | Single source of truth for `XRPL_MODE` (`mock`/`real`), `XRPL_NETWORK` (`testnet`/`mainnet`), RPC + WS URLs, default fee, ledger offset. | — |
| [`verify.test.ts`](./verify.test.ts) | Vitest suite for the four rejection cases above. | — |

## Related

- [`../invoice.ts`](../invoice.ts) — `SHA256(sessionId) → InvoiceID` (the binding) + Memo encoding.
- [`packages/shared/src/session.ts`](../../../../../packages/shared/src/session.ts) — the canonical `UnsignedPayment` / `Session` / `SubmitSignedRequest` types used across iOS, Android, and web.

## Transaction lifecycle

```
POST /api/sessions/:id/prepare
  └─ prepare.ts::buildUnsignedPayment
       └─ xrpl.Client → account_info (Sequence) + ledger_current (LastLedgerSequence)
  → returns UnsignedPayment to the buyer's device

POST /api/sessions/:id/submit-signed  (body: { tx_blob })
  └─ verify.ts::verifySignedBlob     — decode + enforce destination/amount/InvoiceID
  └─ verify.ts::hashSignedBlob       — record txHash immediately (status SUBMITTED)
  └─ submit.ts::submitAndTrack       — JSON-RPC submit, poll validation via Next.js after()
  → emits SSE events → merchant dashboard updates to PAID or FAILED
```

All requests and responses are typed by `packages/shared` — there is exactly one place the contract is defined.
