/**
 * Example payloads for the ColdTap session contract.
 *
 * The iOS agent can read these as copy-pasteable references when wiring HTTP calls
 * or building fixtures. Keep these in sync whenever the schemas change.
 */

import type {
  CreateSessionRequest,
  PrepareSessionRequest,
  PrepareSessionResponse,
  Session,
  StatusUpdateRequest,
  SubmitSignedRequest,
  SubmitSignedResponse,
} from "./session";

const NOW = "2026-04-18T12:00:00.000Z";
const EXPIRES = "2026-04-18T12:10:00.000Z";

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
  network: "testnet",
  expiresAt: EXPIRES,
  createdAt: NOW,
  updatedAt: NOW,
};

export const examplePrepareRequest: PrepareSessionRequest = {
  account: "rBuyerAccountExampleAddressAbc123",
};

export const examplePrepareResponse: PrepareSessionResponse = {
  sessionId: "s_8fK2nQ9rL4vT",
  network: "testnet",
  expiresAt: EXPIRES,
  merchant: {
    name: "Demo Cafe",
    itemName: "Cold brew",
    amountDrops: "2500000",
    amountDisplay: "2.50 XRP",
    memo: "order-1042",
  },
  unsignedTx: {
    TransactionType: "Payment",
    Account: "rBuyerAccountExampleAddressAbc123",
    Destination: "rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe",
    Amount: "2500000",
    InvoiceID: "CB1D0BF3F6BB2F5ED62AE4A8E6E3AD5C6AD34C53FCE76CD46CFB5A6F93A4E1BB",
    Fee: "12",
    Sequence: 19421234,
    LastLedgerSequence: 19421274,
    Memos: [
      {
        Memo: {
          MemoType: "636F6C647461702F73657373696F6E",
          MemoData: "735F38664B326E5139724C347654",
          MemoFormat: "746578742F706C61696E",
        },
      },
    ],
  },
  immutableFields: [
    "TransactionType",
    "Destination",
    "Amount",
    "InvoiceID",
    "Memos",
  ],
  autofilled: true,
};

export const examplePaidSession: Session = {
  ...exampleSession,
  status: "PAID",
  txHash: "E3FE6EA3D48F0C2B6C9F3DA2E7CA8B0C9E1234567890ABCDEF1234567890ABCD",
  updatedAt: "2026-04-18T12:00:42.000Z",
  paidAt: "2026-04-18T12:00:42.000Z",
};

export const exampleSubmitSignedRequest: SubmitSignedRequest = {
  txBlob:
    "120000228000000024000000006140000000002625A068400000000000000C7321ED...TRUNCATED...7446304402...",
};

export const exampleSubmitSignedResponse: SubmitSignedResponse = {
  txHash: "E3FE6EA3D48F0C2B6C9F3DA2E7CA8B0C9E1234567890ABCDEF1234567890ABCD",
  status: "SUBMITTED",
};

/** Legacy aliases. */
export const exampleSubmitRequest = exampleSubmitSignedRequest;
export const exampleSubmitResponse = exampleSubmitSignedResponse;

export const exampleStatusUpdateRequest: StatusUpdateRequest = {
  status: "AWAITING_SIGNATURE",
};
