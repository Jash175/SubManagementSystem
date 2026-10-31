import { z } from "zod";

export const taxSchema = z.object({
  taxCode: z
    .string()
    .min(2, "Tax code must be at least 2 characters")
    .max(50, "Tax code must be 50 characters or less")
    .regex(/^[A-Za-z0-9-_]+$/, "Tax code may only contain letters, numbers, hyphens and underscores")
    .transform((val) => val.toUpperCase()),
  name: z
    .string()
    .min(2, "Tax name must be at least 2 characters")
    .max(100, "Tax name must be 100 characters or less"),
  ratePercent: z
    .coerce
    .number()
    .min(0, "Tax rate cannot be negative")
    .max(100, "Tax rate cannot exceed 100%"),
  isActive: z.boolean().default(true),
});

export type TaxInput = z.infer<typeof taxSchema>;
