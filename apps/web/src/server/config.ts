import type { NetworkId } from "@coldtap/shared";

/**
 * Centralized env var reads. Every server module should go through here so we
 * have a single place to audit defaults and a single place to change them.
 */

export type XrplMode = "mock" | "real";

export function getXrplMode(): XrplMode {
  const raw = (process.env.XRPL_MODE ?? "mock").toLowerCase();
  return raw === "real" ? "real" : "mock";
}

export function getNetwork(): NetworkId {
  if (getXrplMode() === "mock") return "mock";
  const raw = (process.env.XRPL_NETWORK ?? "testnet").toLowerCase();
  return raw === "mainnet" ? "mainnet" : "testnet";
}

export function getXrplWsUrl(): string {
  if (process.env.XRPL_WS_URL) return process.env.XRPL_WS_URL;
  return getNetwork() === "mainnet"
    ? "wss://xrplcluster.com"
    : "wss://s.altnet.rippletest.net:51233";
}

export function getExplorerTxUrl(txHash: string): string {
  return getNetwork() === "mainnet"
    ? `https://livenet.xrpl.org/transactions/${txHash}`
    : `https://testnet.xrpl.org/transactions/${txHash}`;
}

/**
 * Derive a public base URL from the incoming request. Falls back to the
 * `PUBLIC_BASE_URL` env var, then to `NEXT_PUBLIC_BASE_URL`, then to
 * `http://localhost:3000`. Respects Vercel/Cloudflare-style forwarding headers.
 */
export function getBaseUrlFromRequest(req: Request | { headers: Headers }): string {
  const h = req.headers;
  const forwardedHost = h.get("x-forwarded-host") ?? h.get("host");
  const forwardedProto = h.get("x-forwarded-proto");

  if (process.env.PUBLIC_BASE_URL) return stripTrailingSlash(process.env.PUBLIC_BASE_URL);
  if (forwardedHost) {
    const proto =
      forwardedProto ?? (forwardedHost.includes("localhost") ? "http" : "https");
    return `${proto}://${forwardedHost}`;
  }
  if (process.env.NEXT_PUBLIC_BASE_URL)
    return stripTrailingSlash(process.env.NEXT_PUBLIC_BASE_URL);
  return "http://localhost:3000";
}

function stripTrailingSlash(s: string): string {
  return s.replace(/\/+$/, "");
}

export function getDefaultFeeDrops(): string {
  const raw = process.env.XRPL_DEFAULT_FEE_DROPS;
  if (raw && /^[1-9]\d*$/.test(raw)) return raw;
  return "12"; // XRPL reference cost is 10 drops; 12 gives headroom.
}

export function getLedgerOffset(): number {
  const raw = Number(process.env.XRPL_LEDGER_OFFSET ?? "40");
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 40;
}
