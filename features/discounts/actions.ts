"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/features/auth/guards";
import { discountSchema, type DiscountInput } from "./schemas";
import type { ActionResult, Discount } from "@/types";

/**
 * Server Action: Create a new discount rule (Admin only per FR-DISCOUNT)
 */
export async function createDiscountAction(
  input: DiscountInput
): Promise<ActionResult<Discount>> {
  try {
    const adminSession = await requireAdmin();
    const parsed = discountSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Invalid discount data",
      };
    }

    const supabase = await getSupabaseServerClient();
    if (!supabase) {
      return {
        success: false,
        error: "Database client is not available in this environment.",
      };
    }

    const { data: discount, error } = await supabase
      .from("discounts")
      .insert({
        discount_code: parsed.data.discountCode,
        name: parsed.data.name,
        scope: parsed.data.scope,
        discount_type: parsed.data.discountType,
        value: parsed.data.value,
        currency_code: parsed.data.currencyCode,
        minimum_purchase_amount: parsed.data.minimumPurchaseAmount,
        minimum_quantity: parsed.data.minimumQuantity,
        starts_on: parsed.data.startsOn,
        ends_on: parsed.data.endsOn,
        max_uses: parsed.data.maxUses || null,
        priority: parsed.data.priority,
        is_active: parsed.data.isActive,
        created_by: adminSession.id,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return {
          success: false,
          error: `A discount rule with code "${parsed.data.discountCode}" already exists.`,
        };
      }
      return {
        success: false,
        error: error.message || "Failed to create discount rule",
      };
    }

    // Link eligible products if product-scoped
    if (parsed.data.scope === "product" && parsed.data.productIds && parsed.data.productIds.length > 0) {
      const rows = parsed.data.productIds.map((productId) => ({
        discount_id: discount.id,
        product_id: productId,
      }));
      const { error: linkError } = await supabase.from("discount_products").insert(rows);
      if (linkError) {
        return {
          success: false,
          error: "Discount created, but failed to link eligible products: " + linkError.message,
        };
      }
    }

    revalidatePath("/discounts");
    return {
      success: true,
      message: `Discount rule "${discount.name}" (${discount.discount_code}) created successfully.`,
      data: {
        id: discount.id,
        discountCode: discount.discount_code,
        name: discount.name,
        scope: discount.scope,
        discountType: discount.discount_type,
        value: Number(discount.value),
        currencyCode: discount.currency_code,
        minimumPurchaseAmount: Number(discount.minimum_purchase_amount),
        minimumQuantity: Number(discount.minimum_quantity),
        startsOn: discount.starts_on,
        endsOn: discount.ends_on,
        maxUses: discount.max_uses,
        priority: discount.priority,
        isActive: discount.is_active,
        createdAt: discount.created_at,
        updatedAt: discount.updated_at,
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
 * Server Action: Update a discount rule (Admin only)
 */
export async function updateDiscountAction(
  id: string,
  input: DiscountInput
): Promise<ActionResult<Discount>> {
  try {
    await requireAdmin();
    const parsed = discountSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Invalid discount data",
      };
    }

    const supabase = await getSupabaseServerClient();
    if (!supabase) {
      return {
        success: false,
        error: "Database client is not available in this environment.",
      };
    }

    const { data: discount, error } = await supabase
      .from("discounts")
      .update({
        discount_code: parsed.data.discountCode,
        name: parsed.data.name,
        scope: parsed.data.scope,
        discount_type: parsed.data.discountType,
        value: parsed.data.value,
        currency_code: parsed.data.currencyCode,
        minimum_purchase_amount: parsed.data.minimumPurchaseAmount,
        minimum_quantity: parsed.data.minimumQuantity,
        starts_on: parsed.data.startsOn,
        ends_on: parsed.data.endsOn,
        max_uses: parsed.data.maxUses || null,
        priority: parsed.data.priority,
        is_active: parsed.data.isActive,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return {
        success: false,
        error: error.message || "Failed to update discount rule",
      };
    }

    // Refresh discount products if product-scoped
    await supabase.from("discount_products").delete().eq("discount_id", id);
    if (parsed.data.scope === "product" && parsed.data.productIds && parsed.data.productIds.length > 0) {
      const rows = parsed.data.productIds.map((productId) => ({
        discount_id: id,
        product_id: productId,
      }));
      await supabase.from("discount_products").insert(rows);
    }

    revalidatePath("/discounts");
    return {
      success: true,
      message: `Discount rule "${discount.name}" updated successfully.`,
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
 * Server Action: Archive / toggle discount rule active state (Admin only)
 */
export async function archiveDiscountAction(
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
      .from("discounts")
      .update({
        is_active: targetActiveState,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      return {
        success: false,
        error: error.message || "Failed to update discount rule status",
      };
    }

    revalidatePath("/discounts");
    return {
      success: true,
      message: targetActiveState ? "Discount rule activated." : "Discount rule archived.",
    };
  } catch (err: unknown) {
    const error = err as Error;
    return {
      success: false,
      error: error.message || "An unexpected error occurred",
    };
  }
}
