import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { isValidClassicAddress } from "xrpl";
import { CreateSessionSchema, type Session } from "@coldtap/shared";
import { sessionStore } from "@/server/store";
import { sessionEvents } from "@/server/events";
import { formatXrp } from "@/lib/drops";
import { getNetwork } from "@/server/config";

const DEFAULT_EXPIRY_SEC = 600;

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

  const now = new Date();
  const expiresInSec = parsed.data.expiresInSec ?? DEFAULT_EXPIRY_SEC;
  const session: Session = {
    id: `s_${nanoid(12)}`,
    merchantName: parsed.data.merchantName,
    itemName: parsed.data.itemName,
    amountDrops: parsed.data.amountDrops,
    amountDisplay: formatXrp(parsed.data.amountDrops),
    currency: "XRP",
    destinationAddress: parsed.data.destinationAddress,
    memo: parsed.data.memo,
    status: "AWAITING_BUYER",
    network: getNetwork(),
    expiresAt: new Date(now.getTime() + expiresInSec * 1000).toISOString(),
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };

  await sessionStore.create(session);
  sessionEvents.emit(session);
  return NextResponse.json(session, { status: 201 });
}
