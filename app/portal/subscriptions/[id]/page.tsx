import * as React from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireAuth } from "@/features/auth/guards";
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
  ArrowLeft,
  Calendar,
  Clock,
  Repeat,
  Package,
  History,
} from "lucide-react";
import { getSubscriptionById } from "@/features/subscriptions/services";
import { SubscriptionActions } from "@/features/subscriptions/components/subscription-actions";
import { formatCurrency } from "@/features/products/pricing";

export const instant = false;

export default async function CustomerSubscriptionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireAuth("/login?redirectTo=/portal");
  const { id } = await params;

  // Strict ownership check: if customer role, verify session.customer exists and pass customerId to query
  let customerId: string | undefined = undefined;
  if (session.role === "customer") {
    if (!session.customer) {
      redirect("/portal");
    }
    customerId = session.customer.id;
  }

  const subscription = await getSubscriptionById(id, customerId);

  // If subscription doesn't exist or belongs to another customer, deny access
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
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <CustomerShell userSession={session}>
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Link href="/portal/subscriptions">
            <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs text-muted-foreground">
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to Subscriptions
            </Button>
          </Link>
        </div>

        <PageHeader
          heading={`My Subscription ${subscription.subscriptionNumber}`}
          subheading={`Plan details, renewal schedule, and self-service controls for ${subscription.planNameSnapshot}`}
        >
          <div className="flex items-center gap-2">
            {getStatusBadge(subscription.status)}
            <Badge variant="outline" className="font-mono text-xs">
              {subscription.planNameSnapshot}
            </Badge>
          </div>
        </PageHeader>

        {/* Self-Service Action Bar */}
        <Card className="border-border/80 bg-muted/20">
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-xs font-semibold text-foreground uppercase tracking-wider">
              Self-Service Controls
            </CardTitle>
            <CardDescription className="text-xs">
              Actions permitted under your current subscription agreement policy
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <SubscriptionActions
              subscription={subscription}
              userRole={session.role}
            />
          </CardContent>
        </Card>

        {/* Overview Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="border-border/80">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold flex items-center gap-1.5 text-muted-foreground uppercase">
                <Repeat className="h-3.5 w-3.5" />
                Subscription Plan Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5 text-xs">
              <div className="flex justify-between items-center text-muted-foreground">
                <span>Plan:</span>
                <span className="font-semibold text-foreground">{subscription.planNameSnapshot}</span>
              </div>
              <div className="flex justify-between items-center text-muted-foreground">
                <span>Billing Rate:</span>
                <span className="font-mono text-foreground font-semibold">
                  {formatCurrency(subscription.planPriceSnapshot, subscription.currencyCode)} / {subscription.plan?.billingIntervalUnit || "cycle"}
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

          <Card className="border-border/80">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold flex items-center gap-1.5 text-muted-foreground uppercase">
                <Calendar className="h-3.5 w-3.5" />
                Renewal & Billing Schedule
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5 text-xs">
              <div className="flex justify-between items-center text-muted-foreground">
                <span>Start Date:</span>
                <span className="font-mono text-foreground">{subscription.startDate}</span>
              </div>
              {subscription.nextBillingDate && subscription.status === "active" && (
                <div className="flex justify-between items-center text-emerald-600 dark:text-emerald-400 font-semibold">
                  <span>Next Renewal Date:</span>
                  <span className="font-mono flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {subscription.nextBillingDate}
                  </span>
                </div>
              )}
              {subscription.expiryDate && (
                <div className="flex justify-between items-center text-muted-foreground">
                  <span>Contract Expiry:</span>
                  <span className="font-mono text-foreground">{subscription.expiryDate}</span>
                </div>
              )}
              {subscription.status === "paused" && subscription.pausedAt && (
                <div className="flex justify-between items-center text-amber-600 dark:text-amber-400">
                  <span>Paused On:</span>
                  <span className="font-mono">{new Date(subscription.pausedAt).toISOString().slice(0, 10)}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Product Lines */}
        {subscription.lines && subscription.lines.length > 0 && (
          <Card className="border-border/80">
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-xs font-semibold flex items-center gap-1.5 text-muted-foreground uppercase">
                <Package className="h-3.5 w-3.5" />
                Bundled Products & Services
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b text-muted-foreground font-medium text-left">
                      <th className="pb-2">Description</th>
                      <th className="pb-2">Variant</th>
                      <th className="pb-2 text-right">Quantity</th>
                      <th className="pb-2 text-right">Price</th>
                      <th className="pb-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {subscription.lines.map((line) => (
                      <tr key={line.id} className="py-2">
                        <td className="py-2 font-medium text-foreground">{line.descriptionSnapshot}</td>
                        <td className="py-2 text-muted-foreground">
                          {line.variant ? (
                            <Badge variant="outline" className="text-[10px] font-mono">
                              {line.variant.attributeName}: {line.variant.attributeValue}
                            </Badge>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="py-2 text-right font-mono">{line.quantity}</td>
                        <td className="py-2 text-right font-mono">
                          {formatCurrency(line.unitPrice, subscription.currencyCode)}
                        </td>
                        <td className="py-2 text-right font-mono font-semibold text-foreground">
                          {formatCurrency(line.lineSubtotal, subscription.currencyCode)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Lifecycle Events */}
        {subscription.events && subscription.events.length > 0 && (
          <Card className="border-border/80">
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-xs font-semibold flex items-center gap-1.5 text-muted-foreground uppercase">
                <History className="h-3.5 w-3.5" />
                Account Activity & Lifecycle History
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="relative pl-6 space-y-3 border-l border-border ml-2 text-xs">
                {subscription.events.map((event) => (
                  <div key={event.id} className="relative">
                    <div className="absolute -left-[31px] top-1 h-3 w-3 rounded-full border-2 border-background bg-primary" />
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground uppercase tracking-wide text-[11px]">
                        {event.action.replace("_", " ")}
                      </span>
                      <span className="text-[10px] font-mono text-muted-foreground">
                        {new Date(event.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    {event.note && (
                      <p className="text-muted-foreground text-[11px] mt-0.5">{event.note}</p>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </CustomerShell>
  );
}
