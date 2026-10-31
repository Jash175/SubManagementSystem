"use client";

import * as React from "react";
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
  FileText,
  Calendar,
  Layers,
  Plus,
  Archive,
  Package,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { toggleQuotationTemplateActiveAction } from "../actions";
import { formatCurrency } from "@/features/products/pricing";
import type { QuotationTemplate } from "@/types";

interface TemplateListProps {
  templates: QuotationTemplate[];
  userRole: "admin" | "staff" | "customer";
  onCreateClick: () => void;
}

export function TemplateList({
  templates,
  userRole,
  onCreateClick,
}: TemplateListProps) {
  const [isPending, startTransition] = React.useTransition();
  const isAdmin = userRole === "admin";
  const canManage = userRole === "admin" || userRole === "staff";

  const handleToggle = (id: string, newActive: boolean, name: string) => {
    if (!newActive) {
      const confirmed = confirm(
        `Are you sure you want to deactivate template "${name}"?\n\nInactive templates cannot be selected when creating new quotations.`
      );
      if (!confirmed) return;
    }

    startTransition(async () => {
      await toggleQuotationTemplateActiveAction(id, newActive);
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Configured Quotation Templates</h3>
          <p className="text-xs text-muted-foreground">Standardized packages for rapid quote preparation</p>
        </div>

        {isAdmin && (
          <Button size="sm" onClick={onCreateClick} className="h-8 gap-1.5 text-xs">
            <Plus className="h-3.5 w-3.5" />
            New Template
          </Button>
        )}
      </div>

      {templates.length === 0 ? (
        <Card className="border-border/80">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
              <FileText className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-semibold text-foreground">No Quotation Templates</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm">
              Define standard plans and product bundles to make creating quotations quick and consistent.
            </p>
            {isAdmin && (
              <Button size="sm" onClick={onCreateClick} className="mt-4 gap-1.5 text-xs">
                <Plus className="h-3.5 w-3.5" />
                Create Template
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((tmpl) => (
            <Card
              key={tmpl.id}
              className={`border-border/80 hover:border-primary/40 transition-all flex flex-col justify-between ${
                !tmpl.isActive ? "opacity-75 bg-muted/20" : ""
              }`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <Badge
                    variant={tmpl.isActive ? "success" : "secondary"}
                    className="text-[10px] gap-1 font-medium"
                  >
                    {tmpl.isActive ? (
                      <>
                        <CheckCircle2 className="h-3 w-3" />
                        Active
                      </>
                    ) : (
                      <>
                        <XCircle className="h-3 w-3 text-muted-foreground" />
                        Inactive
                      </>
                    )}
                  </Badge>
                  <span className="text-[11px] font-mono text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {tmpl.validityDays}d validity
                  </span>
                </div>
                <CardTitle className="text-sm font-bold pt-1 text-foreground">
                  {tmpl.name}
                </CardTitle>
                {tmpl.plan && (
                  <CardDescription className="text-xs flex items-center gap-1.5 text-muted-foreground">
                    <Layers className="h-3 w-3 text-primary" />
                    <span>Plan: {tmpl.plan.name}</span>
                  </CardDescription>
                )}
              </CardHeader>

              <CardContent className="space-y-3 pt-0 text-xs">
                {tmpl.plan && (
                  <div className="p-2.5 bg-muted/40 rounded-lg flex items-center justify-between">
                    <span className="text-muted-foreground">Plan Rate:</span>
                    <span className="font-semibold text-foreground">
                      {formatCurrency(tmpl.plan.price, tmpl.plan.currencyCode)} / {tmpl.plan.billingIntervalUnit}
                    </span>
                  </div>
                )}

                {tmpl.lines && tmpl.lines.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                      <Package className="h-3 w-3" />
                      Bundled Lines ({tmpl.lines.length}):
                    </p>
                    <div className="space-y-1">
                      {tmpl.lines.map((line) => (
                        <div
                          key={line.id}
                          className="text-[11px] flex justify-between p-1.5 bg-background border rounded text-muted-foreground"
                        >
                          <span className="truncate max-w-[180px]">
                            {line.description || line.product?.name || "Product"}
                          </span>
                          <span className="font-mono">Qty: {line.quantity}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {canManage && (
                  <div className="pt-2 border-t flex justify-end">
                    {tmpl.isActive ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={isPending}
                        onClick={() => handleToggle(tmpl.id, false, tmpl.name)}
                        className="h-7 text-xs text-muted-foreground hover:text-destructive gap-1"
                      >
                        <Archive className="h-3 w-3" />
                        Deactivate
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isPending}
                        onClick={() => handleToggle(tmpl.id, true, tmpl.name)}
                        className="h-7 text-xs text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 gap-1"
                      >
                        <CheckCircle2 className="h-3 w-3" />
                        Activate
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
