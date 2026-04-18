export const SESSION_STATUSES = [
  "CREATED",
  "AWAITING_BUYER",
  "AWAITING_SIGNATURE",
  "SUBMITTED",
  "VALIDATING",
  "PAID",
  "FAILED",
  "EXPIRED",
] as const;

export type SessionStatus = (typeof SESSION_STATUSES)[number];

export const NETWORKS = ["mainnet", "testnet", "devnet", "mock"] as const;
export type NetworkId = (typeof NETWORKS)[number];

export interface Session {
  id: string;
  merchantName: string;
  itemName: string;
  amountDrops: string;
  amountDisplay: string;
  currency: "XRP";
  destinationAddress: string;
  memo?: string;
  status: SessionStatus;
  network: NetworkId;
  txHash?: string;
  failureReason?: string;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
  paidAt?: string;
  failedAt?: string;
  expiredAt?: string;
}

/** Unsigned XRP Payment transaction from POST /api/sessions/:id/prepare */
export interface XrplUnsignedTransaction {
  TransactionType: "Payment";
  Destination: string;
  Amount: string;        // drops as string
  Sequence?: number;
  Fee: string;           // drops as string
  LastLedgerSequence?: number;
  Flags?: number;
  DestinationTag?: number;
  InvoiceID?: string;    // hex-encoded 32-byte hash binding tx to session
  Memos?: Array<{
    Memo: {
      MemoData?: string;    // hex-encoded UTF-8
      MemoType?: string;    // hex-encoded mime type
      MemoFormat?: string;  // hex-encoded content format
    };
  }>;
  Account?: string;       // filled in by backend or iOS before signing
  // SigningPubKey is injected by iOS after Ledger connect
}

/** Backend-built unsigned payment — Account is always set */
export type UnsignedPayment = XrplUnsignedTransaction & { Account: string };

export interface PreparePayloadResponse {
  sessionId: string;
  network: NetworkId;
  expiresAt: string;
  merchant: {
    name: string;
    itemName: string;
    amountDrops: string;
    amountDisplay: string;
    memo?: string;
  };
  unsignedTx: UnsignedPayment;
  immutableFields: string[];
  autofilled: boolean;
}

/** Alias matching backend route response shape */
export type PrepareSessionResponse = PreparePayloadResponse;

export interface SubmitSessionRequest {
  txBlob: string;
}

export interface SubmitSessionResponse {
  txHash: string;
}

export interface SubmitSignedResponse {
  txHash: string;
  status: "SUBMITTED";
}

export interface UpdateStatusRequest {
  status: SessionStatus;
}
