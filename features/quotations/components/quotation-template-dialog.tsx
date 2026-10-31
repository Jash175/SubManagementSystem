"use client";

import * as React from "react";
import { useForm, useFieldArray } from "react-hook-form";
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
import { AlertCircle, Loader2, Plus, Trash2 } from "lucide-react";
import { quotationTemplateSchema, type QuotationTemplateInput } from "../schemas";
import { createQuotationTemplateAction } from "../actions";
import type { Plan, Product } from "@/types";

interface QuotationTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  availablePlans: Plan[];
  availableProducts: Product[];
}

function QuotationTemplateForm({
  availablePlans,
  availableProducts,
  onClose,
}: {
  availablePlans: Plan[];
  availableProducts: Product[];
  onClose: () => void;
}) {
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [isPending, startTransition] = React.useTransition();

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<QuotationTemplateInput>({
    resolver: zodResolver(quotationTemplateSchema),
    defaultValues: {
      name: "",
      planId: availablePlans[0]?.id || "",
      validityDays: 30,
      isActive: true,
      lines: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "lines",
  });

  const onSubmit = (data: QuotationTemplateInput) => {
    setServerError(null);
    startTransition(async () => {
      const res = await createQuotationTemplateAction(data);
      if (!res.success) {
        setServerError(res.error || "Failed to create quotation template.");
      } else {
        onClose();
      }
    });
  };

  return (
    <DialogContent onClose={onClose} className="max-w-xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Create Quotation Template</DialogTitle>
        <DialogDescription>
          Predefine standard plans and product bundles with default validity durations.
        </DialogDescription>
      </DialogHeader>

      {serverError && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-xs">{serverError}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <Label htmlFor="name" className="text-xs font-semibold">
            Template Name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="name"
            placeholder="e.g. Standard Workspace Onboarding"
            {...register("name")}
            className="mt-1"
          />
          {errors.name && (
            <p className="text-[11px] text-destructive mt-1">{errors.name.message}</p>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="planId" className="text-xs font-semibold">
              Default Plan <span className="text-destructive">*</span>
            </Label>
            <select
              id="planId"
              {...register("planId")}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {availablePlans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.planCode}) — {p.currencyCode} {p.price}/{p.billingIntervalUnit}
                </option>
              ))}
            </select>
            {errors.planId && (
              <p className="text-[11px] text-destructive mt-1">{errors.planId.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="validityDays" className="text-xs font-semibold">
              Validity Duration (Days) <span className="text-destructive">*</span>
            </Label>
            <Input
              id="validityDays"
              type="number"
              min="1"
              {...register("validityDays")}
              className="mt-1"
            />
            {errors.validityDays && (
              <p className="text-[11px] text-destructive mt-1">{errors.validityDays.message}</p>
            )}
          </div>
        </div>

        {/* Template Line Items */}
        <div className="pt-2 border-t">
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-xs font-semibold text-foreground">Predefined Product Lines</p>
              <p className="text-[11px] text-muted-foreground">Products bundled into this template</p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                const firstProduct = availableProducts[0];
                append({
                  productId: firstProduct?.id || "",
                  variantId: firstProduct?.variants?.[0]?.id || null,
                  quantity: 1,
                  description: "",
                  unitPriceOverride: null,
                });
              }}
              className="h-7 text-xs"
            >
              <Plus className="mr-1 h-3 w-3" />
              Add Product
            </Button>
          </div>

          {fields.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4 bg-muted/30 rounded-lg border border-dashed">
              No product lines added yet. Click &quot;Add Product&quot; to bundle products into this template.
            </p>
          ) : (
            <div className="space-y-3">
              {fields.map((field, index) => (
                <div
                  key={field.id}
                  className="p-3 bg-muted/30 border rounded-lg space-y-2 relative group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-mono text-muted-foreground">Line #{index + 1}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => remove(index)}
                      className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <Label className="text-[11px]">Product</Label>
                      <select
                        {...register(`lines.${index}.productId` as const)}
                        className="mt-0.5 w-full rounded border border-input bg-background px-2 py-1 text-xs"
                      >
                        {availableProducts.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({p.productCode})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <Label className="text-[11px]">Quantity</Label>
                      <Input
                        type="number"
                        min="1"
                        step="1"
                        {...register(`lines.${index}.quantity` as const)}
                        className="mt-0.5 h-7 text-xs"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter className="pt-4">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isPending}
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={isPending}>
            {isPending && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
            Create Template
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

export function QuotationTemplateDialog({
  open,
  onOpenChange,
  availablePlans,
  availableProducts,
}: QuotationTemplateDialogProps) {
  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <QuotationTemplateForm
        availablePlans={availablePlans}
        availableProducts={availableProducts}
        onClose={() => onOpenChange(false)}
      />
    </Dialog>
  );
}
