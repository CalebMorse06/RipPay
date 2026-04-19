const DROPS_PER_XRP = 1_000_000n;

export function dropsToXrp(drops: string): string {
  const n = BigInt(drops);
  const whole = n / DROPS_PER_XRP;
  const frac = n % DROPS_PER_XRP;
  if (frac === 0n) return whole.toString();
  const fracStr = frac.toString().padStart(6, "0").replace(/0+$/, "");
  return `${whole.toString()}.${fracStr}`;
}

export function formatXrp(drops: string): string {
  return `${dropsToXrp(drops)} XRP`;
}

export function xrpToDrops(xrp: string): string {
  const [whole, frac = ""] = xrp.trim().split(".");
  if (!/^\d+$/.test(whole) || (frac && !/^\d+$/.test(frac))) {
    throw new Error("Invalid XRP amount");
  }
  const fracPadded = (frac + "000000").slice(0, 6);
  const drops = BigInt(whole) * DROPS_PER_XRP + BigInt(fracPadded);
  if (drops <= 0n) throw new Error("Amount must be positive");
  return drops.toString();
}

export function usdToDrops(usd: string, xrpUsdRate: number): string {
  const usdNum = Number(usd);
  if (!Number.isFinite(usdNum) || usdNum <= 0) throw new Error("Invalid USD amount");
  if (!Number.isFinite(xrpUsdRate) || xrpUsdRate <= 0) throw new Error("Invalid rate");
  const xrp = usdNum / xrpUsdRate;
  const drops = Math.round(xrp * 1_000_000);
  if (drops <= 0) throw new Error("USD amount too small to represent in drops");
  return String(drops);
}

export function dropsToUsd(drops: string, xrpUsdRate: number): string {
  if (!Number.isFinite(xrpUsdRate) || xrpUsdRate <= 0) throw new Error("Invalid rate");
  const xrp = Number(dropsToXrp(drops));
  if (!Number.isFinite(xrp)) throw new Error("Invalid drops");
  return (xrp * xrpUsdRate).toFixed(2);
}
