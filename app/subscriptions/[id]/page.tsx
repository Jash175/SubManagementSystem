import * as React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaffOrAdmin } from "@/features/auth/guards";
import { AdminShell } from "@/components/layout/admin-shell";
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
  ArrowLeft,
  Calendar,
  User,
  Shield,
  Layers,
  History,
  Package,
} from "lucide-react";
import { getSubscriptionById } from "@/features/subscriptions/services";
import { SubscriptionActions } from "@/features/subscriptions/components/subscription-actions";
import { formatCurrency } from "@/features/products/pricing";

export const instant = false;

export default async function SubscriptionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireStaffOrAdmin();
  const { id } = await params;

  const subscription = await getSubscriptionById(id);
  if (!subscription) {
    notFound();
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge variant="success">Active</Badge>;
      case "confirmed":
        return <Badge variant="default">Confirmed</Badge>;
      case "paused":
        return <Badge variant="warning">Paused</Badge>;
      case "closed":
        return <Badge variant="secondary">Closed</Badge>;
      case "quotation":
        return <Badge variant="outline">Quotation Sent</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <AdminShell userSession={session}>
      <div className="space-y-6">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center gap-2">
          <Link href="/subscriptions">
            <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs text-muted-foreground">
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to Subscriptions
            </Button>
          </Link>
        </div>

        <PageHeader
          heading={`Subscription ${subscription.subscriptionNumber}`}
          subheading={`Customer offer and contract for ${subscription.customer?.legalName || "Customer"}`}
        >
          <div className="flex items-center gap-2">
            {getStatusBadge(subscription.status)}
            <Badge variant="outline" className="font-mono text-xs">
              {subscription.planNameSnapshot}
            </Badge>
          </div>
        </PageHeader>

        {/* Lifecycle Action Bar */}
        <Card className="border-border/80 bg-muted/20">
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-xs font-semibold text-foreground uppercase tracking-wider">
              Lifecycle Actions & State Transitions
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <SubscriptionActions
              subscription={subscription}
              userRole={session.role}
            />
          </CardContent>
        </Card>

        {/* Subscription Key Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Customer Card */}
          <Card className="border-border/80">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold flex items-center gap-1.5 text-muted-foreground uppercase">
                <User className="h-3.5 w-3.5" />
                Customer Account
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-xs">
              <p className="font-bold text-sm text-foreground">
                {subscription.customer?.legalName || "Subscriber"}
              </p>
              <p className="text-muted-foreground font-mono text-[11px]">
                Code: {subscription.customer?.customerCode || "N/A"}
              </p>
              <p className="text-muted-foreground">{subscription.customer?.email}</p>
              {subscription.customer?.companyName && (
                <p className="text-muted-foreground">{subscription.customer.companyName}</p>
              )}
            </CardContent>
          </Card>

          {/* Plan & Pricing Snapshot */}
          <Card className="border-border/80">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold flex items-center gap-1.5 text-muted-foreground uppercase">
                <Layers className="h-3.5 w-3.5" />
                Plan & Pricing Snapshot
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-xs">
              <p className="font-bold text-sm text-foreground">
                {subscription.planNameSnapshot}
              </p>
              <div className="flex justify-between items-center text-muted-foreground pt-1">
                <span>Base Rate:</span>
                <span className="font-semibold text-foreground">
                  {formatCurrency(subscription.planPriceSnapshot, subscription.currencyCode)}
                </span>
              </div>
              <div className="flex justify-between items-center text-muted-foreground">
                <span>Quantity:</span>
                <span className="font-mono text-foreground">{subscription.planQuantity}</span>
              </div>
              <div className="flex justify-between items-center text-muted-foreground">
                <span>Payment Terms:</span>
                <span className="font-mono text-foreground">{subscription.paymentTermsDays} days</span>
              </div>
            </CardContent>
          </Card>

          {/* Schedule & Billing Dates */}
          <Card className="border-border/80">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold flex items-center gap-1.5 text-muted-foreground uppercase">
                <Calendar className="h-3.5 w-3.5" />
                Schedule & Billing Cadence
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-xs">
              <div className="flex justify-between items-center text-muted-foreground">
                <span>Start Date:</span>
                <span className="font-mono text-foreground">{subscription.startDate}</span>
              </div>
              <div className="flex justify-between items-center text-muted-foreground">
                <span>Next Billing:</span>
                <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                  {subscription.nextBillingDate || "Not Scheduled"}
                </span>
              </div>
              {subscription.quotationValidUntil && (
                <div className="flex justify-between items-center text-muted-foreground">
                  <span>Quote Expiry:</span>
                  <span className="font-mono text-primary font-medium">
                    {subscription.quotationValidUntil}
                  </span>
                </div>
              )}
              {subscription.expiryDate && (
                <div className="flex justify-between items-center text-muted-foreground">
                  <span>Expiry Date:</span>
                  <span className="font-mono text-foreground">{subscription.expiryDate}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Plan Policy Flags */}
        <Card className="border-border/80">
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-xs font-semibold flex items-center gap-1.5 text-muted-foreground uppercase">
              <Shield className="h-3.5 w-3.5" />
              Contract Policy & Lifecycle Flags
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-2.5 rounded-lg bg-muted/30 border">
                <p className="text-[11px] text-muted-foreground">Allow Pause</p>
                <Badge
                  variant={subscription.allowPause ? "success" : "secondary"}
                  className="mt-1 text-[10px]"
                >
                  {subscription.allowPause ? "Enabled" : "Disabled"}
                </Badge>
              </div>

              <div className="p-2.5 rounded-lg bg-muted/30 border">
                <p className="text-[11px] text-muted-foreground">Allow Early Close</p>
                <Badge
                  variant={subscription.allowEarlyClose ? "success" : "secondary"}
                  className="mt-1 text-[10px]"
                >
                  {subscription.allowEarlyClose ? "Enabled" : "Disabled"}
                </Badge>
              </div>

              <div className="p-2.5 rounded-lg bg-muted/30 border">
                <p className="text-[11px] text-muted-foreground">Allow Renewal</p>
                <Badge
                  variant={subscription.allowRenewal ? "success" : "secondary"}
                  className="mt-1 text-[10px]"
                >
                  {subscription.allowRenewal ? "Enabled" : "Disabled"}
                </Badge>
              </div>

              <div className="p-2.5 rounded-lg bg-muted/30 border">
                <p className="text-[11px] text-muted-foreground">Auto Close on End</p>
                <Badge
                  variant={subscription.autoCloseOnEnd ? "default" : "secondary"}
                  className="mt-1 text-[10px]"
                >
                  {subscription.autoCloseOnEnd ? "True" : "False"}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Subscription Lines Table */}
        <Card className="border-border/80">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                  <Package className="h-4 w-4 text-primary" />
                  Subscription Line Items
                </CardTitle>
                <CardDescription className="text-xs">
                  Snapshots of product items, variant options, and negotiated unit prices
                </CardDescription>
              </div>
              <Badge variant="outline" className="font-mono text-xs">
                {subscription.lines?.length || 0} Lines
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {(!subscription.lines || subscription.lines.length === 0) ? (
              <p className="text-xs text-muted-foreground text-center py-6 bg-muted/30 rounded-lg border border-dashed">
                No additional product lines attached to this subscription plan.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b text-muted-foreground font-medium text-left">
                      <th className="pb-2">Description / Snapshot</th>
                      <th className="pb-2">Variant</th>
                      <th className="pb-2 text-right">Quantity</th>
                      <th className="pb-2 text-right">Unit Price</th>
                      <th className="pb-2 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {subscription.lines.map((line) => (
                      <tr key={line.id} className="py-2">
                        <td className="py-2.5 font-medium text-foreground">
                          {line.descriptionSnapshot}
                        </td>
                        <td className="py-2.5 text-muted-foreground">
                          {line.variant ? (
                            <Badge variant="outline" className="text-[10px] font-mono">
                              {line.variant.attributeName}: {line.variant.attributeValue}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground/60">—</span>
                          )}
                        </td>
                        <td className="py-2.5 text-right font-mono">{line.quantity}</td>
                        <td className="py-2.5 text-right font-mono">
                          {formatCurrency(line.unitPrice, subscription.currencyCode)}
                        </td>
                        <td className="py-2.5 text-right font-mono font-semibold text-foreground">
                          {formatCurrency(line.lineSubtotal, subscription.currencyCode)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Subscription Event Timeline */}
        <Card className="border-border/80">
          <CardHeader>
            <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
              <History className="h-4 w-4 text-primary" />
              Subscription Event Timeline
            </CardTitle>
            <CardDescription className="text-xs">
              Complete audit record of lifecycle transitions and administrative actions
            </CardDescription>
          </CardHeader>
          <CardContent>
            {(!subscription.events || subscription.events.length === 0) ? (
              <p className="text-xs text-muted-foreground text-center py-4 bg-muted/30 rounded-lg border border-dashed">
                No historical events recorded yet.
              </p>
            ) : (
              <div className="relative pl-6 space-y-4 border-l border-border ml-2">
                {subscription.events.map((event) => (
                  <div key={event.id} className="relative">
                    <div className="absolute -left-[31px] top-0.5 h-3.5 w-3.5 rounded-full border-2 border-background bg-primary" />
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground uppercase tracking-wide">
                          {event.action.replace("_", " ")}
                        </span>
                        {event.fromStatus && (
                          <span className="text-muted-foreground text-[11px]">
                            ({event.fromStatus} → {event.toStatus})
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] font-mono text-muted-foreground">
                        {new Date(event.createdAt).toLocaleString()}
                      </span>
                    </div>
                    {event.note && (
                      <p className="text-xs text-muted-foreground mt-0.5">{event.note}</p>
                    )}
                    {event.actorName && (
                      <p className="text-[11px] text-muted-foreground/80 font-mono mt-0.5">
                        Actor: {event.actorName}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminShell>
  );
}
