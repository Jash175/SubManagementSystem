"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Loader2 } from "lucide-react";
import { assignPlanTaxesAction } from "../actions";
import type { Plan, Tax } from "@/types";

interface PlanTaxDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: Plan | null;
  availableTaxes: Tax[];
}

function PlanTaxContent({
  plan,
  availableTaxes,
  onClose,
}: {
  plan: Plan;
  availableTaxes: Tax[];
  onClose: () => void;
}) {
  const [selectedTaxIds, setSelectedTaxIds] = React.useState<string[]>(() =>
    (plan.taxes || []).map((t) => t.id)
  );
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [isPending, startTransition] = React.useTransition();

  const toggleTax = (taxId: string) => {
    setSelectedTaxIds((prev) =>
      prev.includes(taxId) ? prev.filter((id) => id !== taxId) : [...prev, taxId]
    );
  };

  const handleSave = () => {
    setServerError(null);
    startTransition(async () => {
      const res = await assignPlanTaxesAction(plan.id, {
        taxIds: selectedTaxIds,
      });

      if (!res.success) {
        setServerError(res.error || "Failed to update plan taxes.");
      } else {
        onClose();
      }
    });
  };

  return (
    <DialogContent onClose={onClose} className="max-w-md">
      <DialogHeader>
        <div className="flex items-center justify-between">
          <DialogTitle>Assign Plan Taxes</DialogTitle>
          <Badge variant="outline" className="font-mono text-[10px]">
            {plan.planCode}
          </Badge>
        </div>
        <DialogDescription>
          Select which tax rules automatically attach to recurring billing for{" "}
          <span className="font-semibold text-foreground">{plan.name}</span>.
        </DialogDescription>
      </DialogHeader>

      {serverError && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-xs">{serverError}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-3 py-2">
        {availableTaxes.length === 0 ? (
          <p className="text-xs text-muted-foreground p-4 bg-muted/40 rounded-lg text-center border border-dashed">
            No active tax rules configured. Please create a tax rule under Tax Rules first.
          </p>
        ) : (
          availableTaxes.map((tax) => {
            const isChecked = selectedTaxIds.includes(tax.id);
            return (
              <div
                key={tax.id}
                onClick={() => toggleTax(tax.id)}
                className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                  isChecked
                    ? "bg-primary/5 border-primary/40"
                    : "bg-muted/30 border-border hover:bg-muted/50"
                }`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id={`tax-${tax.id}`}
                    checked={isChecked}
                    onChange={() => toggleTax(tax.id)}
                    className="h-4 w-4 rounded border-input text-primary focus:ring-ring"
                  />
                  <div>
                    <Label
                      htmlFor={`tax-${tax.id}`}
                      className="text-xs font-semibold cursor-pointer text-foreground"
                    >
                      {tax.name}
                    </Label>
                    <p className="text-[11px] font-mono text-muted-foreground">
                      {tax.taxCode}
                    </p>
                  </div>
                </div>
                <Badge variant="outline" className="text-xs font-mono">
                  {tax.ratePercent}%
                </Badge>
              </div>
            );
          })
        )}
      </div>

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isPending}
          onClick={onClose}
        >
          Cancel
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={isPending}
          onClick={handleSave}
        >
          {isPending && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
          Save Tax Assignments
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

export function PlanTaxDialog({
  open,
  onOpenChange,
  plan,
  availableTaxes,
}: PlanTaxDialogProps) {
  if (!plan) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && (
        <PlanTaxContent
          key={plan.id}
          plan={plan}
          availableTaxes={availableTaxes}
          onClose={() => onOpenChange(false)}
        />
      )}
    </Dialog>
  );
}
