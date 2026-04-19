import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { isValidClassicAddress } from "xrpl";
import { CreateSessionSchema, type Session } from "@coldtap/shared";
import { sessionStore } from "@/server/store";
import { sessionEvents } from "@/server/events";
import { dropsToUsd, formatXrp, usdToDrops } from "@/lib/drops";
import { getNetwork } from "@/server/config";
import { getXrpUsdRate } from "@/server/rates";

const DEFAULT_EXPIRY_SEC = 600;

// Priced-in-USD: fiatAmount is authoritative, set alongside exchangeRate + fiatDisplay.
// Priced-in-XRP: fiatAmount stays undefined (discriminant). exchangeRate + fiatDisplay
// may still be populated as a best-effort secondary-line hint for the buyer screen.
type FiatSnapshot = {
  fiatAmount?: string;
  fiatCurrency?: "USD";
  exchangeRate: string;
  fiatDisplay: string;
};

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = CreateSessionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  // Format regex can't catch base58check typos — verify the trailing checksum
  // so `xrpl.encode()` never throws `checksum_invalid` during signing.
  if (!isValidClassicAddress(parsed.data.destinationAddress)) {
    return NextResponse.json(
      {
        error: "destinationAddress has an invalid checksum. Double-check the r-address — a single mistyped character will pass the format check but fail here.",
      },
      { status: 400 },
    );
  }

  // Lock the XRP amount here — fiat-priced sessions snapshot the rate so the
  // buyer's checkout screen stays deterministic through the Ledger approval.
  let amountDrops: string;
  let fiatSnapshot: FiatSnapshot | undefined;
  if (parsed.data.fiatAmount) {
    let rate: number;
    try {
      ({ rate } = await getXrpUsdRate());
    } catch {
      return NextResponse.json(
        { error: "Couldn't fetch XRP price. Try again in a moment." },
        { status: 502 },
      );
    }
    try {
      amountDrops = usdToDrops(parsed.data.fiatAmount, rate);
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Invalid USD amount" },
        { status: 400 },
      );
    }
    fiatSnapshot = {
      fiatAmount: parsed.data.fiatAmount,
      fiatCurrency: "USD",
      exchangeRate: rate.toFixed(6),
      fiatDisplay: `$${Number(parsed.data.fiatAmount).toFixed(2)} USD`,
    };
  } else {
    // Zod refine guarantees one of the two is set; non-null asserted for TS.
    amountDrops = parsed.data.amountDrops!;
    // Best-effort: enrich XRP-priced sessions with a USD secondary display so
    // the buyer sees both units. Rate-fetch failure is non-fatal — sticker and
    // curl flows keep working if CoinGecko is down. fiatAmount stays undefined
    // so downstream code knows the vendor priced this session in XRP.
    try {
      const { rate } = await getXrpUsdRate();
      fiatSnapshot = {
        exchangeRate: rate.toFixed(6),
        fiatDisplay: `$${dropsToUsd(amountDrops, rate)} USD`,
      };
    } catch {
      // Silently skip — XRP-only sessions are still valid.
    }
  }

  const now = new Date();
  const expiresInSec = parsed.data.expiresInSec ?? DEFAULT_EXPIRY_SEC;
  const session: Session = {
    id: `s_${nanoid(12)}`,
    merchantName: parsed.data.merchantName,
    itemName: parsed.data.itemName,
    amountDrops,
    amountDisplay: formatXrp(amountDrops),
    currency: "XRP",
    destinationAddress: parsed.data.destinationAddress,
    memo: parsed.data.memo,
    status: "AWAITING_BUYER",
    network: getNetwork(),
    expiresAt: new Date(now.getTime() + expiresInSec * 1000).toISOString(),
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    ...(fiatSnapshot ?? {}),
  };

  await sessionStore.create(session);
  sessionEvents.emit(session);
  return NextResponse.json(session, { status: 201 });
}
