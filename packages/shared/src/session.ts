/**
 * ColdTap canonical session contract.
 *
 * This file is the source of truth for the Session object and status enum.
 * Both the merchant web app and the iOS buyer app mirror these exact shapes.
 * Do not drift.
 */

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

export const TERMINAL_SESSION_STATUSES: readonly SessionStatus[] = [
  "PAID",
  "FAILED",
  "EXPIRED",
];

export const NETWORKS = ["mock", "testnet", "mainnet"] as const;
export type NetworkId = (typeof NETWORKS)[number];

export interface Session {
  id: string;
  merchantName: string;
  itemName: string;
  /** Integer-valued string, denominated in XRP drops (1 XRP = 1_000_000 drops). */
  amountDrops: string;
  /** Human-readable amount, e.g. "2.50 XRP". */
  amountDisplay: string;
  currency: "XRP";
  /** Destination XRPL classic address (r-address). */
  destinationAddress: string;
  memo?: string;
  status: SessionStatus;
  /** Final validated XRPL transaction hash. Set once status reaches SUBMITTED or later. */
  txHash?: string;
  /** Which XRPL network this session is settling on. `mock` = simulated for demo. */
  network: NetworkId;
  /** Human-readable error detail when status is FAILED. */
  failureReason?: string;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
  /** Set when the session reached PAID. */
  paidAt?: string;
  /** Set when the session reached FAILED. */
  failedAt?: string;
  /** Set when the session reached EXPIRED. */
  expiredAt?: string;
}

export interface CreateSessionRequest {
  merchantName: string;
  itemName: string;
  amountDrops: string;
  destinationAddress: string;
  memo?: string;
  /** Optional expiry window in seconds from creation. Defaults to 600 (10 minutes). */
  expiresInSec?: number;
}

/**
 * Request body for POST /api/sessions/:id/prepare.
 *
 * `account` is the buyer's XRPL classic address (the account that holds the
 * hardware-wallet keys). If provided, the backend autofills `Sequence` and
 * `LastLedgerSequence` from the network. If omitted, the backend returns a
 * partial payload and the client must autofill before signing.
 */
export interface PrepareSessionRequest {
  account?: string;
}

/**
 * Canonical unsigned XRPL Payment shape returned by /prepare.
 *
 * These fields MUST be signed exactly as given. The client must not rewrite
 * Destination, Amount, InvoiceID, Memos or the backend will reject the submission.
 */
export interface UnsignedPayment {
  TransactionType: "Payment";
  /** Buyer's source account. Empty string if the client did not pass `account`. */
  Account: string;
  Destination: string;
  /** XRP drops as integer string (e.g. "2500000"). */
  Amount: string;
  /** 256-bit hex string derived from the session id. Use as-is. */
  InvoiceID: string;
  /** Server-suggested fee in drops. */
  Fee: string;
  /** Autofilled when `account` is supplied in the prepare request. */
  Sequence?: number;
  /** Autofilled when `account` is supplied in the prepare request. */
  LastLedgerSequence?: number;
  /** Optional memo field carrying the human-readable session id for debugging. */
  Memos?: Array<{
    Memo: {
      MemoType: string;
      MemoData: string;
      MemoFormat?: string;
    };
  }>;
}

export interface PrepareSessionResponse {
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
  /** Canonical unsigned transaction. Sign and post back to /submit-signed as-is. */
  unsignedTx: UnsignedPayment;
  /** Fields the client MUST NOT modify before signing. */
  immutableFields: Array<keyof UnsignedPayment>;
  /** Whether `Sequence` and `LastLedgerSequence` were autofilled server-side. */
  autofilled: boolean;
}

/** Legacy name kept for the old /submit route. Prefer SubmitSignedRequest. */
export interface SubmitSessionRequest {
  /** Hex-encoded signed XRPL transaction blob from the hardware wallet. */
  txBlob: string;
}

export type SubmitSignedRequest = SubmitSessionRequest;

export interface SubmitSignedResponse {
  txHash: string;
  status: Extract<SessionStatus, "SUBMITTED">;
}

/** Legacy alias. */
export type SubmitSessionResponse = SubmitSignedResponse;

export interface StatusUpdateRequest {
  status: SessionStatus;
  txHash?: string;
}
