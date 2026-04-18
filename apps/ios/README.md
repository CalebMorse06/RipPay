# ColdTap iOS — buyer app

This directory is a placeholder for the iPhone buyer app, built by a separate agent. Nothing here needs to be built at merchant-web scaffolding time — this file is the integration contract.

---

## 0. Integration boundary — read first

- The iOS app and the merchant web app **never communicate directly**. Both share state only through the backend, keyed by session ID.
- The backend (Next.js API routes under `apps/web/src/app/api`) is the source of truth for session status AND payment parameters.
- The backend owns `Destination`, `Amount`, and `InvoiceID`. The iOS app must sign exactly what `/prepare` returns. A mismatched signed blob is rejected by `/submit-signed` and the session never moves past `AWAITING_SIGNATURE`.

---

## 1. Source of truth for the contract

Mirror the types and zod schemas from [`packages/shared/src`](../../packages/shared/src):

- `session.ts` — `SessionStatus`, `Session`, request/response shapes
- `schemas.ts` — zod validators (reference, not imported by Swift)
- `examples.ts` — copy-pasteable example payloads

Do not invent new fields, new statuses, or new routes. Do not rename anything.

---

## 2. QR / universal link handling

The merchant page encodes an HTTPS URL in the QR:

```
https://<base>/s/<sessionId>
```

Two arrival paths:

1. **Universal link (preferred).** Register the merchant domain via an Associated Domain (`applinks:coldtap.yourdomain.com`). When the user scans the QR with the iPhone camera the ColdTap app opens directly with the parsed session id.
2. **Manual entry fallback.** The merchant screen also displays the raw `sessionId` (e.g. `s_8fK2nQ9rL4vT`). The iOS app must provide an input where the user can paste or type it.

For simulator testing (where associated domains may not be configured) the backend additionally exposes a custom URL scheme via `apps/web/src/lib/qr.ts#buildDeepLink`:

```
coldtap://session/<sessionId>?api=<url-encoded-base>
```

Prefer universal links for the real demo. The custom scheme is not what the public QR encodes.

Either way, the iOS app ends up with a `sessionId` plus a backend base URL. The backend base URL is either (a) the origin of the universal link, or (b) the `api` query parameter on the custom URL.

---

## 3. The flow

```
 ┌──────────┐    GET /api/sessions/:id         ┌──────────┐
 │   iOS    │ ───────────────────────────────▶ │ backend  │   fetch session
 │          │ ◀─────────────────────────────── │          │   show summary
 │          │                                  │          │
 │  buyer   │    POST /api/sessions/:id/prepare│          │
 │  taps    │  ───────────────────────────────▶│          │   advances to
 │ "Review" │  ◀─────────────────────────────── │          │   AWAITING_SIGNATURE
 │          │       { unsignedTx, ... }        │          │   returns canonical tx
 │          │                                  │          │
 │  Ledger  │    (sign unsignedTx on device)   │          │
 │  Nano X  │    (produces hex txBlob)         │          │
 │          │                                  │          │
 │          │    POST /api/sessions/:id/       │          │
 │          │      submit-signed               │          │
 │          │  ───────────────────────────────▶│          │   decode, verify,
 │          │  ◀─────────────────────────────── │          │   submit to XRPL
 │          │       { txHash, SUBMITTED }      │          │
 │          │                                  │          │
 │          │    poll GET /api/sessions/:id    │          │
 │          │  ───────────────────────────────▶│          │   SUBMITTED →
 │          │  ◀─────────────────────────────── │          │   VALIDATING → PAID
 └──────────┘                                  └──────────┘
```

---

## 4. Endpoints — exact shapes

Base URL comes from the universal link (universally) or the `api` param (custom scheme). Treat it as opaque — do not hardcode.

### 4.1 `GET {base}/api/sessions/{id}`

Fetch current session. Response is the full `Session` object.

```json
{
  "id": "s_8fK2nQ9rL4vT",
  "merchantName": "Demo Cafe",
  "itemName": "Cold brew",
  "amountDrops": "2500000",
  "amountDisplay": "2.50 XRP",
  "currency": "XRP",
  "destinationAddress": "rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe",
  "memo": "order-1042",
  "status": "AWAITING_BUYER",
  "network": "testnet",
  "expiresAt": "2026-04-18T12:10:00.000Z",
  "createdAt": "2026-04-18T12:00:00.000Z",
  "updatedAt": "2026-04-18T12:00:00.000Z"
}
```

`404` if id unknown. `410` is **not** returned here — expired sessions come back with `status: "EXPIRED"`.

