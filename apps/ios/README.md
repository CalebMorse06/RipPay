# ColdTap — iPhone Buyer App

Self-custody, in-person XRPL checkout. The buyer reviews a merchant's payment session on their iPhone, then approves and signs with a **Ledger Nano X** hardware wallet over Bluetooth. The private key never leaves the device.

## Demo Flow

1. Merchant creates a session in the ColdTap web app
2. Buyer opens ColdTap on iPhone and enters the session ID (or scans QR / taps NFC)
3. Buyer reviews merchant name, item, and amount on the Checkout screen
4. Buyer taps **Approve with Ledger** — the app connects via Bluetooth
5. Buyer confirms the transaction by pressing both buttons on the Ledger Nano X
6. Signed transaction is submitted to the XRP Ledger (testnet)
7. Success screen shows transaction hash; merchant web app updates to **Paid**

## Stack

- React Native 0.75 (bare workflow)
- TypeScript
- React Navigation (native-stack)
- Zustand (state)
- Axios (API)
- `@ledgerhq/react-native-hw-transport-ble` + `@ledgerhq/hw-app-xrp` (Ledger BLE)
- `react-native-ble-plx` (Bluetooth)
- `xrpl` (transaction building)
- `react-native-vision-camera` + `vision-camera-code-scanner` (QR — Phase 2)
- `react-native-nfc-manager` (NFC — Phase 4)

## Prerequisites

| Tool | Version |
|------|---------|
| Xcode | 15.4+ |
| iOS target | 16.0+ |
| Node.js | 18+ |
| npm | 9+ |
| CocoaPods | 1.14+ |
| Apple Developer account | Paid (required for NFC) |

## Setup

```bash
# 1. Install from monorepo root
cd coldtap
npm install

# 2. Install iOS pods
cd apps/ios/ios
pod install

# 3. Create your .env
cd ..
cp .env.example .env
# Edit .env — set BACKEND_URL to your running backend
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `BACKEND_URL` | `http://localhost:3000` | ColdTap backend base URL |
| `XRPL_NODE_URL` | `wss://s.altnet.rippletest.net:51233` | XRPL testnet WebSocket |

## Run on Device

```bash
# Connect iPhone via USB, trust the Mac, ensure provisioning profile is set

# From apps/ios/
npx react-native run-ios --device "Your iPhone Name"

# Or open in Xcode:
open ios/ColdTap.xcworkspace
# Select your device, hit Run
```

> **Note:** Always use `ColdTap.xcworkspace` (not `.xcodeproj`) after pod install.

## Provisioning Notes

- Bluetooth works with any paid Apple Developer account
- NFC Tag Reading requires an explicit App ID capability in the Apple Developer portal
- NFC does **not** work in iOS Simulator — requires physical iPhone 7 or later

## Build Phases

| Phase | Status | Description |
|-------|--------|-------------|
| 1 — Skeleton | Done | App scaffold, manual session entry, Checkout/Processing/Success screens, mocked Ledger flow |
| 2 — QR + Real API | TODO | QR scanning, session polling, error/expired states |
| 3 — Ledger | TODO | Real BLE connection, hw-app-xrp signing, xrpl.js tx building |
| 4 — NFC + Polish | TODO | NFC NDEF reading, error recovery, demo polish |

## Phase 3 Ledger Integration TODO

The `src/ledger/` directory contains stubs ready for Phase 3 drop-in:

1. **`LedgerTransport.ts`** — replace stub with `BleTransport.create(deviceId)` from `@ledgerhq/react-native-hw-transport-ble`
2. **`XrplSigner.ts`** — replace stub with `XrpApp.getAddress()` and `XrpApp.signTransaction()`
3. **`TransactionBuilder.ts`** — uncomment `xrpl.encode/decode` calls
4. **`ProcessingScreen.tsx`** — replace the `setTimeout` mock flow with the real 5-phase flow:
   - BleTransport connect
   - getXrplAddress
   - fetch sequence/fee from XRPL node
   - buildPaymentTxHex -> signTransaction -> injectSignature
   - POST `/api/sessions/:id/submit`

## Shared Contract

Types are defined in `packages/shared/src/session.ts` and imported as `@coldtap/shared`.

The canonical `SessionStatus` enum and `Session` interface must not be modified independently — they are the integration contract with the backend and web app.

## Known Limitations

- Ledger flow is mocked in Phase 1 (uses setTimeout + mock blob)
- No QR scanning yet (Phase 2)
- No NFC yet (Phase 4)
- No auth on session IDs (acceptable for hackathon; backend should rate-limit)
- Android not implemented (not required per project spec)
- `xrpl` 3.x ESM: Metro uses `unstable_enablePackageExports: false` workaround
