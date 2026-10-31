import { z } from "zod";

export const billingIntervalUnitEnum = z.enum([
  "daily",
  "weekly",
  "monthly",
  "yearly",
]);

export const planSchema = z
  .object({
    planCode: z
      .string()
      .min(2, "Plan code must be at least 2 characters")
      .max(50, "Plan code must be 50 characters or less")
      .regex(/^[A-Za-z0-9-_]+$/, "Plan code may only contain letters, numbers, hyphens and underscores")
      .transform((val) => val.toUpperCase()),
    name: z
      .string()
      .min(2, "Plan name must be at least 2 characters")
      .max(100, "Plan name must be 100 characters or less"),
    description: z.string().optional().nullable(),
    price: z
      .coerce
      .number()
      .min(0, "Price cannot be negative"),
    currencyCode: z
      .string()
      .length(3, "Currency code must be a 3-letter ISO code (e.g. INR)")
      .default("INR"),
    billingIntervalUnit: billingIntervalUnitEnum,
    billingIntervalCount: z
      .coerce
      .number()
      .int("Interval count must be a whole integer")
      .min(1, "Billing interval count must be at least 1"),
    minimumQuantity: z
      .coerce
      .number()
      .min(0.001, "Minimum quantity must be greater than zero")
      .default(1),
    availableFrom: z.string().optional().nullable(),
    availableUntil: z.string().optional().nullable(),
    autoCloseOnEnd: z.boolean().default(false),
    allowEarlyClose: z.boolean().default(true),
    allowPause: z.boolean().default(false),
    allowRenewal: z.boolean().default(true),
    isActive: z.boolean().default(true),
  })
  .refine(
    (data) => {
      if (data.availableFrom && data.availableUntil) {
        return new Date(data.availableUntil) >= new Date(data.availableFrom);
      }
      return true;
    },
    {
      message: "Available-until date must be on or after available-from date",
      path: ["availableUntil"],
    }
  );

export type PlanInput = z.infer<typeof planSchema>;

export const assignPlanTaxesSchema = z.object({
  taxIds: z.array(z.string().uuid("Invalid tax ID")),
});

export type AssignPlanTaxesInput = z.infer<typeof assignPlanTaxesSchema>;
