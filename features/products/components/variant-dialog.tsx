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
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Loader2, Sparkles, Calculator } from "lucide-react";
import { productVariantSchema, type ProductVariantInput } from "../schemas";
import { createVariantAction } from "../actions";
import { calculateProductPrice, formatCurrency } from "../pricing";
import type { Product } from "@/types";

interface VariantDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product | null;
}

export function VariantDialog({
  open,
  onOpenChange,
  product,
}: VariantDialogProps) {
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [isPending, startTransition] = React.useTransition();

  const {
    register,
    handleSubmit,
    setValue,
    control,
    reset,
    formState: { errors },
  } = useForm<ProductVariantInput>({
    resolver: zodResolver(productVariantSchema),
    defaultValues: {
      attributeName: "",
      attributeValue: "",
      priceDelta: 0,
      isActive: true,
    },
  });

  const watchedDelta = useWatch({ control, name: "priceDelta", defaultValue: 0 });

  React.useEffect(() => {
    if (open) {
      reset({
        attributeName: "",
        attributeValue: "",
        priceDelta: 0,
        isActive: true,
      });
    }
  }, [open, reset]);

  if (!product) return null;

  // Live calculation of effective price
  let computedEffectivePrice = product.salesPrice;
  try {
    computedEffectivePrice = calculateProductPrice(
      product.salesPrice,
      Number(watchedDelta) || 0
    );
  } catch {
    computedEffectivePrice = product.salesPrice;
  }

  const setOdooPreset = () => {
    setValue("attributeName", "Brand");
    setValue("attributeValue", "Odoo");
    setValue("priceDelta", 560);
  };

  const onSubmit = (data: ProductVariantInput) => {
    setServerError(null);
    startTransition(async () => {
      const res = await createVariantAction(product.id, data);
      if (!res.success) {
        setServerError(res.error || "Failed to add variant.");
      } else {
        onOpenChange(false);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onClose={() => onOpenChange(false)} className="max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Add Product Variant</DialogTitle>
            <Badge variant="outline" className="font-mono text-[10px]">
              {product.productCode}
            </Badge>
          </div>
          <DialogDescription>
            Configure attribute variants and price adjustments for{" "}
            <span className="font-semibold text-foreground">{product.name}</span>.
          </DialogDescription>
        </DialogHeader>

        {/* Required Example Preset Banner */}
        <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 flex items-center justify-between gap-3">
          <div className="text-xs">
            <p className="font-semibold text-foreground flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Required Demo Preset: Odoo Brand (+560)
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Pre-populates Brand = Odoo with price delta +560.
            </p>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={setOdooPreset}
            className="text-xs h-7 shrink-0"
          >
            Apply Preset
          </Button>
        </div>

        {serverError && (
          <Alert variant="destructive" className="my-2">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">{serverError}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="attributeName" className="text-xs font-semibold">
                Attribute Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="attributeName"
                placeholder="e.g. Brand, Tier, Cloud"
                disabled={isPending}
                className="text-xs"
                {...register("attributeName")}
              />
              {errors.attributeName && (
                <p className="text-[11px] text-destructive">
                  {errors.attributeName.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="attributeValue" className="text-xs font-semibold">
                Attribute Value <span className="text-destructive">*</span>
              </Label>
              <Input
                id="attributeValue"
                placeholder="e.g. Odoo, Pro, AWS"
                disabled={isPending}
                className="text-xs"
                {...register("attributeValue")}
              />
              {errors.attributeValue && (
                <p className="text-[11px] text-destructive">
                  {errors.attributeValue.message}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="priceDelta" className="text-xs font-semibold">
              Price Delta (+/- adjustment) <span className="text-destructive">*</span>
            </Label>
            <Input
              id="priceDelta"
              type="number"
              step="0.01"
              placeholder="560.00"
              disabled={isPending}
              className="text-xs font-mono"
              {...register("priceDelta")}
            />
            {errors.priceDelta && (
              <p className="text-[11px] text-destructive">
                {errors.priceDelta.message}
              </p>
            )}
            <p className="text-[11px] text-muted-foreground">
              Positive delta increases the price; negative delta discounts it.
            </p>
          </div>

          {/* Real-time Price Calculation Summary Card */}
          <div className="p-3 rounded-lg bg-muted/50 border space-y-1.5">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Calculator className="h-3.5 w-3.5" />
                Base Sales Price:
              </span>
              <span className="font-mono text-foreground">
                {formatCurrency(product.salesPrice, product.currencyCode)}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Variant Delta:</span>
              <span className="font-mono text-foreground">
                {Number(watchedDelta) >= 0 ? "+" : ""}
                {formatCurrency(Number(watchedDelta) || 0, product.currencyCode)}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs font-semibold border-t pt-1.5 text-foreground">
              <span>Effective Persisted Price:</span>
              <span className="font-mono text-sm text-primary">
                {formatCurrency(computedEffectivePrice, product.currencyCode)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="variantActive"
              disabled={isPending}
              className="h-4 w-4 rounded border-input text-primary focus:ring-ring"
              {...register("isActive")}
            />
            <Label htmlFor="variantActive" className="text-xs cursor-pointer">
              Variant is active and selectable in quotations
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
              Save Variant
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
