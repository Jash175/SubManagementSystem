"use client";

import * as React from "react";
import { useForm, useWatch } from "react-hook-form";
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
import { discountSchema, type DiscountInput } from "../schemas";
import { createDiscountAction, updateDiscountAction } from "../actions";
import type { Discount, Product } from "@/types";

interface DiscountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  discount?: Discount | null;
  availableProducts: Product[];
}

export function DiscountDialog({
  open,
  onOpenChange,
  discount,
  availableProducts,
}: DiscountDialogProps) {
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [isPending, startTransition] = React.useTransition();

  const isEditing = Boolean(discount);

  const {
    register,
    handleSubmit,
    setValue,
    control,
    reset,
    formState: { errors },
  } = useForm<DiscountInput>({
    resolver: zodResolver(discountSchema),
    defaultValues: {
      discountCode: discount?.discountCode || "",
      name: discount?.name || "",
      scope: discount?.scope || "subscription",
      discountType: discount?.discountType || "percentage",
      value: discount?.value ?? 10,
      currencyCode: discount?.currencyCode || "INR",
      minimumPurchaseAmount: discount?.minimumPurchaseAmount ?? 0,
      minimumQuantity: discount?.minimumQuantity ?? 0,
      startsOn: discount?.startsOn || new Date().toISOString().slice(0, 10),
      endsOn: discount?.endsOn || "2027-12-31",
      maxUses: discount?.maxUses || null,
      priority: discount?.priority ?? 100,
      isActive: discount?.isActive ?? true,
      productIds: discount?.productIds || [],
    },
  });

  const watchedScope = useWatch({ control, name: "scope", defaultValue: "subscription" });
  const watchedType = useWatch({ control, name: "discountType", defaultValue: "percentage" });
  const watchedProductIds = useWatch({ control, name: "productIds", defaultValue: [] });

  React.useEffect(() => {
    if (open) {
      reset({
        discountCode: discount?.discountCode || "",
        name: discount?.name || "",
        scope: discount?.scope || "subscription",
        discountType: discount?.discountType || "percentage",
        value: discount?.value ?? 10,
        currencyCode: discount?.currencyCode || "INR",
        minimumPurchaseAmount: discount?.minimumPurchaseAmount ?? 0,
        minimumQuantity: discount?.minimumQuantity ?? 0,
        startsOn: discount?.startsOn || "2026-01-01",
        endsOn: discount?.endsOn || "2027-12-31",
        maxUses: discount?.maxUses || null,
        priority: discount?.priority ?? 100,
        isActive: discount?.isActive ?? true,
        productIds: discount?.productIds || [],
      });
    }
  }, [open, discount, reset]);

  const toggleProductId = (id: string) => {
    const current = watchedProductIds || [];
    const updated = current.includes(id)
      ? current.filter((item) => item !== id)
      : [...current, id];
    setValue("productIds", updated, { shouldValidate: true });
  };

  const onSubmit = (data: DiscountInput) => {
    setServerError(null);
    startTransition(async () => {
      const res = isEditing && discount
        ? await updateDiscountAction(discount.id, data)
        : await createDiscountAction(data);

      if (!res.success) {
        setServerError(res.error || "Failed to save discount rule.");
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
            {isEditing ? `Edit Discount: ${discount?.name}` : "Create Discount Rule"}
          </DialogTitle>
          <DialogDescription>
            Configure fixed or percentage promotions with usage caps, minimum criteria, and scope.
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
              <Label htmlFor="discountCode" className="text-xs font-semibold">
                Discount Code <span className="text-destructive">*</span>
              </Label>
              <Input
                id="discountCode"
                placeholder="e.g. LAUNCH20"
                disabled={isPending || isEditing}
                className="font-mono text-xs uppercase"
                {...register("discountCode")}
              />
              {errors.discountCode && (
                <p className="text-[11px] text-destructive">
                  {errors.discountCode.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-xs font-semibold">
                Campaign Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                placeholder="e.g. Launch Celebration 20% Off"
                disabled={isPending}
                className="text-xs"
                {...register("name")}
              />
              {errors.name && (
                <p className="text-[11px] text-destructive">{errors.name.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="scope" className="text-xs font-semibold">
                Rule Scope <span className="text-destructive">*</span>
              </Label>
              <select
                id="scope"
                disabled={isPending}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                {...register("scope")}
              >
                <option value="subscription">Whole Subscription</option>
                <option value="product">Specific Product(s)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="discountType" className="text-xs font-semibold">
                Discount Type <span className="text-destructive">*</span>
              </Label>
              <select
                id="discountType"
                disabled={isPending}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                {...register("discountType")}
              >
                <option value="percentage">Percentage (%)</option>
                <option value="fixed">Fixed Amount</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="value" className="text-xs font-semibold">
                Value {watchedType === "percentage" ? "(%)" : "(Amount)"} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="value"
                type="number"
                step="0.01"
                min="0.01"
                max={watchedType === "percentage" ? 100 : undefined}
                placeholder={watchedType === "percentage" ? "20" : "500"}
                disabled={isPending}
                className="text-xs font-mono"
                {...register("value")}
              />
              {errors.value && (
                <p className="text-[11px] text-destructive">
                  {errors.value.message}
                </p>
              )}
            </div>
          </div>

          {/* Product Scope Target Selector */}
          {watchedScope === "product" && (
            <div className="p-3 rounded-lg border bg-muted/30 space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-foreground">
                  Eligible Target Products <span className="text-destructive">*</span>
                </Label>
                <span className="text-[11px] text-muted-foreground">
                  {(watchedProductIds || []).length} selected
                </span>
              </div>
              {errors.productIds && (
                <p className="text-[11px] text-destructive">
                  {errors.productIds.message}
                </p>
              )}
              <div className="max-h-36 overflow-y-auto space-y-1.5 pt-1">
                {availableProducts.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">
                    No catalogue products available.
                  </p>
                ) : (
                  availableProducts.map((prod) => {
                    const isChecked = (watchedProductIds || []).includes(prod.id);
                    return (
                      <div
                        key={prod.id}
                        onClick={() => toggleProductId(prod.id)}
                        className={`flex items-center justify-between p-2 rounded border text-xs cursor-pointer ${
                          isChecked
                            ? "bg-primary/10 border-primary/40 font-semibold"
                            : "bg-background border-border hover:bg-muted/40"
                        }`}
                      >
                        <span className="truncate">{prod.name}</span>
                        <span className="font-mono text-[10px] text-muted-foreground ml-2">
                          {prod.productCode}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* Minimum Requirements & Usage Cap */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 rounded-lg bg-muted/40 border">
            <div className="space-y-1.5">
              <Label htmlFor="minimumPurchaseAmount" className="text-xs font-semibold">
                Min Spend (Amount)
              </Label>
              <Input
                id="minimumPurchaseAmount"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                disabled={isPending}
                className="text-xs font-mono"
                {...register("minimumPurchaseAmount")}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="minimumQuantity" className="text-xs font-semibold">
                Min Quantity
              </Label>
              <Input
                id="minimumQuantity"
                type="number"
                step="1"
                min="0"
                placeholder="0"
                disabled={isPending}
                className="text-xs font-mono"
                {...register("minimumQuantity")}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="maxUses" className="text-xs font-semibold">
                Max Uses (Cap)
              </Label>
              <Input
                id="maxUses"
                type="number"
                step="1"
                min="1"
                placeholder="Unlimited"
                disabled={isPending}
                className="text-xs font-mono"
                {...register("maxUses")}
              />
            </div>
          </div>

          {/* Validity Window */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="startsOn" className="text-xs font-semibold">
                Starts On <span className="text-destructive">*</span>
              </Label>
              <Input
                id="startsOn"
                type="date"
                disabled={isPending}
                className="text-xs font-mono"
                {...register("startsOn")}
              />
              {errors.startsOn && (
                <p className="text-[11px] text-destructive">
                  {errors.startsOn.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="endsOn" className="text-xs font-semibold">
                Ends On <span className="text-destructive">*</span>
              </Label>
              <Input
                id="endsOn"
                type="date"
                disabled={isPending}
                className="text-xs font-mono"
                {...register("endsOn")}
              />
              {errors.endsOn && (
                <p className="text-[11px] text-destructive">
                  {errors.endsOn.message}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="discountActive"
              disabled={isPending}
              className="h-4 w-4 rounded border-input text-primary focus:ring-ring"
              {...register("isActive")}
            />
            <Label htmlFor="discountActive" className="text-xs cursor-pointer">
              Discount rule is active
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
              {isEditing ? "Save Changes" : "Create Discount Rule"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
