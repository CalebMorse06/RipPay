# ColdTap Android HCE — NFC launch spike

A tiny Android merchant app that emulates an NFC card target. The buyer's iPhone taps it, reads a short payload, and enters the existing ColdTap checkout flow (prepare → Ledger sign → submit-signed → XRPL).

**This is not a full merchant app.** No XRPL, no signing, no dashboard. Android is the NFC launch target and nothing else. The QR path at `/s/:id` remains the primary, always-works fallback.

---

## APDU protocol contract

Copy-paste this into any iOS / reader integration:

```
AID           : F0434F4C44544150                (proprietary, 8 bytes, "F0" + ASCII "COLDTAP")
SELECT APDU   : 00 A4 04 00 08 F0 43 4F 4C 44 54 41 50 00
RESPONSE OK   : <UTF-8 payload> 90 00
  payload     : SESSION:<sessionId>            (ASCII, e.g. "SESSION:s_8fK2nQ9rL4vT")
RESPONSE NONE : 6F 00                           (AID matched but no payload set yet)
RESPONSE NOAID: 6A 82                           (APDU did not match our AID)
```

- No framing, no length prefix, no chained APDUs, no state across selects.
- Typical payload size: ~22 bytes (`SESSION:s_` + 12-char nanoid).
- Every successful SELECT returns the currently-stored session id; the service is stateless.

---

## Device requirements

- Android phone with NFC **and** Host Card Emulation support. Confirm in the app: the status block shows `NFC: enabled` and `HCE: supported`.
- Known working devices: any Pixel from Pixel 4 onward, recent Samsung Galaxy S/A series, OnePlus 7+. Devices without a secure element (some budget Android) still run HCE fine — the "host" in HCE means the NFC controller forwards APDUs to our app, not the SE.
- Emulators **do not work** — there is no NFC radio. Testing requires a physical device.

---

## Setup

Prereqs: Android Studio Hedgehog (2023.1) or later. JDK 17. A real Android device.

```bash
# 1. Open apps/android/ in Android Studio.
#    First sync will prompt to "Use Gradle from: 'gradle-wrapper.properties'" and
#    will download Gradle 8.9 + generate gradle-wrapper.jar automatically.
# 2. Plug in an Android phone with USB debugging enabled.
# 3. Run > Run 'app' (or Shift+F10) — installs + launches.
# From the CLI, after first Android Studio sync has generated the wrapper jar:
cd apps/android && ./gradlew :app:installDebug
```

If you prefer not to open Android Studio, run `gradle wrapper --gradle-version 8.9` once from any machine with a system Gradle ≥ 7.x to generate the `gradle-wrapper.jar`; thereafter `./gradlew` works standalone.

---

## Routing — CRITICAL for the demo

Android routes a proprietary (non-payment) AID to our HCE service only when **one of these is true**:

1. **ColdTap HCE is the foregrounded activity.** This is the primary code path. When the merchant app is open on screen, the system automatically prefers its HCE service for its declared AIDs. **Open the app and keep it in the foreground before the buyer taps.**
2. ColdTap is set as the preferred HCE service for non-payment AIDs.

Practical rule for the stage: open `ColdTap HCE`, set a payload, keep the phone awake, tap.

If two apps declare the same AID, the foreground rule wins. Our AID is proprietary and unlikely to clash, but be aware.

---

## How to use (merchant workflow)

1. Merchant creates a checkout on the ColdTap web app (`/` → fill form). Lands on `/session/<id>`. The session id is shown in monospace under the QR — copy it.
2. On the Android phone, open **ColdTap HCE**. Confirm status block reads `NFC: enabled`, `HCE: supported`.
3. Paste the session id into the input field (or press **Paste** to pull from clipboard). Press **Set**. The state flips to **READY** (green).
4. Buyer opens the ColdTap iPhone app and triggers the NFC read. Tap the two phones back-to-back for ~1 second.
5. iPhone reads `SESSION:<id>` and runs `GET /api/sessions/<id>` → `POST /prepare` → Ledger approval → `POST /submit-signed`.
6. Merchant web dashboard walks through the usual `AWAITING_BUYER → AWAITING_SIGNATURE → SUBMITTED → VALIDATING → PAID`.

---

## What the iPhone side needs

For the iOS agent implementing the reader:

- Register the AID in the app's `NFCReaderSession` with `com.apple.developer.nfc.readersession.iso7816.select-identifiers`:
  ```
  F0434F4C44544150
  ```
- Use `NFCTagReaderSession(pollingOption: .iso14443, ...)`, connect to the returned `NFCISO7816Tag`, and rely on the system to issue the SELECT automatically based on the entitlement list. On success `NFCISO7816Tag`'s `sendCommand` / automatic select returns the payload bytes.
- Decode UTF-8. Reject anything that does not start with `SESSION:`. Extract everything after the prefix as the `sessionId`.
- From there, the flow is **identical** to the QR-launch path. See `apps/ios/README.md` §3.

---

## Spike results (fill in after running on device)

- Phone tested: _______ (model + Android version)
- NFC radio present: _______
- HCE supported: _______
- `adb logcat -s ColdTapHCE` shows `APDU in: 00 A4 04 00 08 F0 43 4F 4C 44 54 41 50 00`: _______
- Service returns `SESSION:<id>` to the reader: _______
- iOS agent confirmed payload parse: _______
- Routing workaround required (foreground / default tap-and-pay): _______
- Other notes: _______

---

## Non-goals / scope guardrails

- Not building merchant auth, login, dashboard, or history.
- Not fetching session ids from the backend — operator-paste only. (A `GET /api/sessions/latest` helper would let the Android app pull instead; not part of this spike, and not blocked.)
- Not moving any payment fields over NFC. The backend owns Destination, Amount, InvoiceID — the iPhone must still call `/prepare`.
- Not reading NFC from the Android side (that would be a phone-to-phone thing we don't need).

## Troubleshooting

- **No tap detected.** Check that NFC is on in system Settings, that the app is open on screen, that the two phones are back-to-back (antennas typically near the top third of the back), and that the iPhone's app actually holds a live `NFCTagReaderSession` at the moment of tap.
- **APDU received but 6A82 returned.** The iPhone is sending a SELECT for a different AID (or its select-identifiers entitlement is missing our AID). Check iOS entitlements; check `adb logcat -s ColdTapHCE` for the raw bytes.
- **Status reads "HCE: unsupported".** The device does not expose `FEATURE_NFC_HOST_CARD_EMULATION`. Fall back to the QR path; no code workaround available.
- **Google Pay / Samsung Pay hijacks the tap.** System-default tap-and-pay only intercepts payment-category AIDs. Our AID is `category="other"`, which is why the foreground-app rule is the primary routing path. Keep the ColdTap activity on screen.

---

## File map

```
apps/android/
├── app/src/main/
│   ├── AndroidManifest.xml                            (permissions + service registration)
│   ├── java/com/coldtap/hce/
│   │   ├── MainActivity.kt                            (UI + prefs)
│   │   ├── ColdTapApduService.kt                      (HostApduService — the NFC target)
│   │   └── Payload.kt                                 (AID bytes, SELECT matcher, prefs I/O)
│   └── res/xml/apduservice.xml                        (AID filter F0434F4C44544150)
└── README.md                                          (this file)
```
