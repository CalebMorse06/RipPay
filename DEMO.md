# RipPay — Demo flows

What the judges actually see, what hardware you need, and which flow is safe to commit to given the current build state.

> Internal identifiers (`coldtap://` URL scheme, `apps/android/app/src/main/java/com/coldtap/hce`, Xcode project name `ColdTap`) are preserved across the rebrand for signing/provisioning continuity. Product name is RipPay.

---

## TL;DR

- **NFC is a handshake, not a signature.** The only thing NFC ever carries in ColdTap is a session id (~20 bytes). The Ledger Nano X signs the actual XRPL transaction *after* the NFC tap, over Bluetooth, with the buyer's phone.
- **The Ledger lives with the buyer.** In every flow. One Ledger is enough for any demo — pre-pair it with whichever phone is the buyer.
- **Flow C (Android browser + WebBluetooth) is the only end-to-end flow that is fully built today** and has zero external dependencies. Make it your primary. If the iOS app lands in time, Flows A / B become bonus demos.

---

## How phone-to-phone actually works

The flashy "tap two phones together" moment is a 1-second handoff — it transfers a session id and nothing else. The signing happens on a totally separate Bluetooth channel, between the buyer's phone and the Ledger:

```
  Android phone (merchant)       iPhone (buyer)              Ledger Nano X
  ──────────────────────         ─────────────               ─────────────
  broadcasts "SESSION:<id>"  ──► NFC tap (~1s)
                                 │
                                 │ reads session id
                                 ▼
                                 opens native app
                                 │
                                 │ pairs over Bluetooth ───► Nano X
                                 │                           │
                                 │ asks to sign ────────────►│
                                 │                           │ user approves
                                 │ ◄──── signed blob ────────┤
                                 │
                                 │ POST /submit-signed
                                 ▼
                              XRPL testnet → iPad merchant dashboard: PAID
```

In this phone-to-phone flow the **iPhone is the buyer and holds the Ledger**. The Android phone does zero cryptographic work — it's a glorified NFC emitter sitting on the merchant's counter running `apps/android/` (the HCE spike).

The other two flows drop the NFC tap and use QR or direct URL entry; the Bluetooth-to-Ledger half is the same either way.

---

## The three flows

