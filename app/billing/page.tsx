import * as React from "react";
import { redirect } from "next/navigation";
import { getCurrentUserSession } from "@/features/auth/guards";
import { AdminShell } from "@/components/layout/admin-shell";
import { PageHeader } from "@/components/shared/page-header";
import { getInvoices, getBillingRuns } from "@/features/billing/services";
import { InvoiceList } from "@/features/billing/components/invoice-list";
import { BillingRunDialog } from "@/features/billing/components/billing-run-dialog";
import { History } from "lucide-react";
import { formatCurrency } from "@/features/products/pricing";

export const instant = false;

export default async function BillingPage() {
  const session = await getCurrentUserSession();
  if (!session) {
    redirect("/login");
  }

  if (session.role === "customer") {
    redirect("/portal/invoices");
  }

  const invoices = await getInvoices();
  const billingRuns = await getBillingRuns({ limit: 5 });

  const totalInvoiced = invoices
    .filter((i) => i.status !== "draft" && i.status !== "cancelled" && i.status !== "void")
    .reduce((acc, curr) => acc + curr.total, 0);

  const totalCollected = invoices
    .filter((i) => i.status !== "draft" && i.status !== "cancelled" && i.status !== "void")
    .reduce((acc, curr) => acc + curr.amountPaid, 0);

  const totalOutstanding = invoices
    .filter((i) => i.status === "confirmed" || i.status === "partially_paid")
    .reduce((acc, curr) => acc + curr.balanceDue, 0);

  return (
    <AdminShell userSession={session}>
      <div className="space-y-6">
        <PageHeader
          heading="Billing & Invoices"
          subheading="Manage subscription recurring billing cycles, invoices, and payment reconciliation."
        >
          <BillingRunDialog />
        </PageHeader>

        {/* Top Summary Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-xl border bg-card p-4 shadow-xs">
            <span className="text-xs text-muted-foreground font-medium">Invoiced to Date</span>
            <div className="text-xl font-bold mt-1 text-foreground">
              {formatCurrency(totalInvoiced)}
            </div>
            <span className="text-[11px] text-muted-foreground mt-0.5 block">
              Active confirmed and settled invoices
            </span>
          </div>

          <div className="rounded-xl border bg-card p-4 shadow-xs">
            <span className="text-xs text-emerald-600 font-medium">Total Collected</span>
            <div className="text-xl font-bold mt-1 text-emerald-700 dark:text-emerald-400">
              {formatCurrency(totalCollected)}
            </div>
            <span className="text-[11px] text-muted-foreground mt-0.5 block">
              Direct and manual settlements received
            </span>
          </div>

          <div className="rounded-xl border bg-card p-4 shadow-xs">
            <span className="text-xs text-amber-600 font-medium">Outstanding Balance</span>
            <div className="text-xl font-bold mt-1 text-foreground">
              {formatCurrency(totalOutstanding)}
            </div>
            <span className="text-[11px] text-muted-foreground mt-0.5 block">
              Due across active invoices
            </span>
          </div>
        </div>

        {/* Invoice List Component */}
        <InvoiceList invoices={invoices} />

        {/* Recent Billing Execution Runs */}
        {billingRuns.length > 0 && (
          <div className="space-y-3 pt-6 border-t">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">
                Recent Billing Run Audit Log
              </h2>
            </div>

            <div className="rounded-lg border bg-card overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-muted/40 border-b text-muted-foreground font-medium text-left">
                  <tr>
                    <th className="py-2.5 px-3">Run Date</th>
                    <th className="py-2.5 px-3">Trigger</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">Checked</th>
                    <th className="py-2.5 px-3 text-right">Invoices Created</th>
                    <th className="py-2.5 px-3 text-right">Periods Skipped</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {billingRuns.map((r) => (
                    <tr key={r.id}>
                      <td className="py-2 px-3 font-medium text-foreground">
                        {r.startedAt.slice(0, 19).replace("T", " ")}
                      </td>
                      <td className="py-2 px-3 capitalize">{r.triggerSource}</td>
                      <td className="py-2 px-3">
                        <span
                          className={`font-semibold ${
                            r.status === "completed"
                              ? "text-emerald-600"
                              : "text-amber-600"
                          }`}
                        >
                          {r.status}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right">{r.subscriptionsChecked}</td>
                      <td className="py-2 px-3 text-right font-semibold text-emerald-600">
                        {r.invoicesCreated}
                      </td>
                      <td className="py-2 px-3 text-right text-muted-foreground">
                        {r.invoicesSkipped}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AdminShell>
  );
}
