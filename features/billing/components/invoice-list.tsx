"use client";

import * as React from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Receipt,
  Search,
  Eye,
  CreditCard,
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
} from "lucide-react";
import { formatCurrency } from "@/features/products/pricing";
import { RecordPaymentDialog } from "@/features/payments/components/record-payment-dialog";
import type { Invoice, InvoiceStatus } from "@/types";

interface InvoiceListProps {
  invoices: Invoice[];
  portalMode?: boolean;
}

export function InvoiceList({ invoices, portalMode = false }: InvoiceListProps) {
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<InvoiceStatus | "all">("all");

  const todayStr = new Date().toISOString().slice(0, 10);

  const filtered = invoices.filter((inv) => {
    const matchesStatus = statusFilter === "all" || inv.status === statusFilter;
    const q = search.toLowerCase();
    const matchesSearch =
      inv.invoiceNumber.toLowerCase().includes(q) ||
      (inv.customer?.legalName || "").toLowerCase().includes(q) ||
      (inv.customer?.customerCode || "").toLowerCase().includes(q);

    return matchesStatus && matchesSearch;
  });

  const getStatusBadge = (inv: Invoice) => {
    const isOverdue =
      (inv.status === "confirmed" || inv.status === "partially_paid") &&
      inv.balanceDue > 0 &&
      inv.dueDate < todayStr;

    if (isOverdue) {
      return (
        <Badge variant="destructive" className="gap-1 text-[11px] font-medium py-0.5">
          <AlertCircle className="h-3 w-3" />
          <span>Overdue</span>
        </Badge>
      );
    }

    switch (inv.status) {
      case "paid":
        return (
          <Badge variant="success" className="gap-1 text-[11px] font-medium py-0.5">
            <CheckCircle2 className="h-3 w-3" />
            <span>Paid</span>
          </Badge>
        );
      case "partially_paid":
        return (
          <Badge variant="warning" className="gap-1 text-[11px] font-medium py-0.5">
            <Clock className="h-3 w-3" />
            <span>Partially Paid</span>
          </Badge>
        );
      case "confirmed":
        return (
          <Badge variant="default" className="gap-1 text-[11px] font-medium py-0.5">
            <Clock className="h-3 w-3" />
            <span>Due</span>
          </Badge>
        );
      case "draft":
        return (
          <Badge variant="outline" className="gap-1 text-[11px] font-medium py-0.5">
            <span>Draft</span>
          </Badge>
        );
      case "cancelled":
      case "void":
        return (
          <Badge variant="secondary" className="gap-1 text-[11px] font-medium py-0.5">
            <XCircle className="h-3 w-3" />
            <span>{inv.status === "cancelled" ? "Cancelled" : "Void"}</span>
          </Badge>
        );
      default:
        return <Badge variant="secondary">{inv.status}</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      {/* Search and Filters */}
      <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search invoice #, customer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-md border border-input bg-background pl-9 pr-4 py-2 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        <div className="flex items-center gap-1.5 flex-wrap w-full md:w-auto">
          {(["all", "draft", "confirmed", "partially_paid", "paid", "cancelled"] as const).map(
            (statusKey) => (
              <button
                key={statusKey}
                onClick={() => setStatusFilter(statusKey)}
                className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                  statusFilter === statusKey
                    ? "bg-primary text-primary-foreground border-primary font-medium shadow-xs"
                    : "bg-card text-muted-foreground hover:bg-muted/50 border-input"
                }`}
              >
                {statusKey === "all"
                  ? "All"
                  : statusKey === "partially_paid"
                  ? "Partially Paid"
                  : statusKey.charAt(0).toUpperCase() + statusKey.slice(1)}
              </button>
            )
          )}
        </div>
      </div>

      {/* Invoices List / Table */}
      {filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 flex flex-col items-center justify-center text-center space-y-3">
            <Receipt className="h-10 w-10 text-muted-foreground/60" />
            <div className="space-y-1">
              <h3 className="font-semibold text-sm">No Invoices Found</h3>
              <p className="text-xs text-muted-foreground max-w-sm">
                {search || statusFilter !== "all"
                  ? "No invoices match the specified search query or status filter."
                  : portalMode
                  ? "You do not have any invoices issued yet."
                  : "No invoices have been generated yet. Use 'Run Due Billing' or create a subscription."}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-md border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 border-b text-muted-foreground font-medium text-left">
                <tr>
                  <th className="py-3 px-4">Invoice #</th>
                  {!portalMode && <th className="py-3 px-4">Customer</th>}
                  <th className="py-3 px-4">Period</th>
                  <th className="py-3 px-4">Due Date</th>
                  <th className="py-3 px-4 text-right">Total</th>
                  <th className="py-3 px-4 text-right">Paid</th>
                  <th className="py-3 px-4 text-right">Balance Due</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((inv) => {
                  const detailHref = portalMode
                    ? `/portal/invoices/${inv.id}`
                    : `/invoices/${inv.id}`;

                  return (
                    <tr key={inv.id} className="hover:bg-muted/20 transition-colors">
                      <td className="py-3 px-4 font-semibold text-foreground">
                        <Link
                          href={detailHref}
                          className="hover:underline flex items-center gap-1.5 text-primary"
                        >
                          <Receipt className="h-3.5 w-3.5" />
                          <span>{inv.invoiceNumber}</span>
                        </Link>
                      </td>
                      {!portalMode && (
                        <td className="py-3 px-4">
                          <div className="font-medium">{inv.customer?.legalName || "Customer"}</div>
                          <div className="text-[10px] text-muted-foreground">
                            {inv.customer?.customerCode}
                          </div>
                        </td>
                      )}
                      <td className="py-3 px-4 text-muted-foreground">
                        {inv.billingPeriodStart && inv.billingPeriodEnd ? (
                          <span>
                            {inv.billingPeriodStart} → {inv.billingPeriodEnd}
                          </span>
                        ) : (
                          <span>One-off</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">{inv.dueDate}</td>
                      <td className="py-3 px-4 text-right font-medium">
                        {formatCurrency(inv.total, inv.currencyCode)}
                      </td>
                      <td className="py-3 px-4 text-right text-emerald-600 font-medium">
                        {formatCurrency(inv.amountPaid, inv.currencyCode)}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-foreground">
                        {formatCurrency(inv.balanceDue, inv.currencyCode)}
                      </td>
                      <td className="py-3 px-4 text-center">{getStatusBadge(inv)}</td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Link href={detailHref}>
                            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
                              <Eye className="h-3.5 w-3.5" />
                              <span>View</span>
                            </Button>
                          </Link>

                          {!portalMode &&
                            inv.balanceDue > 0 &&
                            (inv.status === "confirmed" || inv.status === "partially_paid") && (
                              <RecordPaymentDialog
                                invoice={inv}
                                triggerButton={
                                  <Button
                                    size="sm"
                                    className="h-7 text-xs gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                                  >
                                    <CreditCard className="h-3 w-3" />
                                    <span>Pay</span>
                                  </Button>
                                }
                              />
                            )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
