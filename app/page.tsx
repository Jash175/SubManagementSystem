import * as React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUserSession } from "@/features/auth/guards";
import { AdminShell } from "@/components/layout/admin-shell";
import { PageHeader } from "@/components/shared/page-header";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Layers,
  Shield,
  FileSpreadsheet,
  Receipt,
  CreditCard,
  Users,
  Package,
  Percent,
  Clock,
  ArrowRight,
  UserCheck,
  TrendingUp,
  AlertCircle,
  Play,
} from "lucide-react";
import { getFinancialMetrics } from "@/features/dashboard/services";
import { getInvoices } from "@/features/billing/services";
import { getPayments } from "@/features/payments/services";
import { formatCurrency } from "@/features/products/pricing";
import { BillingRunDialog } from "@/features/billing/components/billing-run-dialog";

interface ModuleCardInfo {
  name: string;
  description: string;
  directory: string;
  icon: React.ComponentType<{ className?: string }>;
  phase: string;
  status: "Complete" | "Planned";
}

const modulesRoadmap: ModuleCardInfo[] = [
  {
    name: "Authentication & Roles",
    description: "Role-based access control for Admins, Staff, and Customers with strict password policies.",
    directory: "features/auth",
    icon: Shield,
    phase: "Phase 1",
    status: "Complete",
  },
  {
    name: "Staff Management",
    description: "Admin-only provisioning and management of internal operational staff accounts.",
    directory: "features/auth",
    icon: UserCheck,
    phase: "Phase 1",
    status: "Complete",
  },
  {
    name: "Customers & Portals",
    description: "Customer registration, profile mapping, and self-service portal isolation.",
    directory: "features/customers",
    icon: Users,
    phase: "Phase 1",
    status: "Complete",
  },
  {
    name: "Products & Variants",
    description: "Product catalog, multi-attribute variants with price deltas, and decimal-safe pricing.",
    directory: "features/products",
    icon: Package,
    phase: "Phase 2",
    status: "Complete",
  },
  {
    name: "Subscription Plans",
    description: "Configurable billing frequencies, minimum quantities, availability windows, and lifecycle flags.",
    directory: "features/plans",
    icon: Layers,
    phase: "Phase 2",
    status: "Complete",
  },
  {
    name: "Discounts & Taxes",
    description: "Fixed/percentage discount rules, product scoping, usage caps, and percentage tax rules.",
    directory: "features/discounts",
    icon: Percent,
    phase: "Phase 2",
    status: "Complete",
  },
  {
    name: "Quotations & Templates",
    description: "Quotation drafting, price snapshots, template-based proposals, and confirmation.",
    directory: "features/quotations",
    icon: FileSpreadsheet,
    phase: "Phase 3",
    status: "Complete",
  },
  {
    name: "Subscriptions Lifecycle",
    description: "State machine transitions: Draft → Active → Paused → Closed, with audit trails.",
    directory: "features/subscriptions",
    icon: Clock,
    phase: "Phase 3",
    status: "Complete",
  },
  {
    name: "Billing & Invoices",
    description: "Automated recurring billing engine, immutable invoice snapshots, and period guards.",
    directory: "features/billing",
    icon: Receipt,
    phase: "Phase 4",
    status: "Complete",
  },
  {
    name: "Payments & Reconciliation",
    description: "Payment recording, invoice balance tracking, and partial settlement.",
    directory: "features/payments",
    icon: CreditCard,
    phase: "Phase 4",
    status: "Complete",
  },
];

export const instant = false;

