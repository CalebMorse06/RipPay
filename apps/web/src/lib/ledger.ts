"use client";

/**
 * Thin client-side wrapper around Ledger Nano X via WebBluetooth.
 *
 * All imports happen lazily inside the action functions because
 * @ledgerhq/hw-transport-web-ble touches `navigator.bluetooth` at module-init
 * time, which breaks Next.js SSR. By dynamic-importing only when the user
 * clicks "Connect" we keep the server render free of browser-only code.
 *
 * Requires:
 *   - HTTPS (Vercel provides this; localhost also works)
 *   - A user gesture (click) — the browser will not pop the pairing UI otherwise
 *   - Chrome on Android, or Chrome/Edge on desktop (iOS has no WebBluetooth)
 */

export interface LedgerAccount {
  address: string;
  publicKey: string;
}

/** Default XRP derivation path per SLIP-44 / BIP-44. */
export const DEFAULT_XRP_PATH = "44'/144'/0'/0/0";

export async function connectLedger(): Promise<{
  transport: unknown;
  disconnect: () => Promise<void>;
  getAccount: (path?: string) => Promise<LedgerAccount>;
  signTxHex: (path: string, rawTxHex: string) => Promise<string>;
}> {
  const [{ default: TransportWebBLE }, { default: Xrp }] = await Promise.all([
    import("@ledgerhq/hw-transport-web-ble"),
    import("@ledgerhq/hw-app-xrp"),
  ]);

  const transport = await TransportWebBLE.create();
  const xrp = new Xrp(transport);

  return {
    transport,
    disconnect: async () => {
      try {
        await transport.close();
      } catch {
        /* already closed */
      }
    },
    getAccount: async (path = DEFAULT_XRP_PATH) => {
      const result = await xrp.getAddress(path);
      return { address: result.address, publicKey: result.publicKey.toUpperCase() };
    },
    signTxHex: async (path: string, rawTxHex: string) => {
      // hw-app-xrp accepts uppercase hex; the Ledger device adds the signing
      // prefix internally and returns a DER-encoded secp256k1 signature for
      // secp256k1 accounts (or ed25519 signature for ed25519 accounts). The
      // returned hex goes directly into the tx's TxnSignature field.
      const sig = await xrp.signTransaction(path, rawTxHex.toUpperCase());
      return sig.toUpperCase();
    },
  };
}

export function isWebBluetoothSupported(): boolean {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { bluetooth?: unknown };
  return typeof nav.bluetooth !== "undefined";
}
