# ColdTap — iPhone Buyer App

Self-custody, in-person XRPL checkout. The buyer loads a payment session on their iPhone, reviews it, and approves with a **Ledger Nano X** via Bluetooth. The private key never leaves the hardware wallet.

---

## Demo Flow (Happy Path)

1. Merchant creates a session in the ColdTap web app
2. Buyer opens ColdTap on iPhone
3. Buyer enters session ID, pastes a link, or scans QR
4. Checkout screen shows: merchant name, item, amount
5. Buyer taps **Open Session** → sees Checkout
6. Buyer taps **Approve with Ledger**
7. App scans for Ledger Nano X over Bluetooth (XRP app must be open)
8. App reads buyer's XRPL address + public key from Ledger
9. App fetches unsigned transaction from backend (`POST /api/sessions/:id/prepare`)
10. Transaction is displayed on Ledger for physical confirmation
11. Buyer presses both buttons on Ledger to approve
12. Signed blob is submitted to backend (`POST /api/sessions/:id/submit-signed`)
13. Success screen shows transaction hash with XRPL Explorer link
14. Merchant web app updates to **Paid**

---

## Setup

```bash
# 1. From monorepo root
cd coldtap
npm install

# 2. Install iOS pods
cd apps/ios/ios
pod install

# 3. Configure environment
cd ..
cp .env.example .env
# Edit .env — set BACKEND_URL
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `BACKEND_URL` | `http://localhost:3000` | ColdTap backend base URL |
| `XRPL_NODE_URL` | `wss://s.altnet.rippletest.net:51233` | Not currently used by app (HTTP fallback used instead) |

### Pointing at a remote backend (ngrok / tunnel)

```
BACKEND_URL=https://your-tunnel.ngrok.io
```

HTTP is allowed for local networks (`NSAllowsLocalNetworking: true`). For remote HTTPS tunnels, no additional config is needed.

---

## Run on Physical iPhone

```bash
# Connect iPhone via USB, trust this Mac in iOS prompt

cd apps/ios
npx react-native run-ios --device "Your iPhone Name"

# Or open Xcode directly:
open ios/ColdTap.xcworkspace
# Select your device → Run (Cmd+R)
```

> Always use `ColdTap.xcworkspace` (not `.xcodeproj`) after pod install.

---

## Ledger Nano X Setup

1. Unlock Ledger Nano X with PIN
2. Open the **XRP app** on the Ledger (`Settings → Apps → XRP → Open`)
3. Screen should show "Use wallet to view accounts"
4. Pair Ledger to iPhone via Bluetooth (first time only — go to iPhone Settings → Bluetooth)
5. Keep XRP app open during the full approval flow

**Derivation path:** `44'/144'/0'/0/0` (BIP44 standard for XRP, same as Ledger Live)

---

## iOS Permissions Required

| Permission | Info.plist key | Why |
|---|---|---|
| Bluetooth | `NSBluetoothAlwaysUsageDescription` | Ledger BLE connection |
| Bluetooth (legacy) | `NSBluetoothPeripheralUsageDescription` | Required for iOS < 13 compat |
| Camera | `NSCameraUsageDescription` | QR code scanning |
| NFC | `NFCReaderUsageDescription` | NFC session load (Phase 4) |
| Background BLE | `UIBackgroundModes: bluetooth-central` | Keep BLE alive during signing |

NFC entitlement requires paid Apple Developer account with NFC Tag Reading capability.
NFC does **not** work in Simulator.
BLE does **not** work in Simulator.

---

## Deep Link / URL Handling

The app handles:

| Input | Example |
|---|---|
| Raw session ID | `abc123xyz` |
| ColdTap URL scheme | `coldtap://session/abc123xyz` |
| HTTPS path | `https://app.coldtap.xyz/session/abc123xyz` |
| Clipboard paste | Any of the above, via Paste button |

