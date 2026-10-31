"use client";

import * as React from "react";
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
  Plus,
  Receipt,
  Edit,
  Archive,
  RefreshCw,
  Search,
  Calendar,
  Check,
  X,
} from "lucide-react";
import { formatCurrency } from "@/features/products/pricing";
import { checkPlanAvailability } from "../eligibility";
import { PlanDialog } from "./plan-dialog";
import { PlanTaxDialog } from "./plan-tax-dialog";
import { archivePlanAction } from "../actions";
import type { Plan, Tax } from "@/types";

interface PlanListProps {
  initialPlans: Plan[];
  availableTaxes: Tax[];
  isAdmin: boolean;
}

export function PlanList({ initialPlans, availableTaxes, isAdmin }: PlanListProps) {
  const [plans] = React.useState<Plan[]>(initialPlans);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [unitFilter, setUnitFilter] = React.useState<string>("all");

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingPlan, setEditingPlan] = React.useState<Plan | null>(null);

  const [taxDialogOpen, setTaxDialogOpen] = React.useState(false);
  const [taxTargetPlan, setTaxTargetPlan] = React.useState<Plan | null>(null);

  const filteredPlans = plans.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.planCode.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesUnit =
      unitFilter === "all" || p.billingIntervalUnit === unitFilter;
    return matchesSearch && matchesUnit;
  });

  const handleOpenCreate = () => {
    setEditingPlan(null);
    setDialogOpen(true);
  };

  const handleOpenEdit = (plan: Plan) => {
    setEditingPlan(plan);
    setDialogOpen(true);
  };

  const handleOpenTaxes = (plan: Plan) => {
    setTaxTargetPlan(plan);
    setTaxDialogOpen(true);
  };

  const handleToggleArchive = async (plan: Plan) => {
    if (!isAdmin) return;
    await archivePlanAction(plan.id, !plan.isActive);
  };

  return (
    <div className="space-y-6">
      {/* Top Filter and Action Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="flex flex-1 items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search plans by code or name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>

          <select
            value={unitFilter}
            onChange={(e) => setUnitFilter(e.target.value)}
            className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="all">All Frequencies</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
          </select>
        </div>

        {isAdmin ? (
          <Button onClick={handleOpenCreate} size="sm" className="gap-1.5 shrink-0">
            <Plus className="h-4 w-4" />
            Create Plan
          </Button>
        ) : (
          <Badge variant="outline" className="text-xs py-1 px-3">
            Read-Only (Staff Permission)
          </Badge>
        )}
      </div>

      {/* Plans Grid */}
      {filteredPlans.length === 0 ? (
        <Card className="border-dashed p-8 text-center bg-muted/20">
          <Layers className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-foreground">No plans found</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
            {plans.length === 0
              ? "No subscription plans configured yet. Click 'Create Plan' to establish your subscription tiers."
              : "No plans matched your filter."}
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredPlans.map((plan) => {
            const taxes = plan.taxes || [];
            const availability = checkPlanAvailability(plan);

            const cadenceText =
              plan.billingIntervalCount === 1
                ? `every ${plan.billingIntervalUnit}`
                : `every ${plan.billingIntervalCount} ${plan.billingIntervalUnit}s`;

            return (
              <Card
                key={plan.id}
                className={`border-border/80 transition-colors ${
                  !plan.isActive ? "opacity-70 bg-muted/20" : ""
                }`}
              >
                <CardHeader className="p-5 pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-muted text-foreground">
                          {plan.planCode}
                        </span>
                        <Badge
                          variant={availability.isAvailable ? "default" : "outline"}
                          className="text-[10px]"
                        >
                          {availability.isAvailable ? "Available" : "Restricted"}
                        </Badge>
                        {!plan.isActive && (
                          <Badge variant="destructive" className="text-[10px]">
                            Archived
                          </Badge>
                        )}
                      </div>
                      <CardTitle className="text-base font-semibold pt-1">
                        {plan.name}
                      </CardTitle>
                      {plan.description && (
                        <CardDescription className="text-xs line-clamp-2">
                          {plan.description}
                        </CardDescription>
                      )}
                    </div>

                    <div className="text-right shrink-0">
                      <p className="text-base font-bold text-foreground font-mono">
                        {formatCurrency(plan.price, plan.currencyCode)}
                      </p>
                      <p className="text-[11px] text-muted-foreground capitalize">
                        {cadenceText}
                      </p>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="p-5 pt-0 space-y-3">
                  {/* Cadence, Quantity, and Dates Info */}
                  <div className="grid grid-cols-2 gap-2 text-xs p-3 rounded-lg bg-muted/40 border">
                    <div>
                      <span className="text-[11px] text-muted-foreground block">
                        Minimum Quantity:
                      </span>
                      <span className="font-mono font-semibold text-foreground">
                        {plan.minimumQuantity} unit{plan.minimumQuantity > 1 ? "s" : ""}
                      </span>
                    </div>

                    <div>
                      <span className="text-[11px] text-muted-foreground block flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Availability Window:
                      </span>
                      <span className="font-mono text-[11px] text-foreground">
                        {plan.availableFrom || "Anytime"} →{" "}
                        {plan.availableUntil || "Open"}
                      </span>
                    </div>
                  </div>

                  {/* Lifecycle Policies Matrix */}
                  <div className="p-3 rounded-lg border bg-muted/20 space-y-1.5 text-xs">
                    <span className="text-[11px] font-semibold text-muted-foreground block">
                      Plan Lifecycle Policies:
                    </span>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
                      <div className="flex items-center gap-1.5">
                        {plan.allowEarlyClose ? (
                          <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <X className="h-3.5 w-3.5 text-muted-foreground/60" />
                        )}
                        <span className={plan.allowEarlyClose ? "text-foreground" : "text-muted-foreground"}>
                          Early Close Allowed
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {plan.allowPause ? (
                          <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <X className="h-3.5 w-3.5 text-muted-foreground/60" />
                        )}
                        <span className={plan.allowPause ? "text-foreground" : "text-muted-foreground"}>
                          Pause Allowed
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {plan.allowRenewal ? (
                          <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <X className="h-3.5 w-3.5 text-muted-foreground/60" />
                        )}
                        <span className={plan.allowRenewal ? "text-foreground" : "text-muted-foreground"}>
                          Renewal Allowed
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {plan.autoCloseOnEnd ? (
                          <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <X className="h-3.5 w-3.5 text-muted-foreground/60" />
                        )}
                        <span className={plan.autoCloseOnEnd ? "text-foreground" : "text-muted-foreground"}>
                          Auto-Close on Expiration
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Taxes Section */}
                  <div className="flex items-center justify-between text-xs pt-1">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <Receipt className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="text-[11px] text-muted-foreground shrink-0">
                        Base Plan Taxes:
                      </span>
                      {taxes.length === 0 ? (
                        <span className="text-[11px] text-muted-foreground italic">
                          None
                        </span>
                      ) : (
                        <div className="flex flex-wrap gap-1 truncate">
                          {taxes.map((t) => (
                            <Badge
                              key={t.id}
                              variant="outline"
                              className="text-[10px] py-0 px-1.5 font-mono"
                            >
                              {t.taxCode} ({t.ratePercent}%)
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>

                    {isAdmin && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenTaxes(plan)}
                        className="h-6 px-2 text-[11px] text-primary hover:text-primary shrink-0"
                      >
                        Manage Taxes
                      </Button>
                    )}
                  </div>

                  {/* Admin Mutation Actions */}
                  {isAdmin && (
                    <div className="flex items-center justify-end gap-2 pt-2 border-t">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenEdit(plan)}
                        className="h-7 text-xs gap-1"
                      >
                        <Edit className="h-3.5 w-3.5" />
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleArchive(plan)}
                        className="h-7 text-xs text-muted-foreground hover:text-foreground gap-1"
                      >
                        {plan.isActive ? (
                          <>
                            <Archive className="h-3.5 w-3.5" />
                            Archive
                          </>
                        ) : (
                          <>
                            <RefreshCw className="h-3.5 w-3.5" />
                            Activate
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modals */}
      <PlanDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        plan={editingPlan}
      />

      <PlanTaxDialog
        open={taxDialogOpen}
        onOpenChange={setTaxDialogOpen}
        plan={taxTargetPlan}
        availableTaxes={availableTaxes}
      />
    </div>
  );
}
