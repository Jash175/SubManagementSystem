import { z } from "zod";

export const discountScopeEnum = z.enum(["product", "subscription"]);
export const discountTypeEnum = z.enum(["fixed", "percentage"]);

export const discountSchema = z
  .object({
    discountCode: z
      .string()
      .min(2, "Discount code must be at least 2 characters")
      .max(50, "Discount code must be 50 characters or less")
      .regex(/^[A-Za-z0-9-_]+$/, "Discount code may only contain letters, numbers, hyphens and underscores")
      .transform((val) => val.toUpperCase()),
    name: z
      .string()
      .min(2, "Discount name must be at least 2 characters")
      .max(100, "Discount name must be 100 characters or less"),
    scope: discountScopeEnum,
    discountType: discountTypeEnum,
    value: z
      .coerce
      .number()
      .positive("Discount value must be greater than zero"),
    currencyCode: z
      .string()
      .length(3, "Currency code must be a 3-letter ISO code (e.g. INR)")
      .default("INR"),
    minimumPurchaseAmount: z
      .coerce
      .number()
      .min(0, "Minimum purchase amount cannot be negative")
      .default(0),
    minimumQuantity: z
      .coerce
      .number()
      .min(0, "Minimum quantity cannot be negative")
      .default(0),
    startsOn: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Start date must be formatted YYYY-MM-DD"),
    endsOn: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "End date must be formatted YYYY-MM-DD"),
    maxUses: z
      .coerce
      .number()
      .int("Maximum uses must be a whole integer")
      .positive("Maximum uses must be greater than zero")
      .optional()
      .nullable(),
    priority: z
      .coerce
      .number()
      .int()
      .default(100),
    isActive: z.boolean().default(true),
    productIds: z.array(z.string().uuid("Invalid product ID")).optional().default([]),
  })
  .refine(
    (data) => new Date(data.endsOn) >= new Date(data.startsOn),
    {
      message: "End date must be on or after start date",
      path: ["endsOn"],
    }
  )
  .refine(
    (data) => {
      if (data.discountType === "percentage") {
        return data.value <= 100;
      }
      return true;
    },
    {
      message: "Percentage discount value cannot exceed 100%",
      path: ["value"],
    }
  )
  .refine(
    (data) => {
      if (data.scope === "product") {
        return (data.productIds || []).length > 0;
      }
      return true;
    },
    {
      message: "Product-scoped discounts require at least one target product",
      path: ["productIds"],
    }
  );

export type DiscountInput = z.infer<typeof discountSchema>;
