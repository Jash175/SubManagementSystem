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
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Loader2, FileText } from "lucide-react";
import {
  createQuotationFromTemplateSchema,
  type CreateQuotationFromTemplateInput,
} from "../schemas";
import { createQuotationFromTemplateAction } from "../actions";
import { formatCurrency } from "@/features/products/pricing";
import type { CustomerAccount, QuotationTemplate } from "@/types";

interface QuotationFromTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templates: QuotationTemplate[];
  customers: CustomerAccount[];
}

function QuotationFromTemplateForm({
  templates,
  customers,
  onClose,
}: {
  templates: QuotationTemplate[];
  customers: CustomerAccount[];
  onClose: () => void;
}) {
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [isPending, startTransition] = React.useTransition();

  const defaultStartDate = "2026-11-01";

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateQuotationFromTemplateInput>({
    resolver: zodResolver(createQuotationFromTemplateSchema),
    defaultValues: {
      customerId: "",
      templateId: templates[0]?.id || "",
      startDate: defaultStartDate,
      expiryDate: "",
      planQuantity: 1,
      paymentTermsDays: 15,
    },
  });

  const watchedTemplateId = useWatch({ control, name: "templateId" });
  const selectedTemplate = templates.find((t) => t.id === watchedTemplateId) || templates[0];

  const onSubmit = (data: CreateQuotationFromTemplateInput) => {
    setServerError(null);
    startTransition(async () => {
      const res = await createQuotationFromTemplateAction(data);
      if (!res.success) {
        setServerError(res.error || "Failed to create quotation.");
      } else {
        onClose();
      }
    });
  };

  return (
    <DialogContent onClose={onClose} className="max-w-xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Create Quotation from Template</DialogTitle>
        <DialogDescription>
          Generate a formal subscription quotation offer using a predefined template.
        </DialogDescription>
      </DialogHeader>

      {serverError && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-xs">{serverError}</AlertDescription>
        </Alert>
      )}

      {templates.length === 0 ? (
        <div className="py-6 text-center text-xs text-muted-foreground bg-muted/40 rounded-lg border border-dashed space-y-1">
          <p className="font-semibold text-foreground">No Active Quotation Templates</p>
          <p>There are no active quotation templates available. Please activate an existing template in the Templates tab or create a new template first.</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {customers.length === 0 && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-xs space-y-1">
              <p className="font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                <AlertCircle className="h-4 w-4" />
                No Customer Accounts Found
              </p>
              <p className="text-muted-foreground">
                No active customer accounts are registered in the system. A customer account must be registered before you can create a quotation.
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="customerId" className="text-xs font-semibold">
                Customer Account <span className="text-destructive">*</span>
              </Label>
              <select
                id="customerId"
                {...register("customerId")}
                disabled={customers.length === 0}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
              >
                <option value="">-- Select a Customer Account --</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.legalName}
                    {c.companyName ? ` (${c.companyName})` : ""} — {c.email} [{c.customerCode}]
                  </option>
                ))}
              </select>
              {errors.customerId && (
                <p className="text-[11px] text-destructive mt-1">{errors.customerId.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="templateId" className="text-xs font-semibold">
                Quotation Template <span className="text-destructive">*</span>
              </Label>
              <select
                id="templateId"
                {...register("templateId")}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.plan?.name || "Plan"})
                  </option>
                ))}
              </select>
              {errors.templateId && (
                <p className="text-[11px] text-destructive mt-1">{errors.templateId.message}</p>
              )}
            </div>
          </div>

          {/* Template Details Preview */}
          {selectedTemplate && (
            <div className="p-3 bg-muted/40 border rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5 text-primary" />
                  Template: {selectedTemplate.name}
                </span>
                <Badge variant="outline" className="text-[10px]">
                  Validity: {selectedTemplate.validityDays} days
                </Badge>
              </div>

              {selectedTemplate.plan && (
                <div className="text-xs text-muted-foreground flex items-center justify-between border-t pt-2">
                  <span>Plan: {selectedTemplate.plan.name}</span>
                  <span className="font-semibold text-foreground">
                    {formatCurrency(selectedTemplate.plan.price, selectedTemplate.plan.currencyCode)} / {selectedTemplate.plan.billingIntervalUnit}
                  </span>
                </div>
              )}

              {selectedTemplate.lines && selectedTemplate.lines.length > 0 && (
                <div className="border-t pt-2 space-y-1">
                  <p className="text-[11px] font-medium text-muted-foreground">Bundled Products:</p>
                  {selectedTemplate.lines.map((l) => (
                    <div key={l.id} className="text-[11px] flex justify-between text-muted-foreground">
                      <span>• {l.description || l.product?.name || "Product"}</span>
                      <span>Qty: {l.quantity}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="startDate" className="text-xs font-semibold">
                Start Date (YYYY-MM-DD) <span className="text-destructive">*</span>
              </Label>
              <Input
                id="startDate"
                placeholder="2026-11-01"
                {...register("startDate")}
                className="mt-1"
              />
              {errors.startDate && (
                <p className="text-[11px] text-destructive mt-1">{errors.startDate.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="expiryDate" className="text-xs font-semibold">
                Expiry Date (Optional)
              </Label>
              <Input
                id="expiryDate"
                placeholder="2027-10-31"
                {...register("expiryDate")}
                className="mt-1"
              />
              {errors.expiryDate && (
                <p className="text-[11px] text-destructive mt-1">{errors.expiryDate.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="planQuantity" className="text-xs font-semibold">
                Plan Quantity <span className="text-destructive">*</span>
              </Label>
              <Input
                id="planQuantity"
                type="number"
                min="1"
                step="1"
                {...register("planQuantity")}
                className="mt-1"
              />
              {errors.planQuantity && (
                <p className="text-[11px] text-destructive mt-1">{errors.planQuantity.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="paymentTermsDays" className="text-xs font-semibold">
                Payment Terms (Days)
              </Label>
              <Input
                id="paymentTermsDays"
                type="number"
                min="0"
                step="1"
                {...register("paymentTermsDays")}
                className="mt-1"
              />
              {errors.paymentTermsDays && (
                <p className="text-[11px] text-destructive mt-1">{errors.paymentTermsDays.message}</p>
              )}
            </div>
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
            <Button type="submit" size="sm" disabled={isPending || customers.length === 0}>
              {isPending && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
              Create Quotation
            </Button>
          </DialogFooter>
        </form>
      )}
    </DialogContent>
  );
}

export function QuotationFromTemplateDialog({
  open,
  onOpenChange,
  templates,
  customers,
}: QuotationFromTemplateDialogProps) {
  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <QuotationFromTemplateForm
        templates={templates}
        customers={customers}
        onClose={() => onOpenChange(false)}
      />
    </Dialog>
  );
}
