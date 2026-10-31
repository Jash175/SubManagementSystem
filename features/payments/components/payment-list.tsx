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
  CreditCard,
  Search,
  Receipt,
  Eye,
} from "lucide-react";
import { formatCurrency } from "@/features/products/pricing";
import type { Payment, PaymentMethod } from "@/types";

interface PaymentListProps {
  payments: Payment[];
}

export function PaymentList({ payments }: PaymentListProps) {
  const [search, setSearch] = React.useState("");
  const [methodFilter, setMethodFilter] = React.useState<PaymentMethod | "all">("all");

  const filtered = payments.filter((p) => {
    const matchesMethod = methodFilter === "all" || p.paymentMethod === methodFilter;
    const q = search.toLowerCase();
    const invNumber = p.invoice?.invoiceNumber || "";
    const custName = p.invoice?.customer?.legalName || "";
    const refNum = p.referenceNumber || "";

    const matchesSearch =
      invNumber.toLowerCase().includes(q) ||
      custName.toLowerCase().includes(q) ||
      refNum.toLowerCase().includes(q);

    return matchesMethod && matchesSearch;
  });

  const totalCollected = filtered.reduce((acc, curr) => acc + curr.amount, 0);

  return (
    <div className="space-y-4">
      {/* Search and Filters */}
      <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search invoice #, customer, ref #..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-md border border-input bg-background pl-9 pr-4 py-2 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        <div className="flex items-center gap-1.5 flex-wrap w-full md:w-auto">
          {(["all", "bank_transfer", "upi", "card", "cash", "cheque"] as const).map(
            (m) => (
              <button
                key={m}
                onClick={() => setMethodFilter(m)}
                className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                  methodFilter === m
                    ? "bg-primary text-primary-foreground border-primary font-medium shadow-xs"
                    : "bg-card text-muted-foreground hover:bg-muted/50 border-input"
                }`}
              >
                {m === "all"
                  ? "All Methods"
                  : m === "bank_transfer"
                  ? "Bank Transfer"
                  : m.toUpperCase()}
              </button>
            )
          )}
          {totalCollected > 0 && (
            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 pl-2">
              Sum: {formatCurrency(totalCollected)}
            </span>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 flex flex-col items-center justify-center text-center space-y-3">
            <CreditCard className="h-10 w-10 text-muted-foreground/60" />
            <div className="space-y-1">
              <h3 className="font-semibold text-sm">No Payments Found</h3>
              <p className="text-xs text-muted-foreground max-w-sm">
                {search || methodFilter !== "all"
                  ? "No payment records match your search or filter."
                  : "No payments have been recorded yet. Settle invoices from the Billing & Invoices page."}
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
                  <th className="py-3 px-4">Date Paid</th>
                  <th className="py-3 px-4">Invoice #</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Method</th>
                  <th className="py-3 px-4">Reference / UTR</th>
                  <th className="py-3 px-4 text-right">Amount Paid</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((p) => (
                  <tr key={p.id} className="hover:bg-muted/20 transition-colors">
                    <td className="py-3 px-4 text-muted-foreground font-medium">
                      {p.paidAt.slice(0, 10)}
                    </td>
                    <td className="py-3 px-4 font-semibold text-foreground">
                      {p.invoice ? (
                        <Link
                          href={`/invoices/${p.invoice.id}`}
                          className="hover:underline flex items-center gap-1.5 text-primary"
                        >
                          <Receipt className="h-3.5 w-3.5" />
                          <span>{p.invoice.invoiceNumber}</span>
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium">
                        {p.invoice?.customer?.legalName || "Customer"}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {p.invoice?.customer?.customerCode}
                      </div>
                    </td>
                    <td className="py-3 px-4 capitalize">
                      <Badge variant="outline" className="text-[10px] py-0 px-1.5">
                        {p.paymentMethod.replace("_", " ")}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 font-mono text-muted-foreground">
                      {p.referenceNumber || "—"}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-emerald-600">
                      {formatCurrency(p.amount)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {p.invoice && (
                        <Link href={`/invoices/${p.invoice.id}`}>
                          <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
                            <Eye className="h-3.5 w-3.5" />
                            <span>Invoice</span>
                          </Button>
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
