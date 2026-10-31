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
import { productSchema, type ProductInput } from "../schemas";
import { createProductAction, updateProductAction } from "../actions";
import type { Product } from "@/types";

interface ProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: Product | null;
}

export function ProductDialog({
  open,
  onOpenChange,
  product,
}: ProductDialogProps) {
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [isPending, startTransition] = React.useTransition();

  const isEditing = Boolean(product);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ProductInput>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      productCode: product?.productCode || "",
      name: product?.name || "",
      productType: product?.productType || "software",
      salesPrice: product?.salesPrice ?? 0,
      costPrice: product?.costPrice ?? 0,
      currencyCode: product?.currencyCode || "INR",
      notes: product?.notes || "",
      isActive: product?.isActive ?? true,
    },
  });

  React.useEffect(() => {
    if (open) {
      reset({
        productCode: product?.productCode || "",
        name: product?.name || "",
        productType: product?.productType || "software",
        salesPrice: product?.salesPrice ?? 0,
        costPrice: product?.costPrice ?? 0,
        currencyCode: product?.currencyCode || "INR",
        notes: product?.notes || "",
        isActive: product?.isActive ?? true,
      });
    }
  }, [open, product, reset]);

  const onSubmit = (data: ProductInput) => {
    setServerError(null);
    startTransition(async () => {
      const res = isEditing && product
        ? await updateProductAction(product.id, data)
        : await createProductAction(data);

      if (!res.success) {
        setServerError(res.error || "Failed to save product.");
      } else {
        onOpenChange(false);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onClose={() => onOpenChange(false)} className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? `Edit Product: ${product?.name}` : "Create New Product"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update catalogue pricing, classification, and notes."
              : "Add a sellable software, service, or add-on product to the Brightloop catalogue."}
          </DialogDescription>
        </DialogHeader>

        {serverError && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">{serverError}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="productCode" className="text-xs font-semibold">
                Product Code <span className="text-destructive">*</span>
              </Label>
              <Input
                id="productCode"
                placeholder="e.g. PRD-WORKSPACE"
                disabled={isPending || isEditing}
                className="font-mono text-xs uppercase"
                {...register("productCode")}
              />
              {errors.productCode && (
                <p className="text-[11px] text-destructive">
                  {errors.productCode.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="productType" className="text-xs font-semibold">
                Product Type <span className="text-destructive">*</span>
              </Label>
              <select
                id="productType"
                disabled={isPending}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                {...register("productType")}
              >
                <option value="software">Software</option>
                <option value="service">Service</option>
                <option value="addon">Addon</option>
                <option value="physical">Physical</option>
                <option value="other">Other</option>
              </select>
              {errors.productType && (
                <p className="text-[11px] text-destructive">
                  {errors.productType.message}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="name" className="text-xs font-semibold">
              Product Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              placeholder="e.g. Team Workspace Platform"
              disabled={isPending}
              className="text-xs"
              {...register("name")}
            />
            {errors.name && (
              <p className="text-[11px] text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="salesPrice" className="text-xs font-semibold">
                Sales Price <span className="text-destructive">*</span>
              </Label>
              <Input
                id="salesPrice"
                type="number"
                step="0.01"
                min="0"
                placeholder="2000.00"
                disabled={isPending}
                className="text-xs"
                {...register("salesPrice")}
              />
              {errors.salesPrice && (
                <p className="text-[11px] text-destructive">
                  {errors.salesPrice.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="costPrice" className="text-xs font-semibold">
                Cost Price
              </Label>
              <Input
                id="costPrice"
                type="number"
                step="0.01"
                min="0"
                placeholder="700.00"
                disabled={isPending}
                className="text-xs"
                {...register("costPrice")}
              />
              {errors.costPrice && (
                <p className="text-[11px] text-destructive">
                  {errors.costPrice.message}
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
              {errors.currencyCode && (
                <p className="text-[11px] text-destructive">
                  {errors.currencyCode.message}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes" className="text-xs font-semibold">
              Catalogue Notes
            </Label>
            <textarea
              id="notes"
              rows={2}
              placeholder="Internal product notes, packaging, or license terms..."
              disabled={isPending}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              {...register("notes")}
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="isActive"
              disabled={isPending}
              className="h-4 w-4 rounded border-input text-primary focus:ring-ring"
              {...register("isActive")}
            />
            <Label htmlFor="isActive" className="text-xs cursor-pointer">
              Product is active and available in quotations
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
              {isEditing ? "Save Changes" : "Create Product"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
