import { z } from "zod";

export const recordPaymentSchema = z.object({
  invoiceId: z.string().uuid("Invalid invoice ID"),
  amount: z
    .number()
    .positive("Payment amount must be greater than zero")
    .refine(
      (val) => Number.isFinite(val) && Math.round(val * 100) === val * 100,
      "Payment amount can have at most 2 decimal places"
    ),
  paymentMethod: z.enum(
    ["cash", "bank_transfer", "upi", "card", "cheque", "other"],
    { message: "Invalid payment method" }
  ),
  paidAt: z.string().optional(),
  referenceNumber: z
    .string()
    .trim()
    .max(100, "Reference number cannot exceed 100 characters")
    .optional()
    .nullable(),
  note: z
    .string()
    .trim()
    .max(500, "Note cannot exceed 500 characters")
    .optional()
    .nullable(),
});

export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;
