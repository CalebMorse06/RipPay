# Web buyer path — WebBluetooth + Ledger signing

An Android phone running Chrome can complete a full XRPL checkout without any native app: it pairs with a Ledger Nano X over Bluetooth directly from the browser, signs a `Payment` transaction on-device, and submits the signed blob to the backend. The user just visits `/pay/<sessionId>`.

This file is the **testing handoff** — the code is wired and typechecks, but the flow cannot be verified in CI because it requires physical hardware.

---

## What's built

- `apps/web/src/app/pay/[id]/page.tsx` — buyer route, server-fetches the session and renders the client signing flow.
- `apps/web/src/components/LedgerPay.tsx` — the full flow UI: Connect → Pair → Pay → Signing → Submitted → Paid.
- `apps/web/src/lib/ledger.ts` — lazy-loads `@ledgerhq/hw-transport-web-ble` + `@ledgerhq/hw-app-xrp` at click time so SSR stays clean.
- `apps/web/src/lib/sign.ts` — turns a `PrepareSessionResponse.unsignedTx` plus a Ledger-supplied pubkey into the hex the Ledger signs over, and splices the returned signature back in for submission.

The backend is untouched — this path uses the same `/prepare` and `/submit-signed` routes the iOS app does, including the same `verifySignedBlob` check against `Destination` / `Amount` / `InvoiceID`.

---

## Hardware you need for the smoke test

- Android phone with Chrome 70+ (most phones from 2019 onward).
- Ledger Nano X with the **XRP** app installed (`Ledger Live` → My Ledger → App catalog → XRP).
- A testnet-funded XRP account on that Ledger. Fund via `https://faucet.altnet.rippletest.net/accounts` — paste the address the Ledger reveals via Ledger Live.
- A deployed ColdTap backend (Vercel) OR the local dev server exposed via something like `ngrok http 3000` — **WebBluetooth requires HTTPS** (or `localhost`, but your phone is not localhost to your laptop).

---

## Step-by-step on-device test

1. **Create a session** on the merchant side (iPad or laptop):
   ```
   https://<your-deploy>/                 ← merchant landing
   → fill form → redirects to /session/<id>
   ```
2. On the Android phone, open Chrome and visit:
   ```
   https://<your-deploy>/pay/<sessionId>
   ```
   Copy-paste the id from the merchant page, or scan the QR on the merchant page (it currently points at `/s/<id>`; paste the id manually into `/pay/<id>` for this test).
3. **Unlock the Ledger** and open the **XRP** app. The screen should read "XRP app is ready".
4. On the phone, tap **Connect Ledger Nano X**. Chrome pops a system Bluetooth chooser. Pick `Nano X ...`. Confirm pairing if prompted.
5. The page should show your XRP address. Tap **Approve payment on Ledger**.
6. The Ledger vibrates / shows the Payment review — verify:
   - **Destination** matches the session's `destinationAddress`
   - **Amount** matches `amountDrops / 1_000_000` XRP
   - **Fee** shows 12 drops (or your configured default)
   Approve with the right button.
7. The phone walks through `Submitting → Awaiting validation → Paid`. The merchant dashboard (iPad) mirrors this via SSE.

---

## What to check / log

If the flow breaks, capture this for debugging:

- **Chrome DevTools console** on the Android phone (enable USB debugging, connect to laptop, open `chrome://inspect`). Look for Ledger transport errors or `xrpl.encode` failures.
- **Backend logs**: the failure reason from `/submit-signed`. The most likely errors are:
  - `InvoiceID mismatch` — the Ledger may have rewritten or dropped the field. Check the signed blob's InvoiceID byte range against `invoiceIdFor(sessionId)`.
  - `Destination mismatch` — unlikely, would indicate tampering
  - `transaction is not signed` — the returned signature didn't land in `TxnSignature`. Check `buildSignedHex` output
- **The signed blob** — log from the phone via `console.log("signedHex", signedHex)` before the fetch. Paste into the XRPL explorer's "Decode" tool (https://testnet.xrpl.org/decoder) to inspect field-by-field.

---

## Known risks + fallback

- **`@ledgerhq/hw-app-xrp` and `InvoiceID`.** Older Ledger XRP app versions rejected transactions with `InvoiceID`. Current versions accept it, but if you see "Unsupported field" on the device, update the XRP app in Ledger Live. If the Ledger truly can't sign with InvoiceID, the fallback is to relax backend verification for the web-Ledger path only — a one-line change in `apps/web/src/app/api/sessions/[id]/submit-signed/route.ts`. Don't make that change unless the Ledger forces you to; InvoiceID is what binds the signature to the session.
- **WebBluetooth browser support.** Chrome Android only. If you end up on a phone without Chrome, the page displays an "unsupported" notice and the iPhone native path remains available.
- **Sequence / LastLedgerSequence drift.** `/prepare` autofills these from the ledger via the backend's `xrpl.Client`. If the transaction sits on the phone for > 60 seconds before signing, `LastLedgerSequence` may expire and XRPL will reject with `tefMAX_LEDGER`. Retry by reloading `/pay/<id>` — `/prepare` will fetch fresh values.

---

## What to report back after testing

Fill these in when the first real-device run completes:

- Phone model + Android + Chrome version: _______
- Ledger firmware version + XRP app version: _______
- Account derivation path used: `44'/144'/0'/0/0` (default) / other
- Bluetooth pairing step worked first try: _______
- Ledger displayed Destination / Amount correctly: _______
- Signed blob passed backend verification: _______ (if no, paste the `reason` from the 422 response)
- Final status the merchant screen reached: PAID / FAILED / EXPIRED / other
- Time from "Connect Ledger" click to "Paid" on iPad: ___ seconds
- Any notes for demo day: _______
