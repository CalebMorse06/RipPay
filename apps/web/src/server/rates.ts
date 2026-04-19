/**
 * XRP/USD rate fetcher. In-process cache with 60s fresh TTL; if the upstream
 * call fails but we have an entry < 5 min old, return it and log. Vercel cold
 * starts bypass the cache — fine at demo scale.
 */

const FRESH_MS = 60_000;
const STALE_MS = 5 * 60_000;
const COINGECKO_URL =
  "https://api.coingecko.com/api/v3/simple/price?ids=ripple&vs_currencies=usd";

let cache: { rate: number; fetchedAt: number } | null = null;

export async function getXrpUsdRate(): Promise<{ rate: number; fetchedAt: number }> {
  const now = Date.now();
  if (cache && now - cache.fetchedAt < FRESH_MS) return cache;

  try {
    const res = await fetch(COINGECKO_URL, {
      headers: { accept: "application/json" },
    });
    if (!res.ok) throw new Error(`coingecko HTTP ${res.status}`);
    const json = (await res.json()) as { ripple?: { usd?: number } };
    const rate = json.ripple?.usd;
    if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) {
      throw new Error("coingecko: missing or invalid rate");
    }
    cache = { rate, fetchedAt: now };
    return cache;
  } catch (err) {
    if (cache && now - cache.fetchedAt < STALE_MS) {
      console.warn(
        "[coldtap:rates] using stale cache",
        err instanceof Error ? err.message : String(err),
      );
      return cache;
    }
    throw err;
  }
}
