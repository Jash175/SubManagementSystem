import { formatDateUTC, parseDateUTC } from "../subscriptions/lifecycle.ts";

/**
 * Utility for exact 2-decimal rounded financial arithmetic.
 */
export function round2(num: number): string {
  return (Math.round((num + Number.EPSILON) * 100) / 100).toFixed(2);
}

export function round2Num(num: number): number {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

/**
 * Helper to add days to a YYYY-MM-DD date.
 */
export function addDaysUTC(dateStr: string, days: number): string {
  const d = parseDateUTC(dateStr);
  const result = new Date(d.getTime() + days * 24 * 60 * 60 * 1000);
  return formatDateUTC(result);
}
