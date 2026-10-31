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
import { Input } from "@/components/ui/input";
import {
  Repeat,
  Search,
  ArrowRight,
} from "lucide-react";
import { getSubscriptions } from "@/features/subscriptions/services";
import type { SubscriptionStatus } from "@/types";

export const instant = false;

interface CustomerSubscriptionsPageProps {
  searchParams: Promise<{
    status?: string;
    q?: string;
  }>;
}

export default async function CustomerSubscriptionsPage({
  searchParams,
}: CustomerSubscriptionsPageProps) {
  const session = await getCurrentUserSession();
  if (!session) {
    redirect("/login?redirectTo=/portal/subscriptions");
  }

  const { status: statusParam, q } = await searchParams;
  const customerId = session.customer?.id;

  const allSubs = customerId
    ? await getSubscriptions({
        customerId,
        status: statusParam && statusParam !== "all" ? (statusParam as SubscriptionStatus) : "all",
        search: q,
      })
    : [];

  // Exclude quotations from subscriptions list (quotations have their own section)
  const subscriptions = allSubs.filter(
    (s) => s.status !== "draft" && s.status !== "quotation"
  );

  const activeCount = subscriptions.filter((s) => s.status === "active").length;
  const pausedCount = subscriptions.filter((s) => s.status === "paused").length;
  const closedCount = subscriptions.filter((s) => s.status === "closed").length;

  return (
    <CustomerShell userSession={session}>
      <div className="space-y-6">
        <PageHeader
          heading="My Subscriptions"
          subheading="View your recurring subscriptions, plan terms, and self-service lifecycle controls."
        >
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-mono text-xs">
              {subscriptions.length} Subscriptions
            </Badge>
          </div>
        </PageHeader>

        {/* Filters and Search Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div className="flex items-center gap-1 p-1 bg-muted/60 rounded-lg border text-xs">
            <Link
              href="/portal/subscriptions"
              className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                !statusParam || statusParam === "all"
                  ? "bg-background text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              All ({subscriptions.length})
            </Link>
            <Link
              href="/portal/subscriptions?status=active"
              className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                statusParam === "active"
                  ? "bg-background text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Active ({activeCount})
            </Link>
            <Link
              href="/portal/subscriptions?status=paused"
              className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                statusParam === "paused"
                  ? "bg-background text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Paused ({pausedCount})
            </Link>
            <Link
              href="/portal/subscriptions?status=closed"
              className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                statusParam === "closed"
                  ? "bg-background text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Closed ({closedCount})
            </Link>
          </div>

          <form method="GET" className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              name="q"
              placeholder="Search subscriptions..."
              defaultValue={q || ""}
              className="pl-9 h-9 text-xs"
            />
            {statusParam && (
              <input type="hidden" name="status" value={statusParam} />
            )}
          </form>
        </div>

        {/* Subscriptions Grid / List */}
        {subscriptions.length === 0 ? (
          <Card className="border-border/80">
            <CardContent className="py-12 text-center">
              <div className="h-12 w-12 rounded-full bg-muted/50 mx-auto flex items-center justify-center text-muted-foreground mb-3">
                <Repeat className="h-6 w-6 opacity-60" />
              </div>
              <h3 className="text-sm font-semibold text-foreground">
                No subscriptions found
              </h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                {q
                  ? `No subscriptions matching "${q}". Try clearing your search query.`
                  : "You do not have any active or previous subscriptions in this category."}
              </p>
              {q && (
                <div className="mt-4">
                  <Link href="/portal/subscriptions">
                    <Button variant="outline" size="sm" className="text-xs">
                      Clear Search Filter
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {subscriptions.map((sub) => (
              <Card key={sub.id} className="border-border/80 hover:border-primary/40 transition-colors">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-foreground">
                      {sub.subscriptionNumber}
                    </span>
                    <Badge
                      variant={
                        sub.status === "active"
                          ? "success"
                          : sub.status === "paused"
                          ? "warning"
                          : sub.status === "closed"
                          ? "secondary"
                          : "outline"
                      }
                      className="text-[10px] uppercase font-semibold"
                    >
                      {sub.status}
                    </Badge>
                  </div>
                  <CardTitle className="text-base pt-1">
                    {sub.planNameSnapshot}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Quantity: {sub.planQuantity} unit(s) • Payment Terms: {sub.paymentTermsDays} days
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 pt-1">
                  <div className="grid grid-cols-2 gap-2 text-xs bg-muted/30 p-2.5 rounded-lg border">
                    <div>
                      <span className="text-[11px] text-muted-foreground block">Start Date</span>
                      <span className="font-mono font-medium text-foreground">{sub.startDate}</span>
                    </div>
                    <div>
                      <span className="text-[11px] text-muted-foreground block">Next Renewal</span>
                      <span className="font-mono font-medium text-emerald-600 dark:text-emerald-400">
                        {sub.nextBillingDate || "None"}
                      </span>
                    </div>
                    {sub.expiryDate && (
                      <div className="col-span-2 pt-1 border-t">
                        <span className="text-[11px] text-muted-foreground block">Expiry Date</span>
                        <span className="font-mono font-medium text-foreground">{sub.expiryDate}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      {sub.allowPause && <span className="text-emerald-600 dark:text-emerald-400">✓ Pauseable</span>}
                      {sub.allowRenewal && <span className="text-blue-600 dark:text-blue-400">✓ Renewable</span>}
                    </div>

                    <Link href={`/portal/subscriptions/${sub.id}`}>
                      <Button size="sm" variant="outline" className="h-8 text-xs gap-1">
                        Manage <ArrowRight className="h-3.5 w-3.5" />
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </CustomerShell>
  );
}
