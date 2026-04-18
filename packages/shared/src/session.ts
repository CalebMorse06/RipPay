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
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
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

export interface SubmitSessionRequest {
  /** Hex-encoded signed XRPL transaction blob from the hardware wallet. */
  txBlob: string;
}

export interface SubmitSessionResponse {
  txHash: string;
  status: Extract<SessionStatus, "SUBMITTED">;
}

export interface StatusUpdateRequest {
  status: SessionStatus;
  txHash?: string;
}
