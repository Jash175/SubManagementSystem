import { z } from "zod";

export const productTypeEnum = z.enum([
  "software",
  "service",
  "physical",
  "addon",
  "other",
]);

export const productSchema = z.object({
  productCode: z
    .string()
    .min(2, "Product code must be at least 2 characters")
    .max(50, "Product code must be 50 characters or less")
    .regex(/^[A-Za-z0-9-_]+$/, "Product code may only contain letters, numbers, hyphens and underscores")
    .transform((val) => val.toUpperCase()),
  name: z
    .string()
    .min(2, "Product name must be at least 2 characters")
    .max(100, "Product name must be 100 characters or less"),
  productType: productTypeEnum,
  salesPrice: z
    .coerce
    .number()
    .min(0, "Sales price cannot be negative"),
  costPrice: z
    .coerce
    .number()
    .min(0, "Cost price cannot be negative")
    .default(0),
  currencyCode: z
    .string()
    .length(3, "Currency code must be a 3-letter ISO code (e.g. INR)")
    .default("INR"),
  notes: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
});

export type ProductInput = z.infer<typeof productSchema>;

export const productVariantSchema = z.object({
  attributeName: z
    .string()
    .min(1, "Attribute name is required (e.g. Brand, Tier, Storage)")
    .max(50, "Attribute name must be 50 characters or less"),
  attributeValue: z
    .string()
    .min(1, "Attribute value is required (e.g. Odoo, Enterprise, 100GB)")
    .max(50, "Attribute value must be 50 characters or less"),
  priceDelta: z
    .coerce
    .number()
    .default(0),
  isActive: z.boolean().default(true),
});

export type ProductVariantInput = z.infer<typeof productVariantSchema>;

export const assignProductTaxesSchema = z.object({
  taxIds: z.array(z.string().uuid("Invalid tax ID")),
});

export type AssignProductTaxesInput = z.infer<typeof assignProductTaxesSchema>;
