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
import { Button } from "@/components/ui/button";
import {
  ShieldCheck,
  Repeat,
  Receipt,
  FileText,
  CreditCard,
  Calendar,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  DollarSign,
  CheckCircle,
} from "lucide-react";
import { getCustomerDashboardData } from "@/features/portal/services";
import { formatCurrency } from "@/features/products/pricing";

export const instant = false;

export default async function CustomerPortalPage() {
  const session = await getCurrentUserSession();

  // If not authenticated, redirect to login
  if (!session) {
    redirect("/login?redirectTo=/portal");
  }

  const customerId = session.customer?.id;
  const dashboardData = customerId
    ? await getCustomerDashboardData(customerId)
    : null;

  const metrics = dashboardData?.metrics || {
    activeSubscriptionsCount: 0,
    pausedSubscriptionsCount: 0,
    totalSubscriptionsCount: 0,
    pendingQuotationsCount: 0,
    openInvoicesCount: 0,
    outstandingBalance: 0,
    totalPaid: 0,
    overdueInvoicesCount: 0,
    overdueAmount: 0,
    currencyCode: "USD",
  };

  const activeSubscriptions = dashboardData?.activeSubscriptions || [];
  const quotations = dashboardData?.quotations || [];
  const recentInvoices = dashboardData?.recentInvoices || [];
  const recentPayments = dashboardData?.recentPayments || [];

  return (
    <CustomerShell userSession={session}>
      <div className="space-y-6">
        <PageHeader
          heading={`Welcome back, ${session.fullName || "Subscriber"}`}
          subheading="Monitor your active subscriptions, review quotation offers, and inspect billing history."
        >
          <div className="flex items-center gap-2">
            {session.customer?.customerCode && (
              <Badge variant="outline" className="font-mono text-xs">
                {session.customer.customerCode}
              </Badge>
            )}
            <Badge variant="success" className="text-xs">
              Account Active
            </Badge>
          </div>
        </PageHeader>

        {/* Action Required Alerts */}
        {metrics.pendingQuotationsCount > 0 && (
          <div className="flex items-center justify-between p-4 rounded-lg bg-blue-500/10 border border-blue-500/30 text-xs text-blue-900 dark:text-blue-200">
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0" />
              <div>
                <span className="font-semibold">Quotation Offer Available:</span> You have{" "}
                <span className="font-bold">{metrics.pendingQuotationsCount}</span> pending quotation offer(s) ready for review and acceptance.
              </div>
            </div>
            <Link href="/portal/quotations">
              <Button size="sm" variant="outline" className="h-7 text-xs border-blue-400/40 text-blue-700 dark:text-blue-300">
                Review Offers →
              </Button>
            </Link>
          </div>
        )}

        {metrics.overdueInvoicesCount > 0 && (
          <div className="flex items-center justify-between p-4 rounded-lg bg-destructive/10 border border-destructive/30 text-xs text-destructive">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 shrink-0 text-destructive" />
              <div>
                <span className="font-semibold">Payment Attention Required:</span> You have{" "}
                <span className="font-bold">{metrics.overdueInvoicesCount}</span> overdue invoice(s) totaling{" "}
                <span className="font-mono font-bold">
                  {formatCurrency(metrics.overdueAmount, metrics.currencyCode)}
                </span>
                .
              </div>
            </div>
            <Link href="/portal/invoices">
              <Button size="sm" variant="destructive" className="h-7 text-xs">
                View Overdue →
              </Button>
            </Link>
          </div>
        )}

        {/* Financial and Subscription Key Performance Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-border/80">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardDescription className="text-xs font-medium">Active Subscriptions</CardDescription>
                <div className="h-8 w-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <Repeat className="h-4 w-4" />
                </div>
              </div>
              <CardTitle className="text-2xl font-bold font-mono">
                {metrics.activeSubscriptionsCount}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-[11px] text-muted-foreground">
                {metrics.pausedSubscriptionsCount > 0
                  ? `${metrics.pausedSubscriptionsCount} paused • `
                  : ""}
                {metrics.totalSubscriptionsCount} total registered plan(s)
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/80">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardDescription className="text-xs font-medium">Outstanding Balance</CardDescription>
                <div className="h-8 w-8 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                  <DollarSign className="h-4 w-4" />
                </div>
              </div>
              <CardTitle className="text-2xl font-bold font-mono">
                {formatCurrency(metrics.outstandingBalance, metrics.currencyCode)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-[11px] text-muted-foreground">
                {metrics.openInvoicesCount} open or partially paid invoice(s)
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/80">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardDescription className="text-xs font-medium">Total Paid to Date</CardDescription>
                <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <TrendingUp className="h-4 w-4" />
                </div>
              </div>
              <CardTitle className="text-2xl font-bold font-mono">
                {formatCurrency(metrics.totalPaid, metrics.currencyCode)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-[11px] text-muted-foreground">
                Lifetime settled payments
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/80">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardDescription className="text-xs font-medium">Pending Quotations</CardDescription>
                <div className="h-8 w-8 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <FileText className="h-4 w-4" />
                </div>
              </div>
              <CardTitle className="text-2xl font-bold font-mono">
                {metrics.pendingQuotationsCount}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-[11px] text-muted-foreground">
                Ready for self-service confirmation
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main Overview Grid: Subscriptions & Quotations */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Active Subscriptions Card */}
          <Card className="border-border/80">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Repeat className="h-4 w-4 text-primary" />
                    My Subscriptions
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Current recurring subscriptions and renewal cadence
                  </CardDescription>
                </div>
                <Link href="/portal/subscriptions">
                  <Button variant="ghost" size="sm" className="h-7 text-xs text-primary gap-1">
                    View All <ArrowRight className="h-3 w-3" />
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {activeSubscriptions.length === 0 ? (
                <div className="rounded-lg bg-muted/20 p-6 text-center border border-dashed">
                  <Repeat className="h-8 w-8 mx-auto text-muted-foreground mb-2 opacity-50" />
                  <p className="text-xs font-medium text-foreground">No active subscriptions yet</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Subscriptions set up for your account will appear here with renewal schedules.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {activeSubscriptions.slice(0, 3).map((sub) => (
                    <div
                      key={sub.id}
                      className="p-3 bg-muted/30 rounded-lg border flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-foreground">
                            {sub.subscriptionNumber}
                          </span>
                          <Badge
                            variant={
                              sub.status === "active"
                                ? "success"
                                : sub.status === "paused"
                                ? "warning"
                                : "secondary"
                            }
                            className="text-[10px] uppercase font-semibold"
                          >
                            {sub.status}
                          </Badge>
                        </div>
                        <p className="text-xs font-medium text-foreground truncate mt-0.5">
                          {sub.planNameSnapshot}
                        </p>
                        {sub.nextBillingDate && sub.status === "active" && (
                          <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">
                            Next renewal: {sub.nextBillingDate}
                          </p>
                        )}
                      </div>

                      <Link href={`/portal/subscriptions/${sub.id}`}>
                        <Button variant="outline" size="sm" className="h-7 text-xs shrink-0">
                          Manage
                        </Button>
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quotations & Offers Card */}
          <Card className="border-border/80">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" />
                    Pending Quotation Offers
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Proposals and customized plan packages prepared for you
                  </CardDescription>
                </div>
                <Link href="/portal/quotations">
                  <Button variant="ghost" size="sm" className="h-7 text-xs text-primary gap-1">
                    View All <ArrowRight className="h-3 w-3" />
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {quotations.length === 0 ? (
                <div className="rounded-lg bg-muted/20 p-6 text-center border border-dashed">
                  <CheckCircle className="h-8 w-8 mx-auto text-muted-foreground mb-2 opacity-50" />
                  <p className="text-xs font-medium text-foreground">No pending quotations</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    When staff prepare a new subscription offer for you, it will show up here for acceptance.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {quotations.slice(0, 3).map((quote) => (
                    <div
                      key={quote.id}
                      className="p-3 bg-muted/30 rounded-lg border flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-foreground">
                            {quote.subscriptionNumber}
                          </span>
                          <Badge variant="outline" className="text-[10px] uppercase font-semibold">
                            {quote.status}
                          </Badge>
                        </div>
                        <p className="text-xs font-medium text-foreground truncate mt-0.5">
                          {quote.planNameSnapshot}
                        </p>
                        {quote.quotationValidUntil && (
                          <p className="text-[11px] text-muted-foreground font-mono mt-0.5 flex items-center gap-1">
                            <Calendar className="h-3 w-3" /> Valid until: {quote.quotationValidUntil}
                          </p>
                        )}
                      </div>

                      <Link href={`/portal/quotations/${quote.id}`}>
                        <Button size="sm" className="h-7 text-xs shrink-0">
                          Review
                        </Button>
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Secondary Grid: Invoices & Payment History */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Invoices Card */}
          <Card className="border-border/80">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Receipt className="h-4 w-4 text-primary" />
                    Recent Invoices
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Billing statements, invoice balances, and payment status
                  </CardDescription>
                </div>
                <Link href="/portal/invoices">
                  <Button variant="ghost" size="sm" className="h-7 text-xs text-primary gap-1">
                    View All <ArrowRight className="h-3 w-3" />
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {recentInvoices.length === 0 ? (
                <div className="rounded-lg bg-muted/20 p-6 text-center border border-dashed">
                  <Receipt className="h-8 w-8 mx-auto text-muted-foreground mb-2 opacity-50" />
                  <p className="text-xs font-medium text-foreground">No invoices generated yet</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Invoices produced from recurring billing cycles will be listed here.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentInvoices.slice(0, 3).map((inv) => (
                    <div
                      key={inv.id}
                      className="p-3 bg-muted/30 rounded-lg border flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-foreground">
                            {inv.invoiceNumber}
                          </span>
                          <Badge
                            variant={
                              inv.status === "paid"
                                ? "success"
                                : inv.status === "partially_paid"
                                ? "warning"
                                : "outline"
                            }
                            className="text-[10px] uppercase font-semibold"
                          >
                            {inv.status}
                          </Badge>
                        </div>
                        <p className="text-xs text-foreground mt-0.5">
                          Total: <span className="font-semibold">{formatCurrency(inv.total, inv.currencyCode)}</span> • Balance Due:{" "}
                          <span className="font-semibold text-primary">{formatCurrency(inv.balanceDue, inv.currencyCode)}</span>
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          Due Date: {inv.dueDate}
                        </p>
                      </div>

                      <Link href={`/portal/invoices/${inv.id}`}>
                        <Button variant="outline" size="sm" className="h-7 text-xs shrink-0">
                          View
                        </Button>
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Payment History Card */}
          <Card className="border-border/80">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-primary" />
                    Recent Payments
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Settled payments and official transaction receipts
                  </CardDescription>
                </div>
                <Link href="/portal/payments">
                  <Button variant="ghost" size="sm" className="h-7 text-xs text-primary gap-1">
                    View All <ArrowRight className="h-3 w-3" />
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {recentPayments.length === 0 ? (
                <div className="rounded-lg bg-muted/20 p-6 text-center border border-dashed">
                  <CreditCard className="h-8 w-8 mx-auto text-muted-foreground mb-2 opacity-50" />
                  <p className="text-xs font-medium text-foreground">No payments recorded yet</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Recorded payment receipts will be tracked here for your records.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentPayments.slice(0, 3).map((p) => (
                    <div
                      key={p.id}
                      className="p-3 bg-muted/30 rounded-lg border flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-semibold text-foreground">
                            {p.referenceNumber || "Payment Receipt"}
                          </span>
                          <Badge variant="outline" className="text-[10px] uppercase font-mono">
                            {p.paymentMethod.replace("_", " ")}
                          </Badge>
                        </div>
                        <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5">
                          {formatCurrency(p.amount, metrics.currencyCode)}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {new Date(p.paidAt).toLocaleDateString()}
                          {p.invoice?.invoiceNumber && ` • Invoice #${p.invoice.invoiceNumber}`}
                        </p>
                      </div>

                      <Badge variant="success" className="text-[10px] uppercase">
                        Settled
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Security & Isolation Verification Banner */}
        <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/30 border text-xs text-muted-foreground">
          <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <div>
            <span className="font-semibold text-foreground">Enterprise Multi-Tenant Isolation:</span> All data queries in this portal are automatically bounded to your customer account{" "}
            {session.customer?.customerCode ? `(${session.customer.customerCode})` : ""} by Supabase Row-Level Security policies.
          </div>
        </div>
      </div>
    </CustomerShell>
  );
}
