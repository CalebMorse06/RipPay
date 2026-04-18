import { z } from "zod";
import { SESSION_STATUSES } from "./session";

const DROPS_REGEX = /^[1-9]\d*$/;
const R_ADDRESS_REGEX = /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/;
const HEX_REGEX = /^[0-9A-Fa-f]+$/;

export const SessionStatusSchema = z.enum(SESSION_STATUSES);

export const SessionSchema = z.object({
  id: z.string().min(1),
  merchantName: z.string().min(1).max(80),
  itemName: z.string().min(1).max(120),
  amountDrops: z.string().regex(DROPS_REGEX, "amountDrops must be a positive integer string"),
  amountDisplay: z.string().min(1),
  currency: z.literal("XRP"),
  destinationAddress: z.string().regex(R_ADDRESS_REGEX, "destinationAddress must be a valid XRPL r-address"),
  memo: z.string().max(256).optional(),
  status: SessionStatusSchema,
  txHash: z.string().regex(HEX_REGEX).optional(),
  expiresAt: z.string().datetime(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const CreateSessionSchema = z.object({
  merchantName: z.string().trim().min(1).max(80),
  itemName: z.string().trim().min(1).max(120),
  amountDrops: z.string().regex(DROPS_REGEX, "amountDrops must be a positive integer string (drops)"),
  destinationAddress: z.string().regex(R_ADDRESS_REGEX, "destinationAddress must be a valid XRPL r-address"),
  memo: z.string().max(256).optional(),
  expiresInSec: z.number().int().positive().max(3600).optional(),
});

export const SubmitSessionSchema = z.object({
  txBlob: z.string().regex(HEX_REGEX, "txBlob must be a hex-encoded signed transaction"),
});

export const StatusUpdateSchema = z.object({
  status: SessionStatusSchema,
  txHash: z.string().regex(HEX_REGEX).optional(),
});
