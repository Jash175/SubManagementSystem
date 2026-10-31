import { z } from "zod";

export const quotationTemplateLineSchema = z.object({
  productId: z.string().uuid("Product ID must be a valid UUID"),
  variantId: z.string().uuid("Variant ID must be a valid UUID").nullable().optional(),
  description: z.string().max(255).optional().nullable(),
  quantity: z.coerce.number().positive("Quantity must be greater than zero"),
  unitPriceOverride: z.coerce.number().min(0, "Price override cannot be negative").nullable().optional(),
});

export const quotationTemplateSchema = z.object({
  name: z.string().min(2, "Template name must be at least 2 characters").max(100),
  planId: z.string().uuid("Valid Plan ID is required"),
  validityDays: z.coerce.number().int().positive("Validity duration must be at least 1 day"),
  isActive: z.boolean().default(true),
  lines: z.array(quotationTemplateLineSchema).default([]),
});

export const quotationLineInputSchema = z.object({
  productId: z.string().uuid("Product ID is required"),
  variantId: z.string().uuid().nullable().optional(),
  description: z.string().max(255).optional().nullable(),
  quantity: z.coerce.number().positive("Quantity must be positive"),
  unitPriceOverride: z.coerce.number().min(0).nullable().optional(),
});

export const createQuotationFromTemplateSchema = z.object({
  customerId: z.string().uuid("Customer ID is required"),
  templateId: z.string().uuid("Template ID is required"),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Start date must be YYYY-MM-DD"),
  expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expiry date must be YYYY-MM-DD").nullable().optional(),
  planQuantity: z.coerce.number().positive("Plan quantity must be greater than 0").default(1),
  paymentTermsDays: z.coerce.number().int().min(0, "Payment terms days cannot be negative").default(0),
  lines: z.array(quotationLineInputSchema).optional(),
}).refine(
  (data) => !data.expiryDate || data.expiryDate >= data.startDate,
  {
    message: "Expiry date cannot be earlier than start date",
    path: ["expiryDate"],
  }
);

export const createQuotationDirectSchema = z.object({
  customerId: z.string().uuid("Customer ID is required"),
  planId: z.string().uuid("Plan ID is required"),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Start date must be YYYY-MM-DD"),
  expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expiry date must be YYYY-MM-DD").nullable().optional(),
  validityDays: z.coerce.number().int().positive("Validity days must be at least 1").default(30),
  planQuantity: z.coerce.number().positive("Plan quantity must be greater than 0").default(1),
  paymentTermsDays: z.coerce.number().int().min(0).default(0),
  lines: z.array(quotationLineInputSchema).default([]),
}).refine(
  (data) => !data.expiryDate || data.expiryDate >= data.startDate,
  {
    message: "Expiry date cannot be earlier than start date",
    path: ["expiryDate"],
  }
);

export const subscriptionActionSchema = z.object({
  action: z.enum([
    "send_quotation",
    "confirm",
    "activate",
    "pause",
    "resume",
    "close",
    "renew",
  ]),
  note: z.string().max(500).optional(),
  reason: z.string().max(255).optional(),
});

export type QuotationTemplateInput = z.infer<typeof quotationTemplateSchema>;
export type QuotationTemplateLineInput = z.infer<typeof quotationTemplateLineSchema>;
export type CreateQuotationFromTemplateInput = z.infer<typeof createQuotationFromTemplateSchema>;
export type CreateQuotationDirectInput = z.infer<typeof createQuotationDirectSchema>;
export type SubscriptionActionInput = z.infer<typeof subscriptionActionSchema>;
