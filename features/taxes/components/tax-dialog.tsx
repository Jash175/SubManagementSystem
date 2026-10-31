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
import { taxSchema, type TaxInput } from "../schemas";
import { createTaxAction, updateTaxAction } from "../actions";
import type { Tax } from "@/types";

interface TaxDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tax?: Tax | null;
}

export function TaxDialog({ open, onOpenChange, tax }: TaxDialogProps) {
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [isPending, startTransition] = React.useTransition();

  const isEditing = Boolean(tax);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<TaxInput>({
    resolver: zodResolver(taxSchema),
    defaultValues: {
      taxCode: tax?.taxCode || "",
      name: tax?.name || "",
      ratePercent: tax?.ratePercent ?? 0,
      isActive: tax?.isActive ?? true,
    },
  });

  React.useEffect(() => {
    if (open) {
      reset({
        taxCode: tax?.taxCode || "",
        name: tax?.name || "",
        ratePercent: tax?.ratePercent ?? 0,
        isActive: tax?.isActive ?? true,
      });
    }
  }, [open, tax, reset]);

  const onSubmit = (data: TaxInput) => {
    setServerError(null);
    startTransition(async () => {
      const res = isEditing && tax
        ? await updateTaxAction(tax.id, data)
        : await createTaxAction(data);

      if (!res.success) {
        setServerError(res.error || "Failed to save tax rule.");
      } else {
        onOpenChange(false);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onClose={() => onOpenChange(false)} className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? `Edit Tax Rule: ${tax?.name}` : "Create Tax Rule"}
          </DialogTitle>
          <DialogDescription>
            Configure percentage tax rules applied to products and plans.
          </DialogDescription>
        </DialogHeader>

        {serverError && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">{serverError}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="taxCode" className="text-xs font-semibold">
              Tax Code <span className="text-destructive">*</span>
            </Label>
            <Input
              id="taxCode"
              placeholder="e.g. GST-18, VAT-12"
              disabled={isPending || isEditing}
              className="font-mono text-xs uppercase"
              {...register("taxCode")}
            />
            {errors.taxCode && (
              <p className="text-[11px] text-destructive">
                {errors.taxCode.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="name" className="text-xs font-semibold">
              Tax Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              placeholder="e.g. Goods & Services Tax 18%"
              disabled={isPending}
              className="text-xs"
              {...register("name")}
            />
            {errors.name && (
              <p className="text-[11px] text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ratePercent" className="text-xs font-semibold">
              Rate Percentage (%) <span className="text-destructive">*</span>
            </Label>
            <Input
              id="ratePercent"
              type="number"
              step="0.0001"
              min="0"
              max="100"
              placeholder="18.0000"
              disabled={isPending}
              className="text-xs font-mono"
              {...register("ratePercent")}
            />
            {errors.ratePercent && (
              <p className="text-[11px] text-destructive">
                {errors.ratePercent.message}
              </p>
            )}
            <p className="text-[11px] text-muted-foreground">
              Rate between 0.0000% and 100.0000% (supports up to 4 decimal precision).
            </p>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="taxActive"
              disabled={isPending}
              className="h-4 w-4 rounded border-input text-primary focus:ring-ring"
              {...register("isActive")}
            />
            <Label htmlFor="taxActive" className="text-xs cursor-pointer">
              Tax rule is active and available for assignments
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
              {isEditing ? "Save Changes" : "Create Tax Rule"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
