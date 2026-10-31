import * as React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUserSession } from "@/features/auth/guards";
import { CustomerShell } from "@/components/layout/customer-shell";
import { PageHeader } from "@/components/shared/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CreditCard, ExternalLink, ShieldCheck } from "lucide-react";
import { getPayments } from "@/features/payments/services";
import { formatCurrency } from "@/features/products/pricing";

export const instant = false;

export default async function CustomerPaymentsPage() {
  const session = await getCurrentUserSession();
  if (!session) {
    redirect("/login?redirectTo=/portal/payments");
  }

  const customerId = session.customer?.id;
  const payments = customerId ? await getPayments({ customerId }) : [];

  const totalPaid = payments.reduce((acc, p) => acc + p.amount, 0);

  return (
    <CustomerShell userSession={session}>
      <div className="space-y-6">
        <PageHeader
          heading="Payment History & Receipts"
          subheading="Audit all recorded payments, transaction reference IDs, and settled invoices."
        >
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-mono text-xs">
              {payments.length} Transaction(s)
            </Badge>
            <Badge variant="success" className="font-mono text-xs">
              Total Settled: {formatCurrency(totalPaid, "USD")}
            </Badge>
          </div>
        </PageHeader>

        {payments.length === 0 ? (
          <Card className="border-border/80">
            <CardContent className="py-12 text-center">
              <div className="h-12 w-12 rounded-full bg-muted/50 mx-auto flex items-center justify-center text-muted-foreground mb-3">
                <CreditCard className="h-6 w-6 opacity-60" />
              </div>
              <h3 className="text-sm font-semibold text-foreground">
                No payment transactions recorded
              </h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                When manual payments or settled invoice transactions are recorded for your account, they will be itemized here.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-border/80">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-primary" />
                Transaction Ledger
              </CardTitle>
              <CardDescription className="text-xs">
                Official payment records and settlement audit logs
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-muted/50 border-b text-[11px] font-semibold text-muted-foreground uppercase">
                    <tr>
                      <th className="p-3">Reference / ID</th>
                      <th className="p-3">Date</th>
                      <th className="p-3">Invoice Number</th>
                      <th className="p-3">Payment Method</th>
                      <th className="p-3 text-right">Amount Settled</th>
                      <th className="p-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {payments.map((p) => (
                      <tr key={p.id} className="hover:bg-muted/20 transition-colors">
                        <td className="p-3 font-mono font-semibold text-foreground">
                          {p.referenceNumber || `RCPT-${p.id.slice(0, 8).toUpperCase()}`}
                        </td>
                        <td className="p-3 text-muted-foreground">
                          {new Date(p.paidAt).toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </td>
                        <td className="p-3">
                          {p.invoice?.invoiceNumber ? (
                            <Link
                              href={`/portal/invoices/${p.invoiceId}`}
                              className="font-mono text-primary hover:underline inline-flex items-center gap-1 font-semibold"
                            >
                              {p.invoice.invoiceNumber}
                              <ExternalLink className="h-3 w-3" />
                            </Link>
                          ) : (
                            <span className="text-muted-foreground font-mono">Invoice #{p.invoiceId.slice(0, 8)}</span>
                          )}
                        </td>
                        <td className="p-3">
                          <Badge variant="outline" className="text-[10px] font-mono uppercase">
                            {p.paymentMethod.replace("_", " ")}
                          </Badge>
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          {formatCurrency(p.amount, "USD")}
                        </td>
                        <td className="p-3 text-center">
                          <Badge variant="success" className="text-[10px] uppercase font-semibold">
                            Settled
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Security Reassurance */}
        <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/30 border text-xs text-muted-foreground">
          <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <div>
            <span className="font-semibold text-foreground">Immutable Ledger:</span> Payment records are permanently persisted and linked to corresponding invoice numbers with transaction timestamps.
          </div>
        </div>
      </div>
    </CustomerShell>
  );
}
