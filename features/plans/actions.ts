"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/features/auth/guards";
import {
  planSchema,
  assignPlanTaxesSchema,
  type PlanInput,
  type AssignPlanTaxesInput,
} from "./schemas";
import type { ActionResult, Plan } from "@/types";

/**
 * Server Action: Create a new subscription plan (Admin only)
 */
export async function createPlanAction(
  input: PlanInput
): Promise<ActionResult<Plan>> {
  try {
    const adminSession = await requireAdmin();
    const parsed = planSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Invalid plan data",
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
      .from("plans")
      .insert({
        plan_code: parsed.data.planCode,
        name: parsed.data.name,
        description: parsed.data.description || null,
        price: parsed.data.price,
        currency_code: parsed.data.currencyCode,
        billing_interval_unit: parsed.data.billingIntervalUnit,
        billing_interval_count: parsed.data.billingIntervalCount,
        minimum_quantity: parsed.data.minimumQuantity,
        available_from: parsed.data.availableFrom || null,
        available_until: parsed.data.availableUntil || null,
        auto_close_on_end: parsed.data.autoCloseOnEnd,
        allow_early_close: parsed.data.allowEarlyClose,
        allow_pause: parsed.data.allowPause,
        allow_renewal: parsed.data.allowRenewal,
        is_active: parsed.data.isActive,
        created_by: adminSession.id,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return {
          success: false,
          error: `A plan with code "${parsed.data.planCode}" already exists.`,
        };
      }
      return {
        success: false,
        error: error.message || "Failed to create plan",
      };
    }

    revalidatePath("/plans");
    return {
      success: true,
      message: `Plan "${data.name}" (${data.plan_code}) created successfully.`,
      data: {
        id: data.id,
        planCode: data.plan_code,
        name: data.name,
        description: data.description,
        price: Number(data.price),
        currencyCode: data.currency_code,
        billingIntervalUnit: data.billing_interval_unit,
        billingIntervalCount: data.billing_interval_count,
        minimumQuantity: Number(data.minimum_quantity),
        availableFrom: data.available_from,
        availableUntil: data.available_until,
        autoCloseOnEnd: data.auto_close_on_end,
        allowEarlyClose: data.allow_early_close,
        allowPause: data.allow_pause,
        allowRenewal: data.allow_renewal,
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
 * Server Action: Update an existing plan (Admin only)
 */
export async function updatePlanAction(
  id: string,
  input: PlanInput
): Promise<ActionResult<Plan>> {
  try {
    await requireAdmin();
    const parsed = planSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Invalid plan data",
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
      .from("plans")
      .update({
        plan_code: parsed.data.planCode,
        name: parsed.data.name,
        description: parsed.data.description || null,
        price: parsed.data.price,
        currency_code: parsed.data.currencyCode,
        billing_interval_unit: parsed.data.billingIntervalUnit,
        billing_interval_count: parsed.data.billingIntervalCount,
        minimum_quantity: parsed.data.minimumQuantity,
        available_from: parsed.data.availableFrom || null,
        available_until: parsed.data.availableUntil || null,
        auto_close_on_end: parsed.data.autoCloseOnEnd,
        allow_early_close: parsed.data.allowEarlyClose,
        allow_pause: parsed.data.allowPause,
        allow_renewal: parsed.data.allowRenewal,
        is_active: parsed.data.isActive,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return {
        success: false,
        error: error.message || "Failed to update plan",
      };
    }

    revalidatePath("/plans");
    return {
      success: true,
      message: `Plan "${data.name}" updated successfully.`,
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
 * Server Action: Archive / toggle plan active state (Admin only)
 */
export async function archivePlanAction(
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
      .from("plans")
      .update({
        is_active: targetActiveState,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      return {
        success: false,
        error: error.message || "Failed to update plan status",
      };
    }

    revalidatePath("/plans");
    return {
      success: true,
      message: targetActiveState ? "Plan activated." : "Plan archived.",
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
 * Server Action: Assign taxes to a plan (Admin only)
 */
export async function assignPlanTaxesAction(
  planId: string,
  input: AssignPlanTaxesInput
): Promise<ActionResult> {
  try {
    await requireAdmin();
    const parsed = assignPlanTaxesSchema.safeParse(input);
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

    // Replace plan taxes
    await supabase.from("plan_taxes").delete().eq("plan_id", planId);

    if (parsed.data.taxIds.length > 0) {
      const rows = parsed.data.taxIds.map((taxId) => ({
        plan_id: planId,
        tax_id: taxId,
      }));
      const { error } = await supabase.from("plan_taxes").insert(rows);
      if (error) {
        return {
          success: false,
          error: error.message || "Failed to assign taxes to plan",
        };
      }
    }

    revalidatePath("/plans");
    return {
      success: true,
      message: "Plan taxes updated successfully.",
    };
  } catch (err: unknown) {
    const error = err as Error;
    return {
      success: false,
      error: error.message || "An unexpected error occurred",
    };
  }
}
