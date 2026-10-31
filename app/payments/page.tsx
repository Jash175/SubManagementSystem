import * as React from "react";
import { redirect } from "next/navigation";
import { getCurrentUserSession } from "@/features/auth/guards";
import { AdminShell } from "@/components/layout/admin-shell";
import { PageHeader } from "@/components/shared/page-header";
import { getPayments } from "@/features/payments/services";
import { PaymentList } from "@/features/payments/components/payment-list";
import { formatCurrency } from "@/features/products/pricing";

export const instant = false;

export default async function PaymentsPage() {
  const session = await getCurrentUserSession();
  if (!session) {
    redirect("/login");
  }

  if (session.role === "customer") {
    redirect("/portal");
  }

  const payments = await getPayments({ limit: 100 });
  const totalCollected = payments.reduce((acc, curr) => acc + curr.amount, 0);

  return (
    <AdminShell userSession={session}>
      <div className="space-y-6">
        <PageHeader
          heading="Payment Transactions"
          subheading="Complete ledger of manual settlements and payments recorded against invoices."
        />

        {/* Payment Summary Metric */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="rounded-xl border bg-card p-4 shadow-xs">
            <span className="text-xs text-muted-foreground font-medium">Total Payments Recorded</span>
            <div className="text-2xl font-bold mt-1 text-emerald-600">
              {formatCurrency(totalCollected)}
            </div>
            <span className="text-[11px] text-muted-foreground mt-0.5 block">
              Across {payments.length} settled transaction record(s)
            </span>
          </div>

          <div className="rounded-xl border bg-card p-4 shadow-xs">
            <span className="text-xs text-muted-foreground font-medium">Payment Reconciliations</span>
            <div className="text-2xl font-bold mt-1 text-foreground">
              {payments.length}
            </div>
            <span className="text-[11px] text-muted-foreground mt-0.5 block">
              All transactions verified and auditable
            </span>
          </div>
        </div>

        <PaymentList payments={payments} />
      </div>
    </AdminShell>
  );
}
