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
  CreditCard,
  RotateCw,
  CheckCircle2,
  AlertTriangle,
  Receipt,
} from "lucide-react";
import { formatCurrency } from "@/features/products/pricing";
import { recordPaymentAction } from "@/features/payments/actions";
import type { Invoice, PaymentMethod } from "@/types";

interface RecordPaymentDialogProps {
  invoice: Invoice;
  onSuccess?: () => void;
  triggerButton?: React.ReactNode;
}

export function RecordPaymentDialog({
  invoice,
  onSuccess,
  triggerButton,
}: RecordPaymentDialogProps) {
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [amount, setAmount] = React.useState<number>(invoice.balanceDue);
  const [paymentMethod, setPaymentMethod] = React.useState<PaymentMethod>("bank_transfer");
  const [referenceNumber, setReferenceNumber] = React.useState("");
  const [note, setNote] = React.useState("");
  const [paidAt, setPaidAt] = React.useState(() => new Date().toISOString().slice(0, 10));
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);
  const [prevBalanceDue, setPrevBalanceDue] = React.useState(invoice.balanceDue);

  if (invoice.balanceDue !== prevBalanceDue) {
    setPrevBalanceDue(invoice.balanceDue);
    setAmount(invoice.balanceDue);
  }

  const remainingAfterPayment = Math.max(0, invoice.balanceDue - (Number(amount) || 0));

  async function handleRecordPayment(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) {
      setError("Payment amount must be greater than zero.");
      return;
    }

    if (numAmount > invoice.balanceDue) {
      setError(
        `Payment amount (${formatCurrency(numAmount)}) cannot exceed outstanding balance (${formatCurrency(invoice.balanceDue)}).`
      );
      return;
    }

    setLoading(true);

    const res = await recordPaymentAction({
      invoiceId: invoice.id,
      amount: numAmount,
      paymentMethod,
      referenceNumber: referenceNumber.trim() || undefined,
      note: note.trim() || undefined,
      paidAt: paidAt ? new Date(paidAt).toISOString() : undefined,
    });

    setLoading(false);

    if (!res.success) {
      setError(res.error || "Failed to record payment.");
    } else {
      setSuccess(true);
      if (onSuccess) onSuccess();
      setTimeout(() => {
        setOpen(false);
        setSuccess(false);
      }, 1200);
    }
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
          className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          <CreditCard className="h-4 w-4" />
          <span>Record Payment</span>
        </Button>
      )}

      <Dialog open={open} onOpenChange={(val) => { setOpen(val); if (!val) { setError(null); setSuccess(false); } }}>
        <DialogContent onClose={() => setOpen(false)} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-emerald-600" />
            <span>Record Payment for {invoice.invoiceNumber}</span>
          </DialogTitle>
          <DialogDescription>
            Record a manual settlement (bank transfer, UPI, card, or cash). Partial payments are supported.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive" className="py-2.5">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Validation Error</AlertTitle>
            <AlertDescription className="text-xs">{error}</AlertDescription>
          </Alert>
        )}

        {success ? (
          <div className="py-6 flex flex-col items-center justify-center space-y-2 text-center">
            <CheckCircle2 className="h-10 w-10 text-emerald-600 animate-bounce" />
            <h3 className="font-semibold text-sm">Payment Recorded Successfully!</h3>
            <p className="text-xs text-muted-foreground">
              Invoice balance and payment ledger updated atomically.
            </p>
          </div>
        ) : (
          <form onSubmit={handleRecordPayment} className="space-y-4 py-2">
            {/* Invoice summary info */}
            <div className="rounded-lg border bg-muted/40 p-3 grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-muted-foreground">Customer:</span>
                <div className="font-medium truncate">{invoice.customer?.legalName || "Customer"}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Total Invoiced:</span>
                <div className="font-medium">{formatCurrency(invoice.total, invoice.currencyCode)}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Already Paid:</span>
                <div className="font-medium text-emerald-600">{formatCurrency(invoice.amountPaid, invoice.currencyCode)}</div>
              </div>
              <div>
                <span className="text-muted-foreground font-semibold">Balance Due:</span>
                <div className="font-bold text-foreground">{formatCurrency(invoice.balanceDue, invoice.currencyCode)}</div>
              </div>
            </div>

            {/* Payment Amount */}
            <div className="space-y-1.5">
              <Label htmlFor="amount" className="text-xs">
                Payment Amount (INR) *
              </Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0.01"
                max={invoice.balanceDue}
                value={amount}
                onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                required
                className="text-xs h-9 font-medium"
              />
              <div className="flex justify-between text-[11px] pt-0.5">
                <span className="text-muted-foreground">
                  Remaining balance after payment:
                </span>
                <span className={`font-semibold ${remainingAfterPayment === 0 ? 'text-emerald-600' : 'text-foreground'}`}>
                  {formatCurrency(remainingAfterPayment, invoice.currencyCode)}
                  {remainingAfterPayment === 0 ? " (Paid in Full)" : " (Partially Paid)"}
                </span>
              </div>
            </div>

            {/* Payment Method */}
            <div className="space-y-1.5">
              <Label htmlFor="paymentMethod" className="text-xs">
                Payment Method *
              </Label>
              <select
                id="paymentMethod"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="bank_transfer">Bank Transfer (NEFT / RTGS / IMPS)</option>
                <option value="upi">UPI (GPay / PhonePe / QR)</option>
                <option value="card">Credit / Debit Card</option>
                <option value="cash">Cash</option>
                <option value="cheque">Cheque / Demand Draft</option>
                <option value="other">Other Settlement</option>
              </select>
            </div>

            {/* Reference Number */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="referenceNumber" className="text-xs">
                  Reference / UTR #
                </Label>
                <Input
                  id="referenceNumber"
                  type="text"
                  placeholder="e.g. UTR10293848"
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  className="text-xs h-9"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="paidAt" className="text-xs">
                  Date Received
                </Label>
                <Input
                  id="paidAt"
                  type="date"
                  value={paidAt}
                  onChange={(e) => setPaidAt(e.target.value)}
                  required
                  className="text-xs h-9"
                />
              </div>
            </div>

            {/* Note */}
            <div className="space-y-1.5">
              <Label htmlFor="note" className="text-xs">
                Internal Note
              </Label>
              <Input
                id="note"
                type="text"
                placeholder="Optional payment or reconciliation note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="text-xs h-9"
              />
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
              <Button
                type="submit"
                size="sm"
                disabled={loading || amount <= 0 || amount > invoice.balanceDue}
                className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {loading ? (
                  <>
                    <RotateCw className="h-4 w-4 animate-spin" />
                    <span>Recording...</span>
                  </>
                ) : (
                  <>
                    <CreditCard className="h-4 w-4" />
                    <span>Confirm & Settle</span>
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