| Flow | Buyer device | Ledger pairs with | What's built | What's missing | Hardware for demo |
|---|---|---|---|---|---|
| **A. iPhone + QR** | iPhone native app | iPhone (CoreBluetooth) | Backend + QR + merchant dashboard | Native iOS app (iOS agent's deliverable) | iPad, iPhone, Ledger |
| **B. iPhone + NFC tap** (phone-to-phone) | iPhone native app | iPhone (CoreBluetooth) | Backend + Android HCE spike + merchant dashboard | Native iOS app + NFC reader entitlement | iPad, iPhone, Ledger, Android phone |
| **C. Android browser** | Android Chrome web app | Android phone (WebBluetooth) | **Everything — code complete** | Nothing (needs real-device verification) | iPad, Android phone, Ledger |

All three end the same way: backend records `SUBMITTED` → `VALIDATING` → `PAID`, and the iPad merchant dashboard flips to green via SSE.

---

## Hardware matrix

You do **not** need more than one of each. A single Ledger Nano X covers every flow — it just needs to be pre-paired with whichever phone is the buyer for the flow you're running.

|  | Flow A | Flow B | Flow C |
|---|:---:|:---:|:---:|
| iPad (merchant dashboard) | ✓ | ✓ | ✓ |
| iPhone (buyer w/ native app) | ✓ | ✓ | — |
| Android phone (buyer w/ Chrome) | — | — | ✓ |
| Android phone (merchant NFC tag) | — | ✓ | — |
| Ledger Nano X (one) | ✓ (pair w/ iPhone) | ✓ (pair w/ iPhone) | ✓ (pair w/ Android) |
| Testnet-funded XRP account on Ledger | ✓ | ✓ | ✓ |

Bluetooth pairing typically sticks after the first successful pair, so switching demos between rehearsal runs is fast.

---

## Recommended demo day plan

### Primary: Flow C — Android browser + WebBluetooth + Ledger

Bulletproof, self-contained, built today. Runs on one codebase (the Vercel web app) with no app store and no entitlements to chase.

Judges see: iPad shows merchant dashboard → merchant creates checkout on the iPad → merchant points camera-phone at the generated QR (or operator types the session id) → Android phone in Chrome lands on `/pay/<id>` → taps "Connect Ledger" → Bluetooth pairing (one-time; stays paired) → taps "Approve payment" → **physical Ledger Nano X shows Destination and Amount** → user clicks the Ledger buttons → iPad flips to **PAID** live via SSE.

The "wow" is the hardware wallet + browser + real XRPL testnet, zero native app. Not something most payment demos can claim.

### Bonus: Flow B — phone-to-phone NFC

Do this on stage only if the iOS app is done and you've rehearsed the tap alignment at least twice. Same Ledger, now paired with the iPhone instead of the Android. Android runs the HCE spike showing READY with the session id preset. iPhone taps the Android once, opens the checkout, Ledger signs. Adds the physical-tap moment to the demo.

If NFC alignment flakes on stage, the iPhone app should fall back to scanning the QR on the merchant iPad — same flow from there. Rehearse this recovery path.

### If nothing else works: Flow A — iPhone + QR

The safer variant of Flow B with no NFC. Same iOS app dependency, same Ledger-on-iPhone. Only take this path if you've decided not to attempt NFC at all.

---

## Per-flow pre-demo checklist

### Flow C (primary — do this one for sure)

- [ ] Vercel deploy is live at a stable URL; `PUBLIC_BASE_URL` env is set to that URL so QR / links encode the right host
- [ ] `XRPL_MODE=real` and `XRPL_NETWORK=testnet` in Vercel env vars
- [ ] Ledger Nano X: firmware current, XRP app installed via Ledger Live, app open before rehearsal
- [ ] Ledger's XRP account is testnet-funded (use `https://faucet.altnet.rippletest.net/accounts`) — at least a few test XRP
- [ ] Android phone: Chrome 70+, Bluetooth on, location permission granted (WebBluetooth requires it), HTTPS site trusted
- [ ] Completed at least one real-device run end-to-end. Filled in `apps/web/WEB_LEDGER.md` report template
- [ ] iPad / merchant laptop: `/session/<id>` loads, SSE transport shows as `sse` not `polling`
- [ ] Noted the iPad's URL bar font size — sessions expire in 10 minutes, be ready to make a fresh one between rehearsal runs

### Flow B (phone-to-phone — only if iOS app is ready)

- [ ] iOS native app builds and installs with `com.apple.developer.nfc.readersession.iso7816.select-identifiers` entitlement listing `F0434F4C44544150`
- [ ] iOS app pairs cleanly with Ledger over CoreBluetooth (rehearse 3x)
- [ ] Android phone: HCE spike app from `apps/android/` installed; `adb logcat -s ColdTapHCE` confirmed to fire on tap during a desktop-side dummy reader test
- [ ] ColdTap HCE set as **default tap-and-pay** on the Android phone OR confirmed the foreground-app routing works (it should for non-payment AIDs)
- [ ] Operator knows to paste the session id into the Android app before the demo starts, and to keep the Android screen on
- [ ] Tap alignment rehearsed: phones back-to-back, top-third of each, held for ~1 second
- [ ] Fallback path rehearsed: if NFC fails, iPhone scans the QR on the iPad instead

### Flow A (backup to B)

- [ ] Everything in B except the Android phone
- [ ] iPhone app can scan the QR rendered on `/session/<id>` via universal link OR the in-app QR scanner — both should open the session

---

## What can fail on stage, and what to do

| Failure | Detection | Recovery |
|---|---|---|
| WebBluetooth pairing times out | Phone shows "No Ledger selected" | Tap "Try again", re-pick the Nano X in the picker |
| Ledger shows "XRP app is not open" | Phone shows transport error | Unlock Ledger, open XRP app, try again |
| Signed blob rejected by backend | Phone shows error with reason | Check `apps/web/WEB_LEDGER.md` "Known risks" — most likely an outdated Ledger XRP app |
| Session expired (10 min timeout) | Phone returns 410 on /submit-signed | Make a new session on the iPad; update the payload |
| NFC tap not detected (Flow B) | Nothing happens after 3s | Re-align, try again. If still failing, abandon NFC — scan the QR on the iPad |
| iPad dashboard doesn't update | iPad shows stale state | Polling fallback kicks in within 2s; if not, reload |
| Vercel SSE connection drops on Hobby plan | iPad shows `polling` transport | No action — polling covers it |

The single-Ledger constraint doesn't limit any of this. It just means the Ledger needs to be pre-paired with the buyer phone for the current flow.

---

## Related docs

- `README.md` — architecture + deploy
- `apps/web/WEB_LEDGER.md` — step-by-step real-device test plan for Flow C
- `apps/android/README.md` — HCE spike (Flow B tap target)
- `apps/ios/README.md` — iOS integration contract (Flows A + B)
