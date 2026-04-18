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

export interface SubmitSessionRequest {
  signedTxBlob: string;
}

export interface SubmitSessionResponse {
  txHash: string;
}

export interface UpdateStatusRequest {
  status: SessionStatus;
}
