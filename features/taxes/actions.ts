"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/features/auth/guards";
import { taxSchema, type TaxInput } from "./schemas";
import type { ActionResult, Tax } from "@/types";

/**
 * Server Action: Create a tax rule (Admin only)
 */
export async function createTaxAction(
  input: TaxInput
): Promise<ActionResult<Tax>> {
  try {
    const adminSession = await requireAdmin();
    const parsed = taxSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Invalid tax rule data",
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
      .from("taxes")
      .insert({
        tax_code: parsed.data.taxCode,
        name: parsed.data.name,
        rate_percent: parsed.data.ratePercent,
        is_active: parsed.data.isActive,
        created_by: adminSession.id,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return {
          success: false,
          error: `A tax with code "${parsed.data.taxCode}" already exists.`,
        };
      }
      return {
        success: false,
        error: error.message || "Failed to create tax rule",
      };
    }

    revalidatePath("/taxes");
    revalidatePath("/products");
    revalidatePath("/plans");

    return {
      success: true,
      message: `Tax "${data.name}" (${data.tax_code} at ${data.rate_percent}%) created successfully.`,
      data: {
        id: data.id,
        taxCode: data.tax_code,
        name: data.name,
        ratePercent: Number(data.rate_percent),
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
 * Server Action: Update a tax rule (Admin only)
 */
export async function updateTaxAction(
  id: string,
  input: TaxInput
): Promise<ActionResult<Tax>> {
  try {
    await requireAdmin();
    const parsed = taxSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Invalid tax rule data",
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
      .from("taxes")
      .update({
        tax_code: parsed.data.taxCode,
        name: parsed.data.name,
        rate_percent: parsed.data.ratePercent,
        is_active: parsed.data.isActive,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return {
        success: false,
        error: error.message || "Failed to update tax rule",
      };
    }

    revalidatePath("/taxes");
    revalidatePath("/products");
    revalidatePath("/plans");

    return {
      success: true,
      message: `Tax rule "${data.name}" updated successfully.`,
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
 * Server Action: Archive / toggle tax rule (Admin only)
 */
export async function archiveTaxAction(
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
      .from("taxes")
      .update({
        is_active: targetActiveState,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      return {
        success: false,
        error: error.message || "Failed to update tax rule status",
      };
    }

    revalidatePath("/taxes");
    revalidatePath("/products");
    revalidatePath("/plans");

    return {
      success: true,
      message: targetActiveState ? "Tax rule activated." : "Tax rule archived.",
    };
  } catch (err: unknown) {
    const error = err as Error;
    return {
      success: false,
      error: error.message || "An unexpected error occurred",
    };
  }
}