### 4.2 `POST {base}/api/sessions/{id}/prepare`

**Canonical integration path.** Request body:

```json
{ "account": "rBuyerXrplAccount..." }
```

`account` is optional — if omitted the server returns a payload without `Sequence`/`LastLedgerSequence` and the iOS app must autofill before signing. Passing `account` is strongly preferred.

Success response:

```json
{
  "sessionId": "s_8fK2nQ9rL4vT",
  "network": "testnet",
  "expiresAt": "2026-04-18T12:10:00.000Z",
  "merchant": {
    "name": "Demo Cafe",
    "itemName": "Cold brew",
    "amountDrops": "2500000",
    "amountDisplay": "2.50 XRP",
    "memo": "order-1042"
  },
  "unsignedTx": {
    "TransactionType": "Payment",
    "Account": "rBuyerXrplAccount...",
    "Destination": "rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe",
    "Amount": "2500000",
    "InvoiceID": "CB1D0BF3F6BB2F5ED62AE4A8E6E3AD5C6AD34C53FCE76CD46CFB5A6F93A4E1BB",
    "Fee": "12",
    "Sequence": 19421234,
    "LastLedgerSequence": 19421274,
    "Memos": [ { "Memo": { "MemoType": "...", "MemoData": "...", "MemoFormat": "..." } } ]
  },
  "immutableFields": ["TransactionType", "Destination", "Amount", "InvoiceID", "Memos"],
  "autofilled": true
}
```

**The iOS app MUST NOT modify** any field listed in `immutableFields`. If it does, `/submit-signed` will reject the submission.

`410` if the session is expired. `409` if `status` is `PAID`, `FAILED`. `404` if unknown.

Side effect: `AWAITING_BUYER → AWAITING_SIGNATURE`.

### 4.3 `POST {base}/api/sessions/{id}/submit-signed`

Request body:

```json
{ "txBlob": "1200..." }
```

`txBlob` is the hex-encoded signed XRPL transaction emitted by the Ledger. Success response:

```json
{ "txHash": "E3FE6EA...", "status": "SUBMITTED" }
```

Error responses (all JSON):

| Status | Meaning |
|---|---|
| `404` | unknown session id |
| `410` | session expired |
| `409` | already `PAID`, already `FAILED`, or already in-flight (`SUBMITTED` / `VALIDATING`) |
| `422` | blob decode or verification failed. Response includes `reason` string — e.g. `"Destination mismatch: ..."`, `"Amount mismatch: ..."`, `"InvoiceID mismatch ..."`, `"transaction is not signed"`. |
| `502` | submit to XRPL failed |

Validation and final status (`PAID` / `FAILED`) are driven asynchronously on the server. The iOS app should poll `/api/sessions/:id` or subscribe to `/events` until the session reaches a terminal state.

### 4.4 `GET {base}/api/sessions/{id}/events` — optional

Server-Sent Events stream of `Session` snapshots. Implemented; safe to ignore in favor of polling. Polling at 1.5s intervals is sufficient.

---

## 5. What the iOS app MUST and MUST NOT do

### MUST

- Request `/prepare` with the buyer's account (the account whose keys the Ledger holds).
- Sign exactly the transaction returned in `unsignedTx`. No field rewriting.
- Post the resulting signed blob as `{txBlob: "<hex>"}` to `/submit-signed`.
- Support manual session id entry as a fallback to QR scan.
- Show the user `merchant.name`, `merchant.itemName`, `merchant.amountDisplay`, and `network` before asking for Ledger approval. Network badge must be visible — `mock`, `testnet`, and `mainnet` are not the same trust surface.
- Treat `network === "mock"` as a developer-only state. The Ledger signing flow can be skipped in mock mode if the iOS app wants to exercise the whole pipeline without a physical device; use a known test blob via `/submit` (legacy endpoint) in that case.

### MUST NOT

- Invent or override `Destination`, `Amount`, or `InvoiceID`.
- Re-submit a blob for a session that already returned `SUBMITTED` / `VALIDATING` / `PAID` / `FAILED`. The backend rejects these with `409`.
- Sign anything before `/prepare` returns. The `Sequence` / `LastLedgerSequence` the Ledger signs over must come from `/prepare` (server autofill) or from the iOS app's own autofill — the iOS app must not reuse a cached payload across sessions.

---

## 6. Mock vs. real mode

Mode is a property of the *backend*, not the iOS app. The iOS app reads `network` from every response and surfaces it to the user.

