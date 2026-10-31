import { z } from "zod";

export const billingRunInputSchema = z.object({
  asOfDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be in YYYY-MM-DD format")
    .optional(),
  triggerSource: z.enum(["manual", "scheduled", "retry"]).default("manual"),
  autoConfirm: z.boolean().default(false),
  subscriptionIds: z.array(z.string().uuid()).optional(),
});

export type BillingRunInput = z.infer<typeof billingRunInputSchema>;

export const generateSubscriptionInvoiceSchema = z.object({
  subscriptionId: z.string().uuid("Invalid subscription ID"),
  asOfDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be in YYYY-MM-DD format")
    .optional(),
  autoConfirm: z.boolean().default(false),
});

export type GenerateSubscriptionInvoiceInput = z.infer<
  typeof generateSubscriptionInvoiceSchema
>;

export const confirmInvoiceSchema = z.object({
  invoiceId: z.string().uuid("Invalid invoice ID"),
});

export type ConfirmInvoiceInput = z.infer<typeof confirmInvoiceSchema>;

export const cancelInvoiceSchema = z.object({
  invoiceId: z.string().uuid("Invalid invoice ID"),
  reason: z.string().max(500, "Reason must not exceed 500 characters").optional(),
});

export type CancelInvoiceInput = z.infer<typeof cancelInvoiceSchema>;
