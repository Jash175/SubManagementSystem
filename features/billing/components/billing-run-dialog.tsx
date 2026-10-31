"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Play,
  RotateCw,
  CheckCircle2,
  AlertTriangle,
  Receipt,
  Check,
} from "lucide-react";
import { runDueBillingAction } from "@/features/billing/actions";
import type { BillingRunResult } from "@/types";

interface BillingRunDialogProps {
  onSuccess?: () => void;
  triggerButton?: React.ReactNode;
}

export function BillingRunDialog({
  onSuccess,
  triggerButton,
}: BillingRunDialogProps) {
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [asOfDate, setAsOfDate] = React.useState<string>(() => {
    return new Date().toISOString().slice(0, 10);
  });
  const [autoConfirm, setAutoConfirm] = React.useState(true);
  const [result, setResult] = React.useState<BillingRunResult | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function handleRunBilling(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    const res = await runDueBillingAction({
      asOfDate,
      triggerSource: "manual",
      autoConfirm,
    });

    setLoading(false);

    if (!res.success) {
      setError(res.error || "Billing run failed to complete.");
    } else if (res.data) {
      setResult(res.data);
      if (onSuccess) onSuccess();
    }
  }

  function handleReset() {
    setResult(null);
    setError(null);
  }

  return (
    <>
      {triggerButton ? (
        <span onClick={() => setOpen(true)} className="cursor-pointer inline-flex">
          {triggerButton}
        </span>
      ) : (
        <Button
          size="sm"
          onClick={() => setOpen(true)}
          className="gap-2 bg-primary text-primary-foreground"
        >
          <Play className="h-4 w-4" />
          <span>Run Due Billing</span>
        </Button>
      )}

      <Dialog open={open} onOpenChange={(val) => { setOpen(val); if (!val) handleReset(); }}>
        <DialogContent onClose={() => setOpen(false)} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-primary" />
            <span>Execute Recurring Billing Run</span>
          </DialogTitle>
          <DialogDescription>
            Scans all active subscriptions with due billing dates, calculates billing periods, checks idempotency, applies taxes & discounts, and generates invoices.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive" className="py-2.5">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Billing Error</AlertTitle>
            <AlertDescription className="text-xs">{error}</AlertDescription>
          </Alert>
        )}

        {result ? (
          <div className="space-y-4 py-2">
            <div className="rounded-lg border bg-card p-4 space-y-3">
              <div className="flex items-center justify-between border-b pb-2">
                <span className="text-xs font-medium text-muted-foreground">Run Status</span>
                <span className={`inline-flex items-center gap-1 text-xs font-semibold ${result.status === 'completed' ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {result.status === 'completed' ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
                  {result.status.toUpperCase()}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-muted/40 p-2.5 rounded">
                  <div className="text-muted-foreground">Subscriptions Checked</div>
                  <div className="text-base font-bold mt-0.5">{result.subscriptionsChecked}</div>
                </div>
                <div className="bg-emerald-50 dark:bg-emerald-950/30 p-2.5 rounded border border-emerald-200 dark:border-emerald-800">
                  <div className="text-emerald-700 dark:text-emerald-300">Invoices Generated</div>
                  <div className="text-base font-bold text-emerald-800 dark:text-emerald-200 mt-0.5">
                    {result.invoicesCreated}
                  </div>
                </div>
                <div className="bg-muted/40 p-2.5 rounded">
                  <div className="text-muted-foreground">Periods Skipped (Idempotent)</div>
                  <div className="text-base font-bold mt-0.5">{result.invoicesSkipped}</div>
                </div>
                <div className="bg-muted/40 p-2.5 rounded">
                  <div className="text-muted-foreground">Expired Subscriptions Closed</div>
                  <div className="text-base font-bold mt-0.5">{result.expiredSubscriptionsClosed}</div>
                </div>
              </div>

              {result.errors.length > 0 && (
                <div className="mt-2 rounded bg-destructive/10 p-2.5 text-xs text-destructive">
                  <div className="font-semibold mb-1">Errors encountered ({result.errors.length}):</div>
                  <ul className="list-disc pl-4 space-y-0.5 max-h-24 overflow-y-auto">
                    {result.errors.map((err, i) => (
                      <li key={i}>
                        {err.subscriptionNumber ? `${err.subscriptionNumber}: ` : ""}
                        {err.error}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
                Close
              </Button>
              <Button size="sm" onClick={handleReset}>
                Run Another Batch
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleRunBilling} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="asOfDate" className="text-xs">
                As of Business Date
              </Label>
              <Input
                id="asOfDate"
                type="date"
                value={asOfDate}
                onChange={(e) => setAsOfDate(e.target.value)}
                required
                className="text-xs h-9"
              />
              <p className="text-[11px] text-muted-foreground">
                Invoices will be generated for subscriptions whose next billing date is on or before this date.
              </p>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                id="autoConfirm"
                type="checkbox"
                checked={autoConfirm}
                onChange={(e) => setAutoConfirm(e.target.checked)}
                className="h-4 w-4 rounded border-input"
              />
              <Label htmlFor="autoConfirm" className="text-xs font-normal cursor-pointer">
                Automatically confirm generated invoices (ready for payment)
              </Label>
            </div>

            <div className="rounded border bg-muted/30 p-2.5 text-[11px] text-muted-foreground space-y-1">
              <div className="font-medium text-foreground flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-emerald-600" />
                Retry-Safe & Idempotent
              </div>
              <p>
                Guaranteed safe to run repeatedly. Subscriptions that have already been billed for the current period will not produce duplicates.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setOpen(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={loading} className="gap-1.5">
                {loading ? (
                  <>
                    <RotateCw className="h-4 w-4 animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4" />
                    <span>Start Billing Run</span>
                  </>
                )}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
    </>
  );
}