export default async function DashboardPage() {
  const session = await getCurrentUserSession();

  // If a customer accesses root operations console, redirect to customer portal
  if (session?.role === "customer") {
    redirect("/portal");
  }

  const roleTitle =
    session?.role === "admin"
      ? "Administrator Console"
      : session?.role === "staff"
      ? "Staff Workspace"
      : "Operations Console";

  const metrics = await getFinancialMetrics();
  const recentInvoices = await getInvoices({ limit: 5 });
  const recentPayments = await getPayments({ limit: 5 });

  return (
    <AdminShell userSession={session}>
      <PageHeader
        heading={`Brightloop ${roleTitle}`}
        subheading="End-to-End Subscription Management: Products → Plans → Quotations → Subscriptions → Invoices → Payments."
      >
        <BillingRunDialog />
      </PageHeader>

      <div className="space-y-6">
        {/* Financial KPI Dashboard Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="shadow-xs border-border/80">
            <CardHeader className="p-4 pb-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Invoiced Amount</span>
                <Receipt className="h-4 w-4 text-primary" />
              </div>
              <CardTitle className="text-xl font-bold pt-1">
                {formatCurrency(metrics.invoicedTotal)}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <p className="text-[11px] text-muted-foreground">
                {metrics.paidInvoicesCount + metrics.partiallyPaidCount + metrics.unpaidCount} confirmed/settled invoices
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-xs border-border/80">
            <CardHeader className="p-4 pb-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                  Amount Collected
                </span>
                <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <CardTitle className="text-xl font-bold pt-1 text-emerald-700 dark:text-emerald-400">
                {formatCurrency(metrics.collectedTotal)}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <p className="text-[11px] text-muted-foreground">
                {metrics.paidInvoicesCount} paid in full • {metrics.partiallyPaidCount} partially paid
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-xs border-border/80">
            <CardHeader className="p-4 pb-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
                  Outstanding Balance
                </span>
                <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              </div>
              <CardTitle className="text-xl font-bold pt-1 text-foreground">
                {formatCurrency(metrics.outstandingTotal)}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <p className="text-[11px] text-muted-foreground">
                {metrics.unpaidCount + metrics.partiallyPaidCount} invoices awaiting full settlement
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-xs border-border/80">
            <CardHeader className="p-4 pb-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-destructive">Overdue Invoices</span>
                <AlertCircle className="h-4 w-4 text-destructive" />
              </div>
              <CardTitle className="text-xl font-bold pt-1 text-destructive">
                {formatCurrency(metrics.overdueTotal)}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <p className="text-[11px] text-destructive font-medium">
                {metrics.overdueCount} invoice(s) past due date
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Operations Bar */}
        <div className="rounded-xl border bg-muted/20 p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Receipt className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-xs font-semibold text-foreground">Recurring Billing Engine</h3>
              <p className="text-[11px] text-muted-foreground">
                Trigger retry-safe billing for due subscriptions or inspect payments ledger.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <BillingRunDialog
              triggerButton={
                <Button size="sm" className="gap-1.5 text-xs h-8 bg-primary text-primary-foreground w-full sm:w-auto">
                  <Play className="h-3.5 w-3.5" />
                  <span>Run Due Billing</span>
                </Button>
              }
            />
            <Link href="/billing" className="w-full sm:w-auto">
              <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8 w-full sm:w-auto">
                <Receipt className="h-3.5 w-3.5" />
                <span>All Invoices</span>
              </Button>
            </Link>
            <Link href="/payments" className="w-full sm:w-auto">
              <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8 w-full sm:w-auto">
                <CreditCard className="h-3.5 w-3.5" />
                <span>Payment Log</span>
              </Button>
            </Link>
          </div>
        </div>

        {/* Recent Invoices & Payments Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Invoices Card */}
          <Card className="border-border/80">
            <CardHeader className="p-4 pb-2 border-b">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Receipt className="h-4 w-4 text-primary" />
                  <CardTitle className="text-sm font-semibold">Recent Invoices</CardTitle>
                </div>
                <Link href="/billing" className="text-xs text-primary hover:underline">
                  View all →
                </Link>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {recentInvoices.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground">
                  No invoices generated yet. Run billing to create recurring invoices.
                </div>
              ) : (
                <div className="divide-y divide-border text-xs">
                  {recentInvoices.map((inv) => (
                    <div
                      key={inv.id}
                      className="p-3 flex items-center justify-between hover:bg-muted/20 transition-colors"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/invoices/${inv.id}`}
                            className="font-semibold text-primary hover:underline"
                          >
                            {inv.invoiceNumber}
                          </Link>
                          <Badge
                            variant={
                              inv.status === "paid"
                                ? "success"
                                : inv.status === "partially_paid"
                                ? "warning"
                                : "outline"
                            }
                            className="text-[10px] py-0 px-1.5 uppercase"
                          >
                            {inv.status}
                          </Badge>
                        </div>
                        <div className="text-muted-foreground text-[11px] mt-0.5">
                          {inv.customer?.legalName || "Customer"} • Due: {inv.dueDate}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-foreground">
                          {formatCurrency(inv.total, inv.currencyCode)}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          Bal: {formatCurrency(inv.balanceDue, inv.currencyCode)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Payments Card */}
          <Card className="border-border/80">
            <CardHeader className="p-4 pb-2 border-b">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-emerald-600" />
                  <CardTitle className="text-sm font-semibold">Recent Payments</CardTitle>
                </div>
                <Link href="/payments" className="text-xs text-primary hover:underline">
                  View all →
                </Link>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {recentPayments.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground">
                  No payments recorded yet. Settle due invoices to populate this ledger.
                </div>
              ) : (
                <div className="divide-y divide-border text-xs">
                  {recentPayments.map((p) => (
                    <div
                      key={p.id}
                      className="p-3 flex items-center justify-between hover:bg-muted/20 transition-colors"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-foreground">
                            {p.invoice?.invoiceNumber || "Settlement"}
                          </span>
                          <Badge variant="outline" className="text-[10px] py-0 px-1.5 capitalize">
                            {p.paymentMethod.replace("_", " ")}
                          </Badge>
                        </div>
                        <div className="text-muted-foreground text-[11px] mt-0.5">
                          {p.paidAt.slice(0, 10)} {p.referenceNumber ? `• Ref: ${p.referenceNumber}` : ""}
                        </div>
                      </div>
                      <div className="text-right font-bold text-emerald-600">
                        +{formatCurrency(p.amount)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Feature Modules Roadmap Overview */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-foreground">
                Domain Feature Modules
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Current status across the Brightloop modular monolith architecture.
              </p>
            </div>
            <span className="text-xs text-muted-foreground hidden sm:inline-block">
              {modulesRoadmap.filter((m) => m.status === "Complete").length} Active / {modulesRoadmap.length} Total
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {modulesRoadmap.map((mod) => {
              const Icon = mod.icon;
              const isDone = mod.status === "Complete";
              return (
                <Card
                  key={mod.name}
                  className="flex flex-col justify-between transition-colors border-border/70 hover:border-border"
                >
                  <CardHeader className="p-5 pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-foreground">
                        <Icon className="h-4 w-4" />
                      </div>
                      <Badge
                        variant={isDone ? "success" : "outline"}
                        className="text-[11px] font-normal"
                      >
                        {mod.phase} {isDone ? "• Done" : ""}
                      </Badge>
                    </div>
                    <CardTitle className="text-base font-semibold pt-3">
                      {mod.name}
                    </CardTitle>
                    <CardDescription className="text-xs text-muted-foreground leading-normal pt-1">
                      {mod.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-5 pt-0">
                    <div className="flex items-center justify-between pt-3 border-t text-[11px] text-muted-foreground">
                      <span className="font-mono text-[10px] text-muted-foreground/80">
                        {mod.directory}
                      </span>
                      <span
                        className={`flex items-center gap-1 text-[11px] font-medium ${
                          isDone
                            ? "text-emerald-600 dark:text-emerald-400 font-semibold"
                            : "text-foreground/70"
                        }`}
                      >
                        {mod.status}
                        {!isDone && <ArrowRight className="h-3 w-3" />}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
