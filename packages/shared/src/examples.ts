/**
 * Example payloads for the ColdTap session contract.
 *
 * The iOS agent can read these as copy-pasteable references when wiring HTTP calls
 * or building fixtures. Keep these in sync whenever the schemas change.
 */

import type {
  CreateSessionRequest,
  Session,
  StatusUpdateRequest,
  SubmitSessionRequest,
  SubmitSessionResponse,
} from "./session";

const NOW = "2026-04-17T12:00:00.000Z";
const EXPIRES = "2026-04-17T12:10:00.000Z";

export const exampleCreateSessionRequest: CreateSessionRequest = {
  merchantName: "Demo Cafe",
  itemName: "Cold brew",
  amountDrops: "2500000",
  destinationAddress: "rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe",
  memo: "order-1042",
  expiresInSec: 600,
};

export const exampleSession: Session = {
  id: "s_8fK2nQ9rL4vT",
  merchantName: "Demo Cafe",
  itemName: "Cold brew",
  amountDrops: "2500000",
  amountDisplay: "2.50 XRP",
  currency: "XRP",
  destinationAddress: "rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe",
  memo: "order-1042",
  status: "AWAITING_BUYER",
  expiresAt: EXPIRES,
  createdAt: NOW,
  updatedAt: NOW,
};

export const examplePaidSession: Session = {
  ...exampleSession,
  status: "PAID",
  txHash: "E3FE6EA3D48F0C2B6C9F3DA2E7CA8B0C9E1234567890ABCDEF1234567890ABCD",
  updatedAt: "2026-04-17T12:00:42.000Z",
};

export const exampleSubmitRequest: SubmitSessionRequest = {
  txBlob:
    "120000228000000024000000006140000000002625A068400000000000000C7321ED...TRUNCATED...7446304402...",
};

export const exampleSubmitResponse: SubmitSessionResponse = {
  txHash: "E3FE6EA3D48F0C2B6C9F3DA2E7CA8B0C9E1234567890ABCDEF1234567890ABCD",
  status: "SUBMITTED",
};

export const exampleStatusUpdateRequest: StatusUpdateRequest = {
  status: "AWAITING_SIGNATURE",
};
