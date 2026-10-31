"use client";

import * as React from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Receipt,
  Printer,
  CreditCard,
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
  ArrowLeft,
  Building,
  Mail,
  Repeat,
  RotateCw,
} from "lucide-react";
import { formatCurrency } from "@/features/products/pricing";
import { RecordPaymentDialog } from "@/features/payments/components/record-payment-dialog";
import { confirmInvoiceAction, cancelInvoiceAction } from "@/features/billing/actions";
import type { Invoice, InvoiceLine } from "@/types";

interface InvoiceDetailProps {
  invoice: Invoice;
  portalMode?: boolean;
}

export function InvoiceDetail({ invoice, portalMode = false }: InvoiceDetailProps) {
  const [loadingAction, setLoadingAction] = React.useState<string | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);

  const todayStr = new Date().toISOString().slice(0, 10);
  const isOverdue =
    (invoice.status === "confirmed" || invoice.status === "partially_paid") &&
    invoice.balanceDue > 0 &&
    invoice.dueDate < todayStr;

  async function handleConfirm() {
    setLoadingAction("confirm");
    setActionError(null);
    const res = await confirmInvoiceAction({ invoiceId: invoice.id });
    setLoadingAction(null);
    if (!res.success) {
      setActionError(res.error || "Failed to confirm invoice");
    }
  }

  async function handleCancel() {
    const reason = window.prompt("Reason for cancellation (optional):");
    if (reason === null) return; // User pressed Cancel in prompt

    setLoadingAction("cancel");
    setActionError(null);
    const res = await cancelInvoiceAction({
      invoiceId: invoice.id,
      reason: reason || undefined,
    });
    setLoadingAction(null);
    if (!res.success) {
      setActionError(res.error || "Failed to cancel invoice");
    }
  }

  const getStatusBadge = () => {
    if (isOverdue) {
      return (
        <Badge variant="destructive" className="gap-1.5 text-xs py-1 px-3">
          <AlertCircle className="h-3.5 w-3.5" />
          <span>Overdue</span>
        </Badge>
      );
    }

    switch (invoice.status) {
      case "paid":
        return (
          <Badge variant="success" className="gap-1.5 text-xs py-1 px-3">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>Paid in Full</span>
          </Badge>
        );
      case "partially_paid":
        return (
          <Badge variant="warning" className="gap-1.5 text-xs py-1 px-3">
            <Clock className="h-3.5 w-3.5" />
            <span>Partially Paid</span>
          </Badge>
        );
      case "confirmed":
        return (
          <Badge variant="default" className="gap-1.5 text-xs py-1 px-3">
            <Clock className="h-3.5 w-3.5" />
            <span>Confirmed / Due</span>
          </Badge>
        );
      case "draft":
        return (
          <Badge variant="outline" className="gap-1.5 text-xs py-1 px-3">
            <span>Draft</span>
          </Badge>
        );
      case "cancelled":
      case "void":
        return (
          <Badge variant="secondary" className="gap-1.5 text-xs py-1 px-3">
            <XCircle className="h-3.5 w-3.5" />
            <span>{invoice.status.toUpperCase()}</span>
          </Badge>
        );
      default:
        return <Badge variant="secondary">{invoice.status}</Badge>;
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 print:hidden">
        <Link
          href={portalMode ? "/portal/invoices" : "/billing"}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Invoices</span>
        </Link>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.print()}
            className="gap-1.5 text-xs h-8"
          >
            <Printer className="h-3.5 w-3.5" />
            <span>Print Invoice</span>
          </Button>

          {!portalMode && invoice.status === "draft" && (
            <Button
              size="sm"
              onClick={handleConfirm}
              disabled={loadingAction === "confirm"}
              className="gap-1.5 text-xs h-8 bg-primary text-primary-foreground"
            >
              {loadingAction === "confirm" ? (
                <RotateCw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5" />
              )}
              <span>Confirm Invoice</span>
            </Button>
          )}

          {!portalMode &&
            invoice.balanceDue > 0 &&
            (invoice.status === "confirmed" || invoice.status === "partially_paid") && (
              <RecordPaymentDialog
                invoice={invoice}
                triggerButton={
                  <Button
                    size="sm"
                    className="gap-1.5 text-xs h-8 bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    <CreditCard className="h-3.5 w-3.5" />
                    <span>Record Payment</span>
                  </Button>
                }
              />
            )}

          {!portalMode &&
            (invoice.status === "draft" || invoice.status === "confirmed") &&
            invoice.amountPaid === 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleCancel}
                disabled={loadingAction === "cancel"}
                className="gap-1.5 text-xs h-8 text-destructive border-destructive/30 hover:bg-destructive/10"
              >
                {loadingAction === "cancel" ? (
                  <RotateCw className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <XCircle className="h-3.5 w-3.5" />
                )}
                <span>Cancel Invoice</span>
              </Button>
            )}
        </div>
      </div>

      {actionError && (
        <div className="rounded-md border border-destructive bg-destructive/10 p-3 text-xs text-destructive print:hidden">
          {actionError}
        </div>
      )}

      {/* Main Invoice Sheet */}
      <div className="rounded-xl border bg-card p-6 md:p-8 shadow-xs space-y-8 print:border-none print:shadow-none print:p-0">
        {/* Invoice Header */}
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 border-b pb-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Receipt className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-foreground leading-none">
                  {invoice.invoiceNumber}
                </h1>
                <p className="text-xs text-muted-foreground mt-1">
                  Brightloop Subscription Management System
                </p>
              </div>
            </div>

            <div className="pt-2">{getStatusBadge()}</div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <span className="text-muted-foreground">Issue Date:</span>
              <div className="font-semibold text-foreground mt-0.5">
                {invoice.issuedAt.slice(0, 10)}
              </div>
            </div>
            <div>
              <span className="text-muted-foreground">Due Date:</span>
              <div className="font-semibold text-foreground mt-0.5">
                {invoice.dueDate}
              </div>
            </div>
            <div>
              <span className="text-muted-foreground">Currency:</span>
              <div className="font-semibold text-foreground mt-0.5">
                {invoice.currencyCode}
              </div>
            </div>

            {invoice.billingPeriodStart && invoice.billingPeriodEnd && (
              <div className="col-span-2 sm:col-span-3 bg-muted/30 p-2 rounded text-[11px]">
                <span className="text-muted-foreground">Billing Period: </span>
                <span className="font-semibold text-foreground">
                  {invoice.billingPeriodStart} to {invoice.billingPeriodEnd}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Customer & Subscription Metadata */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
          <div className="space-y-1 rounded-lg border bg-muted/20 p-4">
            <div className="font-semibold text-sm text-foreground mb-2 flex items-center gap-1.5">
              <Building className="h-4 w-4 text-primary" />
              <span>Billed To:</span>
            </div>
            <div className="font-bold text-foreground text-sm">
              {invoice.customer?.legalName || "Customer"}
            </div>
            {invoice.customer?.companyName && (
              <div className="text-muted-foreground">{invoice.customer.companyName}</div>
            )}
            <div className="text-muted-foreground flex items-center gap-1">
              <Mail className="h-3 w-3" />
              <span>{invoice.customer?.email}</span>
            </div>
            <div className="text-muted-foreground text-[11px] pt-1">
              Customer Code: <span className="font-mono">{invoice.customer?.customerCode}</span>
            </div>
          </div>

          <div className="space-y-1 rounded-lg border bg-muted/20 p-4">
            <div className="font-semibold text-sm text-foreground mb-2 flex items-center gap-1.5">
              <Repeat className="h-4 w-4 text-primary" />
              <span>Subscription Association:</span>
            </div>
            {invoice.subscription ? (
              <div className="space-y-1">
                <div>
                  Subscription #{" "}
                  <Link
                    href={`/subscriptions/${invoice.subscription.id}`}
                    className="font-semibold text-primary hover:underline"
                  >
                    {invoice.subscription.subscriptionNumber}
                  </Link>
                </div>
                <div className="text-muted-foreground">
                  Plan: {invoice.subscription.planNameSnapshot}
                </div>
                <div className="text-muted-foreground text-[11px]">
                  Lifecycle Status:{" "}
                  <Badge variant="outline" className="text-[10px] py-0 px-1.5">
                    {invoice.subscription.status}
                  </Badge>
                </div>
              </div>
            ) : (
              <div className="text-muted-foreground italic">
                Direct / standalone invoice (no recurring subscription link).
              </div>
            )}
          </div>
        </div>

        {/* Line Items Table */}
        <div className="space-y-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Line Items & Charges
          </h2>
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 border-b text-muted-foreground font-medium text-left">
                <tr>
                  <th className="py-2.5 px-3">Description</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3 text-right">Qty</th>
                  <th className="py-2.5 px-3 text-right">Unit Price</th>
                  <th className="py-2.5 px-3 text-right">Discount</th>
                  <th className="py-2.5 px-3 text-right">Taxes</th>
                  <th className="py-2.5 px-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {invoice.lines && invoice.lines.length > 0 ? (
                  invoice.lines.map((l: InvoiceLine) => (
                    <tr key={l.id} className="hover:bg-muted/10">
                      <td className="py-3 px-3 font-medium text-foreground">
                        {l.descriptionSnapshot}
                      </td>
                      <td className="py-3 px-3">
                        <Badge variant="outline" className="text-[10px] py-0 px-1.5 capitalize">
                          {l.lineType}
                        </Badge>
                      </td>
                      <td className="py-3 px-3 text-right">{l.quantity}</td>
                      <td className="py-3 px-3 text-right">
                        {formatCurrency(l.unitPrice, invoice.currencyCode)}
                      </td>
                      <td className="py-3 px-3 text-right text-emerald-600">
                        {l.discountAmount > 0
                          ? `-${formatCurrency(l.discountAmount, invoice.currencyCode)}`
                          : "—"}
                      </td>
                      <td className="py-3 px-3 text-right text-muted-foreground">
                        {l.taxes && l.taxes.length > 0 ? (
                          <div className="space-y-0.5">
                            {l.taxes.map((t, idx) => (
                              <div key={idx} className="text-[10px]">
                                {t.taxNameSnapshot} ({t.ratePercentSnapshot}%):{" "}
                                {formatCurrency(t.taxAmount, invoice.currencyCode)}
                              </div>
                            ))}
                          </div>
                        ) : (
                          formatCurrency(l.taxAmount, invoice.currencyCode)
                        )}
                      </td>
                      <td className="py-3 px-3 text-right font-semibold text-foreground">
                        {formatCurrency(l.lineTotal, invoice.currencyCode)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="py-4 text-center text-muted-foreground">
                      No line items recorded.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Financial Summary Calculation Block */}
        <div className="flex flex-col sm:flex-row justify-between gap-6 pt-2 border-t">
          <div className="space-y-2 text-xs text-muted-foreground max-w-sm">
            {invoice.notes && (
              <div className="rounded border bg-muted/20 p-3">
                <span className="font-semibold text-foreground">Invoice Notes:</span>
                <p className="mt-0.5">{invoice.notes}</p>
              </div>
            )}
            <p className="text-[11px]">
              Taxes and prices are immutable snapshots recorded at the time of invoice creation.
            </p>
          </div>

          <div className="w-full sm:w-72 space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b text-muted-foreground">
              <span>Subtotal:</span>
              <span className="font-medium text-foreground">
                {formatCurrency(invoice.subtotal, invoice.currencyCode)}
              </span>
            </div>
            {invoice.discountTotal > 0 && (
              <div className="flex justify-between py-1 border-b text-emerald-600">
                <span>Discount Total:</span>
                <span className="font-medium">
                  -{formatCurrency(invoice.discountTotal, invoice.currencyCode)}
                </span>
              </div>
            )}
            {invoice.taxTotal > 0 && (
              <div className="flex justify-between py-1 border-b text-muted-foreground">
                <span>Tax Total:</span>
                <span className="font-medium text-foreground">
                  +{formatCurrency(invoice.taxTotal, invoice.currencyCode)}
                </span>
              </div>
            )}
            <div className="flex justify-between py-1.5 border-b text-sm font-bold text-foreground">
              <span>Total Invoiced:</span>
              <span>{formatCurrency(invoice.total, invoice.currencyCode)}</span>
            </div>
            <div className="flex justify-between py-1 border-b text-emerald-600 font-medium">
              <span>Amount Paid:</span>
              <span>{formatCurrency(invoice.amountPaid, invoice.currencyCode)}</span>
            </div>
            <div className="flex justify-between py-2 text-base font-extrabold text-foreground bg-muted/40 px-2 rounded">
              <span>Balance Due:</span>
              <span>{formatCurrency(invoice.balanceDue, invoice.currencyCode)}</span>
            </div>
          </div>
        </div>

        {/* Payment History Audit Section */}
        <div className="space-y-3 pt-4 border-t">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Payment History & Receipts
            </h2>
            <span className="text-xs text-muted-foreground">
              {invoice.payments?.length || 0} payment(s) recorded
            </span>
          </div>

          {invoice.payments && invoice.payments.length > 0 ? (
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-muted/40 border-b text-muted-foreground font-medium text-left">
                  <tr>
                    <th className="py-2.5 px-3">Date Paid</th>
                    <th className="py-2.5 px-3">Method</th>
                    <th className="py-2.5 px-3">Reference / UTR</th>
                    <th className="py-2.5 px-3">Notes</th>
                    <th className="py-2.5 px-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {invoice.payments.map((p) => (
                    <tr key={p.id} className="hover:bg-muted/10">
                      <td className="py-2.5 px-3 font-medium">
                        {p.paidAt.slice(0, 10)}
                      </td>
                      <td className="py-2.5 px-3 capitalize">
                        <Badge variant="outline" className="text-[10px] py-0 px-1.5">
                          {p.paymentMethod.replace("_", " ")}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-muted-foreground">
                        {p.referenceNumber || "—"}
                      </td>
                      <td className="py-2.5 px-3 text-muted-foreground">
                        {p.note || "—"}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-emerald-600">
                        {formatCurrency(p.amount, invoice.currencyCode)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
              No payments have been recorded against this invoice yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
