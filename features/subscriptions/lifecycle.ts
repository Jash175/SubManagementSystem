import type {
  BillingIntervalUnit,
  Subscription,
  SubscriptionStatus,
} from "@/types";

/**
 * Helper to get the number of days in a given year and month (1-indexed month).
 */
export function getDaysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * Format a Date object to YYYY-MM-DD UTC string.
 */
export function formatDateUTC(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Parse a YYYY-MM-DD string into a UTC Date object.
 */
export function parseDateUTC(dateStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

/**
 * Calendar-safe next billing date calculation.
 * Preserves the original start-day anchor for monthly and yearly cycles:
 * Jan 31 -> Feb 28/29 -> Mar 31 (not Mar 28).
 */
export function calculateNextBillingDate(
  currentDateStr: string,
  intervalUnit: BillingIntervalUnit,
  intervalCount: number,
  anchorDay: number,
  anchorMonth: number
): string {
  if (intervalCount <= 0) {
    throw new Error("Billing interval count must be positive");
  }

  const currentDate = parseDateUTC(currentDateStr);

  switch (intervalUnit) {
    case "daily": {
      const nextDate = new Date(currentDate.getTime() + intervalCount * 24 * 60 * 60 * 1000);
      return formatDateUTC(nextDate);
    }

    case "weekly": {
      const nextDate = new Date(currentDate.getTime() + intervalCount * 7 * 24 * 60 * 60 * 1000);
      return formatDateUTC(nextDate);
    }

    case "monthly": {
      const currentYear = currentDate.getUTCFullYear();
      const currentMonth = currentDate.getUTCMonth(); // 0-indexed

      // Advance by intervalCount months
      const totalMonths = currentYear * 12 + currentMonth + intervalCount;
      const targetYear = Math.floor(totalMonths / 12);
      const targetMonthIndex = totalMonths % 12; // 0-indexed
      const targetMonth1Indexed = targetMonthIndex + 1;

      const maxDaysInTargetMonth = getDaysInMonth(targetYear, targetMonth1Indexed);
      const finalDay = Math.min(anchorDay, maxDaysInTargetMonth);

      return `${targetYear}-${String(targetMonth1Indexed).padStart(2, "0")}-${String(finalDay).padStart(2, "0")}`;
    }

    case "yearly": {
      const targetYear = currentDate.getUTCFullYear() + intervalCount;
      const targetMonth = anchorMonth; // 1-indexed

      const maxDays = getDaysInMonth(targetYear, targetMonth);
      const finalDay = Math.min(anchorDay, maxDays);

      return `${targetYear}-${String(targetMonth).padStart(2, "0")}-${String(finalDay).padStart(2, "0")}`;
    }

    default:
      throw new Error(`Unsupported billing interval unit: ${intervalUnit}`);
  }
}

/**
 * Validates quotation confirmation.
 * Rejects if quotation validity date has elapsed (T-10).
 */
export function validateQuotationConfirmation(
  subscription: Pick<Subscription, "status" | "quotationValidUntil">,
  targetDateStr?: string
): { valid: boolean; error?: string } {
  if (subscription.status !== "draft" && subscription.status !== "quotation") {
    return {
      valid: false,
      error: `Cannot confirm subscription in '${subscription.status}' state. Only draft or quotation can be confirmed.`,
    };
  }

  if (subscription.quotationValidUntil) {
    const checkDate = targetDateStr ? targetDateStr : formatDateUTC(new Date());
    if (checkDate > subscription.quotationValidUntil) {
      return {
        valid: false,
        error: `Quotation expired on ${subscription.quotationValidUntil}. Cannot confirm expired quotation.`,
      };
    }
  }

  return { valid: true };
}

/**
 * Validates early close of subscription.
 * Rejects if allowEarlyClose is false and expiry date has not been reached (T-11).
 */
export function validateEarlyClose(
  subscription: Pick<Subscription, "status" | "allowEarlyClose" | "expiryDate">,
  currentDateStr?: string
): { valid: boolean; error?: string } {
  if (subscription.status === "closed") {
    return { valid: false, error: "Subscription is already closed." };
  }

  const checkDate = currentDateStr || formatDateUTC(new Date());
  const isPastExpiry = subscription.expiryDate ? checkDate >= subscription.expiryDate : false;

  if (!isPastExpiry && !subscription.allowEarlyClose) {
    return {
      valid: false,
      error: "Early closure is rejected because allowEarlyClose policy flag is false.",
    };
  }

  return { valid: true };
}

/**
 * Validates pausing of subscription.
 * Rejects if allowPause is false (T-12) or subscription is not active.
 */
export function validatePause(
  subscription: Pick<Subscription, "status" | "allowPause">
): { valid: boolean; error?: string } {
  if (subscription.status !== "active") {
    return {
      valid: false,
      error: `Cannot pause subscription in '${subscription.status}' state. Only active subscriptions can be paused.`,
    };
  }

  if (!subscription.allowPause) {
    return {
      valid: false,
      error: "Pausing subscription is rejected because allowPause policy flag is false.",
    };
  }

  return { valid: true };
}

/**
 * Validates resuming a paused subscription.
 */
export function validateResume(
  subscription: Pick<Subscription, "status" | "pausedAt">
): { valid: boolean; error?: string } {
  if (subscription.status !== "paused") {
    return {
      valid: false,
      error: `Cannot resume subscription in '${subscription.status}' state. Only paused subscriptions can be resumed.`,
    };
  }

  return { valid: true };
}

/**
 * Computes shifted next billing date when resuming from a pause.
 * Does not bill for paused duration; shifts next billing date forward by paused days.
 */
export function calculateResumeBillingDate(
  pausedAtStr: string,
  currentNextBillingDateStr: string,
  resumeDateStr?: string
): string {
  const pausedDate = new Date(pausedAtStr);
  const resumeDate = resumeDateStr ? parseDateUTC(resumeDateStr) : new Date();

  const pauseDurationMs = resumeDate.getTime() - pausedDate.getTime();
  const pauseDurationDays = Math.max(0, Math.floor(pauseDurationMs / (24 * 60 * 60 * 1000)));

  if (pauseDurationDays <= 0) {
    return currentNextBillingDateStr;
  }

  const currentNextDate = parseDateUTC(currentNextBillingDateStr);
  const shiftedDate = new Date(currentNextDate.getTime() + pauseDurationDays * 24 * 60 * 60 * 1000);
  return formatDateUTC(shiftedDate);
}

/**
 * Validates renewal of subscription.
 * Rejects if allowRenewal is false.
 */
export function validateRenewal(
  subscription: Pick<Subscription, "status" | "allowRenewal">
): { valid: boolean; error?: string } {
  if (subscription.status !== "active" && subscription.status !== "closed") {
    return {
      valid: false,
      error: `Cannot renew subscription in '${subscription.status}' state. Only active or closed subscriptions can be renewed.`,
    };
  }

  if (!subscription.allowRenewal) {
    return {
      valid: false,
      error: "Subscription renewal is rejected because allowRenewal policy flag is false.",
    };
  }

  return { valid: true };
}

/**
 * Checks whether a given status transition is valid according to the required status journey:
 * draft -> quotation -> confirmed -> active -> paused/closed
 */
export function isValidStatusTransition(
  fromStatus: SubscriptionStatus,
  toStatus: SubscriptionStatus
): boolean {
  const allowedTransitions: Record<SubscriptionStatus, SubscriptionStatus[]> = {
    draft: ["quotation", "closed"],
    quotation: ["confirmed", "closed"],
    confirmed: ["active", "closed"],
    active: ["paused", "closed"],
    paused: ["active", "closed"],
    closed: [], // Terminal
  };

  return allowedTransitions[fromStatus]?.includes(toStatus) ?? false;
}