To test deep link from terminal:
```bash
xcrun simctl openurl booted "coldtap://session/test-session-id"
# (or on device via Safari address bar)
```

---

## API Contract (Current Expectations)

### Always-available routes (Phase 1+):

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/api/sessions/:id` | Fetch session details |
| `POST` | `/api/sessions/:id/status` | Update session status |
| `POST` | `/api/sessions/:id/submit` | Submit signed blob (old route) |

### Preferred routes (app uses these first, falls back to old routes):

| Method | Route | Purpose |
|---|---|---|
| `POST` | `/api/sessions/:id/prepare` | Get unsigned tx from backend |
| `POST` | `/api/sessions/:id/submit-signed` | Submit signed blob (new route) |

### `/prepare` response shape:

```json
{
  "sessionId": "abc123",
  "unsignedTransaction": {
    "TransactionType": "Payment",
    "Destination": "rXXXXXXXX...",
    "Amount": "1000000",
    "Sequence": 12345,
    "Fee": "12",
    "LastLedgerSequence": 54321,
    "Flags": 0
  }
}
```

**Backend controls:** Destination, Amount, Sequence, Fee, LastLedgerSequence, Memos, Flags  
**iOS adds:** Account, SigningPubKey (from Ledger), TxnSignature (from signing)

If `/prepare` returns 404/405, the app falls back to:
- Building the unsigned transaction from the session's `destinationAddress` + `amountDrops`
- Fetching Sequence/Fee/LastLedgerSequence from XRPL testnet JSON-RPC directly

### `/submit-signed` request body:

```json
{ "signedTxBlob": "<hex-encoded signed transaction>" }
```

Response: `{ "txHash": "<transaction hash>" }`

---

## What Is Real vs Stubbed

| Feature | Status |
|---|---|
| Session fetch (GET /sessions/:id) | Real |
| Status update (POST /status) | Real |
| Ledger BLE scan + connect | Real |
| XRPL address/public key from Ledger | Real |
| Transaction building (xrpl encode) | Real |
| Transaction signing on Ledger | Real |
| Signed blob submission | Real (tries /submit-signed, falls back to /submit) |
| Backend /prepare endpoint | Real if available; client-side fallback if 404 |
| XRPL network params fallback | Real (HTTP JSON-RPC to testnet) |
| QR scanner | Stub (alert placeholder — Phase 2) |
| NFC session load | Stub (alert placeholder — Phase 4) |

---

## Expected Failure Modes

| Situation | App behavior |
|---|---|
| Backend unreachable | Error on Checkout load or Processing; clear message shown |
| Session expired | Checkout shows Expired state with message |
| Ledger not found in 15s | Processing error: "No Ledger found. Make sure BLE is on..." |
| Ledger locked | Error: "Ledger is locked. Please unlock and open XRP app." |
| XRP app not open | Error: "XRP app is not open on your Ledger." |
| User rejects on Ledger | Error: "Transaction rejected on Ledger." |
| Backend /prepare 404 | Silent fallback to client-side tx building + XRPL HTTP |
| Backend /submit-signed 404 | Silent fallback to /submit |
| XRPL network params fetch fails | Error surfaced in Processing screen |

---

## Build Phases

| Phase | Status | Description |
|---|---|---|
| 1 — Skeleton | Done | Screens, mocked flow, manual session entry |
| 2 — Real pipeline | Done | Ledger BLE, signing, real submission, URL parsing |
| 3 — QR scanning | TODO | react-native-vision-camera (package installed) |
| 4 — NFC + polish | TODO | react-native-nfc-manager (package installed) |

---

## Xcode / Build Notes

- Use `ColdTap.xcworkspace` (not `.xcodeproj`)
- If build fails with "Multiple commands produce Info.plist": Xcode → Build Settings → User Script Sandboxing → NO
- BLE and NFC require physical iPhone (no Simulator)
- NFC requires paid Apple Developer account with NFC capability in provisioning profile
- Deployment target: iOS 16.0
