import { z } from "zod";
import { NETWORKS, SESSION_STATUSES } from "./session";

const DROPS_REGEX = /^[1-9]\d*$/;
const R_ADDRESS_REGEX = /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/;
const HEX_REGEX = /^[0-9A-Fa-f]+$/;
const HEX_256_REGEX = /^[0-9A-Fa-f]{64}$/;
const USD_REGEX = /^\d+(\.\d{1,2})?$/;

export const SessionStatusSchema = z.enum(SESSION_STATUSES);
export const NetworkSchema = z.enum(NETWORKS);

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
  network: NetworkSchema,
  failureReason: z.string().max(500).optional(),
  expiresAt: z.string().datetime(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  paidAt: z.string().datetime().optional(),
  failedAt: z.string().datetime().optional(),
  expiredAt: z.string().datetime().optional(),
  fiatAmount: z.string().regex(USD_REGEX).optional(),
  fiatCurrency: z.literal("USD").optional(),
  exchangeRate: z.string().optional(),
  fiatDisplay: z.string().optional(),
});

export const CreateSessionSchema = z
  .object({
    merchantName: z.string().trim().min(1).max(80),
    itemName: z.string().trim().min(1).max(120),
    amountDrops: z
      .string()
      .regex(DROPS_REGEX, "amountDrops must be a positive integer string (drops)")
      .optional(),
    fiatAmount: z
      .string()
      .regex(USD_REGEX, "fiatAmount must look like '3' or '3.50'")
      .optional(),
    fiatCurrency: z.literal("USD").optional(),
    destinationAddress: z
      .string()
      .regex(R_ADDRESS_REGEX, "destinationAddress must be a valid XRPL r-address"),
    memo: z.string().max(256).optional(),
    expiresInSec: z.number().int().positive().max(3600).optional(),
  })
  .refine(
    (v) => (v.amountDrops == null) !== (v.fiatAmount == null),
    { message: "Provide exactly one of amountDrops or fiatAmount" },
  )
  .refine(
    (v) => v.fiatAmount == null || v.fiatCurrency === "USD",
    { message: "fiatCurrency is required when fiatAmount is set" },
  );

export const PrepareSessionSchema = z.object({
  account: z.string().regex(R_ADDRESS_REGEX, "account must be a valid XRPL r-address").optional(),
});

export const SubmitSignedSchema = z.object({
  txBlob: z.string().regex(HEX_REGEX, "txBlob must be a hex-encoded signed transaction"),
});

/** Legacy name kept for the old /submit endpoint. */
export const SubmitSessionSchema = SubmitSignedSchema;

export const StatusUpdateSchema = z.object({
  status: SessionStatusSchema,
  txHash: z.string().regex(HEX_REGEX).optional(),
});

export const InvoiceIdSchema = z.string().regex(HEX_256_REGEX, "InvoiceID must be 256-bit hex");
