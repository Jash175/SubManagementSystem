"use client";

import * as React from "react";
import Link from "next/link";
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
  Repeat,
  Clock,
  Eye,
  Search,
  User,
} from "lucide-react";
import { formatCurrency } from "@/features/products/pricing";
import type { Subscription, SubscriptionStatus } from "@/types";

interface SubscriptionListProps {
  subscriptions: Subscription[];
  userRole?: "admin" | "staff" | "customer";
}

export function SubscriptionList({
  subscriptions,
}: SubscriptionListProps) {
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<SubscriptionStatus | "all">("all");

  const filtered = subscriptions.filter((sub) => {
    const matchesStatus = statusFilter === "all" || sub.status === statusFilter;
    const q = search.toLowerCase();
    const matchesSearch =
      sub.subscriptionNumber.toLowerCase().includes(q) ||
      sub.planNameSnapshot.toLowerCase().includes(q) ||
      (sub.customer?.legalName || "").toLowerCase().includes(q) ||
      (sub.customer?.customerCode || "").toLowerCase().includes(q);

    return matchesStatus && matchesSearch;
  });

  const getStatusBadgeVariant = (
    status: SubscriptionStatus
  ): "default" | "secondary" | "destructive" | "outline" | "success" | "warning" => {
    switch (status) {
      case "active":
        return "success";
      case "confirmed":
        return "default";
      case "paused":
        return "warning";
      case "closed":
        return "secondary";
      case "quotation":
        return "outline";
      default:
        return "secondary";
    }
  };

  return (
    <div className="space-y-4">
      {/* Search and Status Filters */}
      <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search subscription #, customer, plan..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-md border border-input bg-background pl-9 pr-4 py-2 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
          {(["all", "active", "confirmed", "paused", "closed", "quotation", "draft"] as const).map(
            (status) => (
              <Button
                key={status}
                variant={statusFilter === status ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter(status)}
                className="text-xs h-8 capitalize shrink-0"
              >
                {status}
              </Button>
            )
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card className="border-border/80">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
              <Repeat className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-semibold text-foreground">No Subscriptions Found</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm">
              {search || statusFilter !== "all"
                ? "No subscriptions match the selected criteria. Try adjusting your filters."
                : "No customer subscriptions are on file. Confirm a quotation to create the first active subscription."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((sub) => (
            <Card
              key={sub.id}
              className="border-border/80 hover:border-primary/40 transition-all flex flex-col justify-between"
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="font-mono text-[10px]">
                    {sub.subscriptionNumber}
                  </Badge>
                  <Badge
                    variant={getStatusBadgeVariant(sub.status)}
                    className="text-[10px] uppercase font-semibold"
                  >
                    {sub.status}
                  </Badge>
                </div>
                <CardTitle className="text-sm font-bold pt-1 text-foreground flex items-center justify-between">
                  <span>{sub.planNameSnapshot}</span>
                  <span className="text-xs font-semibold text-primary">
                    {formatCurrency(sub.planPriceSnapshot, sub.currencyCode)}
                  </span>
                </CardTitle>
                <CardDescription className="text-xs flex items-center gap-1.5 text-muted-foreground">
                  <User className="h-3 w-3" />
                  <span>{sub.customer?.legalName || "Customer"}</span>
                  {sub.customer?.customerCode && (
                    <span className="font-mono text-[10px] text-muted-foreground">
                      ({sub.customer.customerCode})
                    </span>
                  )}
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-3 pt-0 text-xs">
                <div className="p-2.5 bg-muted/40 rounded-lg space-y-1.5">
                  <div className="flex justify-between items-center text-muted-foreground">
                    <span>Cadence:</span>
                    <span className="capitalize font-medium text-foreground">
                      {sub.plan?.billingIntervalUnit || "monthly"} (x{sub.planQuantity})
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-muted-foreground">
                    <span>Start Date:</span>
                    <span className="font-mono text-foreground">{sub.startDate}</span>
                  </div>

                  {sub.nextBillingDate && sub.status === "active" && (
                    <div className="flex justify-between items-center text-muted-foreground">
                      <span>Next Billing:</span>
                      <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {sub.nextBillingDate}
                      </span>
                    </div>
                  )}

                  {sub.status === "paused" && sub.pausedAt && (
                    <div className="flex justify-between items-center text-amber-600 dark:text-amber-400">
                      <span>Paused Since:</span>
                      <span className="font-mono text-[11px]">
                        {new Date(sub.pausedAt).toISOString().slice(0, 10)}
                      </span>
                    </div>
                  )}

                  {sub.lines && sub.lines.length > 0 && (
                    <div className="flex justify-between items-center text-muted-foreground border-t pt-1">
                      <span>Products:</span>
                      <span>{sub.lines.length} lines</span>
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t flex justify-end">
                  <Link href={`/subscriptions/${sub.id}`} className="w-full">
                    <Button variant="outline" size="sm" className="w-full text-xs h-8 gap-1.5">
                      <Eye className="h-3.5 w-3.5" />
                      View Subscription Details
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