- `network: "mock"` — The backend simulates the full lifecycle in ~3 seconds. The blob you post to `/submit-signed` is *decoded and verified* exactly like real mode, so if your Ledger flow works against a mock backend you know it will work against a real one. For the curl smoke-test flow the legacy `/submit` endpoint relaxes verification when the blob is obviously not a real XRPL tx.
- `network: "testnet"` — Real XRPL testnet. You need a testnet-funded buyer account. Fund via `https://faucet.altnet.rippletest.net/accounts`. Tx hashes link to `https://testnet.xrpl.org/transactions/<hash>`.
- `network: "mainnet"` — Real money. Do not run this for demos unless you know what you're doing.

---

## 7. Testing against a deployed backend

Once the merchant app is deployed (e.g. to Vercel), point the iOS app at the deployed base URL. Smoke test:

```bash
# Create a session
curl -X POST https://<base>/api/sessions \
  -H 'content-type: application/json' \
  -d '{"merchantName":"Test","itemName":"T","amountDrops":"1000000","destinationAddress":"rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe"}'
# -> { "id": "s_...", ... }

# Inspect /prepare
curl -X POST https://<base>/api/sessions/s_.../prepare \
  -H 'content-type: application/json' \
  -d '{"account":"r<your-buyer-address>"}'
# -> unsignedTx with Destination/Amount/InvoiceID
```

From there: sign `unsignedTx` on the Ledger, post the hex blob to `/submit-signed`, poll `/api/sessions/:id`.

---

## 8. Optional: NFC launch path (Android HCE)

ColdTap has a second, additive launch mechanism: the merchant runs the Android app in `apps/android/` which emulates an NFC card target. When the buyer taps the two phones back-to-back, the iPhone reads one short payload and enters the flow from §3. **This does not replace the QR path** — it's an alternative entry point for the same session fetch.

### The reader contract

You implement an `NFCTagReaderSession` configured for ISO 7816. The only new thing the iOS app needs to do is register the AID via entitlement and parse the response payload.

```
AID           : F0434F4C44544150                (proprietary, 8 bytes, "F0" + ASCII "COLDTAP")
SELECT APDU   : 00 A4 04 00 08 F0 43 4F 4C 44 54 41 50 00
RESPONSE OK   : <UTF-8 payload> 90 00
  payload     : SESSION:<sessionId>
RESPONSE NONE : 6F 00                           (tag in range but merchant hasn't set a session)
RESPONSE NOAID: 6A 82                           (unknown tag — not a ColdTap merchant phone)
```

### Entitlement + Info.plist

Add the iOS 13+ Core NFC entitlement:

```xml
<key>com.apple.developer.nfc.readersession.iso7816.select-identifiers</key>
<array>
    <string>F0434F4C44544150</string>
</array>
```

And the usage description in `Info.plist`:

```xml
<key>NFCReaderUsageDescription</key>
<string>Tap a merchant phone to open their checkout.</string>
```

### Flow once the payload is read

1. Decode response bytes as UTF-8.
2. Reject anything not starting with `SESSION:`. Strip the prefix. Validate the session id looks like `s_` + alphanumerics (same shape as the QR path).
3. Enter the existing §3 flow at step 1: `GET {base}/api/sessions/{id}`. You need a backend base URL — use the same configured base as the QR path. Do not try to derive it from the NFC payload.

That's the entire NFC change on the iOS side. Prepare, signing, and submit-signed are unchanged from §4.

### Constraints

- iOS Core NFC requires the app to be foregrounded during the session on most devices. The buyer taps **with the ColdTap iOS app already open** on a scan screen. Background tag reading is not relied on.
- If the Android service returns `6F 00`, surface "merchant hasn't started a checkout yet" and dismiss. Do not call the backend with an empty id.
- If the reader session errors or times out (common under poor antenna alignment), fall back to the QR path — show the QR scanner. Do not retry silently; the merchant may switch paths.

See `apps/android/README.md` for the producer side, device requirements, and routing caveats.

---

## 9. Glossary

- **InvoiceID** — 256-bit hex field on an XRPL Payment. ColdTap sets it to SHA-256 of the session id so the backend can bind a signed blob to a specific session. Never reuse.
- **Drops** — smallest XRP unit. 1 XRP = 1,000,000 drops. The Session object carries `amountDrops` (integer string) and `amountDisplay` (human-readable).
- **r-address** — XRPL classic address format. Regex: `^r[1-9A-HJ-NP-Za-km-z]{24,34}$`. Both `destinationAddress` (session) and `account` (prepare request) must match this.
