import { z } from "zod";

export const createCustomerSchema = z.object({
  legalName: z.string().min(2, "Legal name must be at least 2 characters").max(100),
  companyName: z.string().max(100).optional().nullable(),
  email: z.string().email("Invalid email address"),
  phone: z.string().max(20).optional().nullable(),
  currencyCode: z.string().length(3).default("INR"),
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
