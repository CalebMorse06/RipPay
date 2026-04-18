# ColdTap — iPhone Buyer App

Self-custody, in-person XRPL checkout. The buyer loads a payment session on their iPhone, reviews it, and approves with a **Ledger Nano X** via Bluetooth. The private key never leaves the hardware wallet.

---

## Launch Paths

There are three ways to start a checkout:

| Method | How |
|--------|-----|
| **Tap Merchant Phone** | Tap button on HomeScreen → hold iPhone near Android merchant phone (NFC HCE) |
| **NFC sticker / deep link** | Tap NFC sticker or open a `coldtap://merchant/:id` or `coldtap://session/:id` URL |
| **Paste / manual entry** | Paste a session URL or type a session ID into HomeScreen |

All three paths converge at `CheckoutScreen`. The Ledger + XRPL signing flow is identical regardless of entry method.

---

## Android Merchant Phone Tap Flow

The merchant Android phone uses **Host Card Emulation (HCE)** to act as an ISO 7816 NFC card. The buyer iPhone acts as the ISO 7816 reader.

### AID

```
F0434F4C44544150
```

- `F0` — proprietary prefix (ISO 7816-5)
- `434F4C44544150` — ASCII "COLDTAP" (uppercase)

### What the Android app must implement

1. `HostApduService` with AID `F0434F4C44544150`
2. On `SELECT AID` APDU (`00 A4 04 00 08 F0 43 4F 4C 44 54 41 50`), respond with:
   - response data bytes (UTF-8 payload)
   - status word `90 00`

### Payload format

| Format | Example | Routes to |
|--------|---------|-----------|
| `sessionId=<id>` | `sessionId=abc123` | `CheckoutScreen` directly |
| `merchantSlug=<slug>` | `merchantSlug=hackku-booth` | `MerchantLanding` → resolve → `CheckoutScreen` |
| bare string | `abc123` | Treated as session ID → `CheckoutScreen` |

Prefer `sessionId=...` — it skips the merchant-resolution API round-trip.

### iPhone reader behavior

1. Buyer taps **"Tap Merchant Phone"** on HomeScreen
2. iOS shows system NFC HUD: "Hold iPhone near reader…"
3. iPhone sends `SELECT AID` APDU for `F0434F4C44544150`
4. Android HCE responds with payload + `90 00`
5. App decodes UTF-8, parses intent, navigates into checkout
6. After ~20 s with no response: iOS times out with a human-readable error

---

## Demo Flow (Happy Path — Android HCE mode)

1. Merchant opens ColdTap Android app → active session shown
2. Buyer taps **"Tap Merchant Phone"** on iPhone HomeScreen
3. iOS NFC HUD appears
4. Buyer holds iPhone near merchant Android phone
5. Session ID is received over NFC → Checkout screen opens
6. Buyer taps **Approve with Ledger**
7. Ledger Nano X connects via Bluetooth, XRP address read
8. Transaction displayed on Ledger for physical confirmation
9. Buyer presses both buttons → signed blob submitted
10. Success screen shows transaction hash
11. Merchant dashboard flips to **Paid**

---

## Setup

```bash
# From monorepo root
npm install

# Install iOS pods
cd apps/ios/ios
pod install

# Configure environment
cd ..
cp .env.example .env
# Edit .env — set BACKEND_URL
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `BACKEND_URL` | `http://localhost:3000` | ColdTap backend base URL |
| `XRPL_NODE_URL` | `wss://s.altnet.rippletest.net:51233` | Not actively used (HTTP fallback used) |

---

## Run on Physical Device

**Simulator will not work** — BLE (Ledger) and NFC both require physical hardware.

```bash
cd apps/ios
npx react-native run-ios --device "Your iPhone Name"
# or: open ios/ColdTap.xcworkspace → select device → Cmd+R
```

> Always use `ColdTap.xcworkspace` (not `.xcodeproj`) after pod install.

---

## Ledger Nano X Setup

