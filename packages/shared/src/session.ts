export type SessionStatus =
  | "CREATED"
  | "AWAITING_BUYER"
  | "AWAITING_SIGNATURE"
  | "SUBMITTED"
  | "VALIDATING"
  | "PAID"
  | "FAILED"
  | "EXPIRED";

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
  txHash?: string;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}

/** Unsigned XRP Payment transaction from POST /api/sessions/:id/prepare */
export interface XrplUnsignedTransaction {
  TransactionType: "Payment";
  Destination: string;
  Amount: string;        // drops as string
  Sequence: number;
  Fee: string;           // drops as string
  LastLedgerSequence: number;
  Flags?: number;
  DestinationTag?: number;
  Memos?: Array<{
    Memo: {
      MemoData?: string;   // hex-encoded UTF-8
      MemoType?: string;   // hex-encoded mime type
    };
  }>;
  // Account + SigningPubKey are NOT set here — filled in by iOS after Ledger connect
}

export interface PreparePayloadResponse {
  sessionId: string;
  unsignedTx: XrplUnsignedTransaction;
}

/** Alias matching backend route response shape */
export type PrepareSessionResponse = PreparePayloadResponse;

export interface SubmitSessionRequest {
  signedTxBlob: string;
}

export interface SubmitSessionResponse {
  txHash: string;
}

export interface UpdateStatusRequest {
  status: SessionStatus;
}
