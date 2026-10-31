"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Loader2 } from "lucide-react";
import { planSchema, type PlanInput } from "../schemas";
import { createPlanAction, updatePlanAction } from "../actions";
import type { Plan } from "@/types";

interface PlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan?: Plan | null;
}

export function PlanDialog({ open, onOpenChange, plan }: PlanDialogProps) {
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [isPending, startTransition] = React.useTransition();

  const isEditing = Boolean(plan);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PlanInput>({
    resolver: zodResolver(planSchema),
    defaultValues: {
      planCode: plan?.planCode || "",
      name: plan?.name || "",
      description: plan?.description || "",
      price: plan?.price ?? 0,
      currencyCode: plan?.currencyCode || "INR",
      billingIntervalUnit: plan?.billingIntervalUnit || "monthly",
      billingIntervalCount: plan?.billingIntervalCount ?? 1,
      minimumQuantity: plan?.minimumQuantity ?? 1,
      availableFrom: plan?.availableFrom || "",
      availableUntil: plan?.availableUntil || "",
      autoCloseOnEnd: plan?.autoCloseOnEnd ?? false,
      allowEarlyClose: plan?.allowEarlyClose ?? true,
      allowPause: plan?.allowPause ?? false,
      allowRenewal: plan?.allowRenewal ?? true,
      isActive: plan?.isActive ?? true,
    },
  });

  React.useEffect(() => {
    if (open) {
      reset({
        planCode: plan?.planCode || "",
        name: plan?.name || "",
        description: plan?.description || "",
        price: plan?.price ?? 0,
        currencyCode: plan?.currencyCode || "INR",
        billingIntervalUnit: plan?.billingIntervalUnit || "monthly",
        billingIntervalCount: plan?.billingIntervalCount ?? 1,
        minimumQuantity: plan?.minimumQuantity ?? 1,
        availableFrom: plan?.availableFrom || "",
        availableUntil: plan?.availableUntil || "",
        autoCloseOnEnd: plan?.autoCloseOnEnd ?? false,
        allowEarlyClose: plan?.allowEarlyClose ?? true,
        allowPause: plan?.allowPause ?? false,
        allowRenewal: plan?.allowRenewal ?? true,
        isActive: plan?.isActive ?? true,
      });
    }
  }, [open, plan, reset]);

  const onSubmit = (data: PlanInput) => {
    setServerError(null);
    startTransition(async () => {
      const res = isEditing && plan
        ? await updatePlanAction(plan.id, data)
        : await createPlanAction(data);

      if (!res.success) {
        setServerError(res.error || "Failed to save plan.");
      } else {
        onOpenChange(false);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onClose={() => onOpenChange(false)} className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? `Edit Plan: ${plan?.name}` : "Create Subscription Plan"}
          </DialogTitle>
          <DialogDescription>
            Configure recurring billing cadence, minimum quantities, date availability, and lifecycle policies.
          </DialogDescription>
        </DialogHeader>

        {serverError && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">{serverError}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="planCode" className="text-xs font-semibold">
                Plan Code <span className="text-destructive">*</span>
              </Label>
              <Input
                id="planCode"
                placeholder="e.g. MONTHLY-TEAM"
                disabled={isPending || isEditing}
                className="font-mono text-xs uppercase"
                {...register("planCode")}
              />
              {errors.planCode && (
                <p className="text-[11px] text-destructive">
                  {errors.planCode.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="planName" className="text-xs font-semibold">
                Plan Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="planName"
                placeholder="e.g. Monthly Team Subscription"
                disabled={isPending}
                className="text-xs"
                {...register("name")}
              />
              {errors.name && (
                <p className="text-[11px] text-destructive">{errors.name.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description" className="text-xs font-semibold">
              Description
            </Label>
            <Input
              id="description"
              placeholder="e.g. High-throughput workspace with priority SLA"
              disabled={isPending}
              className="text-xs"
              {...register("description")}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="price" className="text-xs font-semibold">
                Recurring Price <span className="text-destructive">*</span>
              </Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                min="0"
                placeholder="2500.00"
                disabled={isPending}
                className="text-xs font-mono"
                {...register("price")}
              />
              {errors.price && (
                <p className="text-[11px] text-destructive">
                  {errors.price.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="currencyCode" className="text-xs font-semibold">
                Currency
              </Label>
              <Input
                id="currencyCode"
                placeholder="INR"
                maxLength={3}
                disabled={isPending}
                className="font-mono text-xs uppercase"
                {...register("currencyCode")}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="minimumQuantity" className="text-xs font-semibold">
                Min Quantity <span className="text-destructive">*</span>
              </Label>
              <Input
                id="minimumQuantity"
                type="number"
                step="0.001"
                min="0.001"
                placeholder="1"
                disabled={isPending}
                className="text-xs font-mono"
                {...register("minimumQuantity")}
              />
              {errors.minimumQuantity && (
                <p className="text-[11px] text-destructive">
                  {errors.minimumQuantity.message}
                </p>
              )}
            </div>
          </div>

          {/* Billing Cadence: Unit + Count */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-lg bg-muted/40 border">
            <div className="space-y-1.5">
              <Label htmlFor="billingIntervalUnit" className="text-xs font-semibold">
                Billing Recurrence Unit <span className="text-destructive">*</span>
              </Label>
              <select
                id="billingIntervalUnit"
                disabled={isPending}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                {...register("billingIntervalUnit")}
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="billingIntervalCount" className="text-xs font-semibold">
                Interval Count <span className="text-destructive">*</span>
              </Label>
              <Input
                id="billingIntervalCount"
                type="number"
                min="1"
                step="1"
                placeholder="1"
                disabled={isPending}
                className="text-xs font-mono"
                {...register("billingIntervalCount")}
              />
              {errors.billingIntervalCount && (
                <p className="text-[11px] text-destructive">
                  {errors.billingIntervalCount.message}
                </p>
              )}
            </div>
          </div>

          {/* Availability Date Window */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="availableFrom" className="text-xs font-semibold">
                Available From (Inclusive)
              </Label>
              <Input
                id="availableFrom"
                type="date"
                disabled={isPending}
                className="text-xs font-mono"
                {...register("availableFrom")}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="availableUntil" className="text-xs font-semibold">
                Available Until (Inclusive)
              </Label>
              <Input
                id="availableUntil"
                type="date"
                disabled={isPending}
                className="text-xs font-mono"
                {...register("availableUntil")}
              />
              {errors.availableUntil && (
                <p className="text-[11px] text-destructive">
                  {errors.availableUntil.message}
                </p>
              )}
            </div>
          </div>

          {/* Lifecycle Flags Section */}
          <div className="space-y-2 p-3 rounded-lg border bg-muted/20">
            <p className="text-xs font-semibold text-foreground">
              Plan Lifecycle Policies &amp; Permissions
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  disabled={isPending}
                  className="h-4 w-4 rounded border-input text-primary"
                  {...register("allowEarlyClose")}
                />
                <span>Allow early closure</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  disabled={isPending}
                  className="h-4 w-4 rounded border-input text-primary"
                  {...register("allowPause")}
                />
                <span>Allow subscription pause</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  disabled={isPending}
                  className="h-4 w-4 rounded border-input text-primary"
                  {...register("allowRenewal")}
                />
                <span>Allow renewal</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  disabled={isPending}
                  className="h-4 w-4 rounded border-input text-primary"
                  {...register("autoCloseOnEnd")}
                />
                <span>Auto-close on expiration</span>
              </label>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="planActive"
              disabled={isPending}
              className="h-4 w-4 rounded border-input text-primary focus:ring-ring"
              {...register("isActive")}
            />
            <Label htmlFor="planActive" className="text-xs cursor-pointer">
              Plan is active and available in quotations
            </Label>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isPending}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
              {isEditing ? "Save Changes" : "Create Plan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