1. Unlock Ledger Nano X with PIN
2. Open the **XRP app** on the Ledger
3. Screen should show "Use wallet to view accounts"
4. Pair via Bluetooth (first time: iPhone Settings → Bluetooth)
5. Keep XRP app open during the full approval flow

**Derivation path:** `44'/144'/0'/0/0` (BIP44 XRP, same as Ledger Live)

---

## iOS Permissions & Configuration

| Permission | Key | Why |
|---|---|---|
| Bluetooth | `NSBluetoothAlwaysUsageDescription` | Ledger BLE connection |
| Bluetooth (legacy) | `NSBluetoothPeripheralUsageDescription` | iOS < 13 compat |
| Camera | `NSCameraUsageDescription` | Reserved for QR (future) |
| NFC | `NFCReaderUsageDescription` | NFC reader sessions |
| Background BLE | `UIBackgroundModes: bluetooth-central` | Keep BLE alive during signing |

### NFC entitlements (both NDEF and ISO7816 declared)

`ColdTap.entitlements`:
```xml
<key>com.apple.developer.nfc.readersession.formats</key>
<array>
  <string>NDEF</string>
  <string>ISO7816</string>
</array>
```

`Info.plist` (AID filter — iOS uses this to match compatible tags):
```xml
<key>com.apple.developer.nfc.readersession.iso7816.select-identifiers</key>
<array>
  <string>F0434F4C44544150</string>
</array>
```

---

## Known Blockers

1. **Provisioning profile must include ISO7816**  
   Adding `ISO7816` to entitlements requires a matching Apple Developer provisioning profile with the NFC Tag Reading + ISO7816 capability. Without it the entitlement is stripped and tag reading fails.  
   Fix: Apple Developer portal → App ID → NFC Tag Reading → regenerate profile → Xcode Signing & Capabilities → re-download.

2. **Physical device only** — `NFCTagReaderSession` does not run in the iOS Simulator.

3. **Android HCE companion required** — The "Tap Merchant Phone" button does nothing without an Android app implementing HCE for AID `F0434F4C44544150`. The existing sticker / deep link launch path works independently.

---

## Deep Link / URL Handling

| Input | Example |
|---|---|
| Raw session ID | `abc123xyz` |
| Raw merchant slug | `hackku-booth` → resolves via API |
| ColdTap URL scheme | `coldtap://session/abc123xyz` |
| ColdTap merchant scheme | `coldtap://merchant/my-booth` |
| HTTPS path | `https://app.coldtap.xyz/session/abc123xyz` |

To test deep link:
```bash
# On simulator:
xcrun simctl openurl booted "coldtap://session/test-id"
# On device: open URL in Safari address bar
```

---

## API Contract

### Core routes:

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/api/sessions/:id` | Fetch session details |
| `POST` | `/api/sessions/:id/status` | Update session status |
| `POST` | `/api/sessions/:id/prepare` | Get unsigned tx from backend |
| `POST` | `/api/sessions/:id/submit-signed` | Submit signed blob |
| `GET` | `/api/merchants/:id/active-session` | Resolve merchant → session |

If `/prepare` returns 404/405, app builds unsigned tx client-side from session fields + XRPL testnet HTTP.  
If `/submit-signed` returns 404/405, app falls back to `/submit`.

---

## Feature Status

| Feature | Status |
|---|---|
| Checkout + Ledger BLE signing | Working |
| XRPL transaction build + submit | Working |
| Deep link launch (`coldtap://`) | Working |
| NFC sticker → merchant resolution | Working |
| Manual session ID / paste entry | Working |
| Ledger prewarm (background BLE scan) | Working |
| **Tap Merchant Phone (Android HCE)** | Code complete — requires physical device + ISO7816 provisioning profile + Android companion app |
| QR scanner | Not implemented |

---

## Xcode Notes

- Use `ColdTap.xcworkspace` (not `.xcodeproj`)
- If build fails with "Multiple commands produce Info.plist": Xcode → Build Settings → User Script Sandboxing → NO
- Deployment target: iOS 16.0
- NFC + BLE: physical iPhone required; paid Apple Developer account required for NFC
