import type { Plan } from "@/types";

export interface PlanAvailabilityResult {
  isAvailable: boolean;
  reason?: string;
}

/**
 * Checks whether a subscription plan is available for selection on a given target date.
 * Respects active state and date window [availableFrom, availableUntil].
 *
 * @param plan Subscription plan definition
 * @param targetDate Optional date to verify against (defaults to today)
 */
export function checkPlanAvailability(
  plan: Pick<Plan, "isActive" | "availableFrom" | "availableUntil">,
  targetDate: Date | string = new Date()
): PlanAvailabilityResult {
  if (!plan.isActive) {
    return {
      isAvailable: false,
      reason: "Plan is currently inactive or archived",
    };
  }

  const checkDate =
    typeof targetDate === "string" ? new Date(targetDate) : targetDate;
  const checkDay = checkDate.toISOString().slice(0, 10);

  if (plan.availableFrom && checkDay < plan.availableFrom) {
    return {
      isAvailable: false,
      reason: `Plan is not available until ${plan.availableFrom}`,
    };
  }

  if (plan.availableUntil && checkDay > plan.availableUntil) {
    return {
      isAvailable: false,
      reason: `Plan expired on ${plan.availableUntil}`,
    };
  }

  return { isAvailable: true };
}

/**
 * Validates that requested plan quantity meets the plan's minimum quantity invariant.
 */
export function validatePlanQuantity(
  plan: Pick<Plan, "minimumQuantity">,
  requestedQuantity: number
): { isValid: boolean; error?: string } {
  if (isNaN(requestedQuantity) || requestedQuantity <= 0) {
    return {
      isValid: false,
      error: "Requested quantity must be greater than zero",
    };
  }

  if (requestedQuantity < plan.minimumQuantity) {
    return {
      isValid: false,
      error: `Quantity ${requestedQuantity} is below the plan minimum of ${plan.minimumQuantity}`,
    };
  }

  return { isValid: true };
}
