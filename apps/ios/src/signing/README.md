# Signing backends

Two signing paths share a single `Signer` interface so the rest of the app (specifically `ProcessingScreen`) doesn't care which one the user picked.

## Files

| File | Purpose |
|---|---|
| [`Signer.ts`](./Signer.ts) | The interface. Three methods: `progressSteps()`, `prepare(onStep)`, `sign(tx, addr, pk, onStep)`, plus `cleanup()`. `progressSteps` drives the UI dots so each backend renders its own flow. |
| [`LedgerSigner.ts`](./LedgerSigner.ts) | **Hardware path.** BLE → `@ledgerhq/hw-app-xrp` at BIP44 `44'/144'/0'/0/0`. Consumes a prewarmed transport when available (see `../hooks/useLedgerPrewarm.ts`) to hide the ~3–5s handshake from the critical path. The XRPL transaction is encoded client-side (`../ledger/TransactionBuilder.ts`), signed on-device, and re-encoded with the returned `TxnSignature`. |
| [`LocalSigner.ts`](./LocalSigner.ts) | **On-device path.** An XRPL family seed is stored in the iOS Keychain with `BIOMETRY_CURRENT_SET_OR_DEVICE_PASSCODE` + `WHEN_UNLOCKED_THIS_DEVICE_ONLY`. `prepare()` triggers Face ID to unlock the seed; signing uses `xrpl.Wallet.sign`. The seed never leaves the device; the in-memory `Wallet` is cleared in `cleanup()`. |
| [`getSigner.ts`](./getSigner.ts) | Reads the user's stored preference (`../utils/signingPrefs.ts`) and returns the matching instance. |

## Why both

RipPay's marquee story is cold-storage-at-the-register — a hardware wallet signing an XRPL payment in a physical checkout flow. But a judge without a funded Ledger Nano X shouldn't be blocked from running the demo, so `LocalSigner` exists as a second path that produces an identical signed blob using xrpl.js on-device. The backend treats both the same: every `tx_blob` runs through `../../../web/src/server/xrpl/verify.ts` regardless of where it was signed.

See the [root README's signing section](../../../../../README.md#two-signing-paths) for the broader justification.
