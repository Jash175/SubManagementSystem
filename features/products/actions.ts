"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/features/auth/guards";
import {
  productSchema,
  productVariantSchema,
  assignProductTaxesSchema,
  type ProductInput,
  type ProductVariantInput,
  type AssignProductTaxesInput,
} from "./schemas";
import type { ActionResult, Product, ProductVariant } from "@/types";

/**
 * Server Action: Create a new catalogue product (Admin only)
 */
export async function createProductAction(
  input: ProductInput
): Promise<ActionResult<Product>> {
  try {
    const adminSession = await requireAdmin();
    const parsed = productSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Invalid product data",
      };
    }

    const supabase = await getSupabaseServerClient();
    if (!supabase) {
      return {
        success: false,
        error: "Database client is not available in this environment.",
      };
    }

    const { data, error } = await supabase
      .from("products")
      .insert({
        product_code: parsed.data.productCode,
        name: parsed.data.name,
        product_type: parsed.data.productType,
        sales_price: parsed.data.salesPrice,
        cost_price: parsed.data.costPrice,
        currency_code: parsed.data.currencyCode,
        notes: parsed.data.notes || null,
        is_active: parsed.data.isActive,
        created_by: adminSession.id,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return {
          success: false,
          error: `A product with code "${parsed.data.productCode}" already exists.`,
        };
      }
      return {
        success: false,
        error: error.message || "Failed to create product",
      };
    }

    revalidatePath("/products");
    return {
      success: true,
      message: `Product "${data.name}" (${data.product_code}) created successfully.`,
      data: {
        id: data.id,
        productCode: data.product_code,
        name: data.name,
        productType: data.product_type,
        salesPrice: Number(data.sales_price),
        costPrice: Number(data.cost_price),
        currencyCode: data.currency_code,
        notes: data.notes,
        isActive: data.is_active,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      },
    };
  } catch (err: unknown) {
    const error = err as Error;
    return {
      success: false,
      error: error.message || "An unexpected error occurred",
    };
  }
}

/**
 * Server Action: Update an existing product (Admin only)
 */
export async function updateProductAction(
  id: string,
  input: ProductInput
): Promise<ActionResult<Product>> {
  try {
    await requireAdmin();
    const parsed = productSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Invalid product data",
      };
    }

    const supabase = await getSupabaseServerClient();
    if (!supabase) {
      return {
        success: false,
        error: "Database client is not available in this environment.",
      };
    }

    const { data, error } = await supabase
      .from("products")
      .update({
        product_code: parsed.data.productCode,
        name: parsed.data.name,
        product_type: parsed.data.productType,
        sales_price: parsed.data.salesPrice,
        cost_price: parsed.data.costPrice,
        currency_code: parsed.data.currencyCode,
        notes: parsed.data.notes || null,
        is_active: parsed.data.isActive,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return {
        success: false,
        error: error.message || "Failed to update product",
      };
    }

    revalidatePath("/products");
    return {
      success: true,
      message: `Product "${data.name}" updated successfully.`,
    };
  } catch (err: unknown) {
    const error = err as Error;
    return {
      success: false,
      error: error.message || "An unexpected error occurred",
    };
  }
}

/**
 * Server Action: Toggle active / archive state on a product (Admin only)
 */
export async function archiveProductAction(
  id: string,
  targetActiveState: boolean
): Promise<ActionResult> {
  try {
    await requireAdmin();
    const supabase = await getSupabaseServerClient();
    if (!supabase) {
      return {
        success: false,
        error: "Database client is not available in this environment.",
      };
    }

    const { error } = await supabase
      .from("products")
      .update({
        is_active: targetActiveState,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      return {
        success: false,
        error: error.message || "Failed to update product status",
      };
    }

    revalidatePath("/products");
    return {
      success: true,
      message: targetActiveState ? "Product activated." : "Product archived.",
    };
  } catch (err: unknown) {
    const error = err as Error;
    return {
      success: false,
      error: error.message || "An unexpected error occurred",
    };
  }
}

/**
 * Server Action: Create a product variant with price delta (Admin only)
 * Includes required Odoo brand variant example: +560.00
 */
export async function createVariantAction(
  productId: string,
  input: ProductVariantInput
): Promise<ActionResult<ProductVariant>> {
  try {
    await requireAdmin();
    const parsed = productVariantSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Invalid variant data",
      };
    }

    const supabase = await getSupabaseServerClient();
    if (!supabase) {
      return {
        success: false,
        error: "Database client is not available in this environment.",
      };
    }

    const { data, error } = await supabase
      .from("product_variants")
      .insert({
        product_id: productId,
        attribute_name: parsed.data.attributeName,
        attribute_value: parsed.data.attributeValue,
        price_delta: parsed.data.priceDelta,
        is_active: parsed.data.isActive,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return {
          success: false,
          error: `Variant "${parsed.data.attributeName}: ${parsed.data.attributeValue}" already exists for this product.`,
        };
      }
      return {
        success: false,
        error: error.message || "Failed to create variant",
      };
    }

    revalidatePath("/products");
    return {
      success: true,
      message: `Variant "${data.attribute_name}: ${data.attribute_value}" (delta ${data.price_delta >= 0 ? "+" : ""}${data.price_delta}) added successfully.`,
      data: {
        id: data.id,
        productId: data.product_id,
        attributeName: data.attribute_name,
        attributeValue: data.attribute_value,
        priceDelta: Number(data.price_delta),
        isActive: data.is_active,
        createdAt: data.created_at,
      },
    };
  } catch (err: unknown) {
    const error = err as Error;
    return {
      success: false,
      error: error.message || "An unexpected error occurred",
    };
  }
}

/**
 * Server Action: Assign taxes to a product (Admin only)
 */
export async function assignProductTaxesAction(
  productId: string,
  input: AssignProductTaxesInput
): Promise<ActionResult> {
  try {
    await requireAdmin();
    const parsed = assignProductTaxesSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Invalid tax assignment data",
      };
    }

    const supabase = await getSupabaseServerClient();
    if (!supabase) {
      return {
        success: false,
        error: "Database client is not available in this environment.",
      };
    }

    // Replace product taxes
    await supabase.from("product_taxes").delete().eq("product_id", productId);

    if (parsed.data.taxIds.length > 0) {
      const rows = parsed.data.taxIds.map((taxId) => ({
        product_id: productId,
        tax_id: taxId,
      }));
      const { error } = await supabase.from("product_taxes").insert(rows);
      if (error) {
        return {
          success: false,
          error: error.message || "Failed to assign taxes",
        };
      }
    }

    revalidatePath("/products");
    return {
      success: true,
      message: "Product taxes updated successfully.",
    };
  } catch (err: unknown) {
    const error = err as Error;
    return {
      success: false,
      error: error.message || "An unexpected error occurred",
    };
  }
}
