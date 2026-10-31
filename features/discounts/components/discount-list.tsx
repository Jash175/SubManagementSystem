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
  Percent,
  Plus,
  Calendar,
  Edit,
  Archive,
  RefreshCw,
  Search,
  Tag,
} from "lucide-react";
import { formatCurrency } from "@/features/products/pricing";
import { checkDiscountEligibility } from "../eligibility";
import { DiscountDialog } from "./discount-dialog";
import { archiveDiscountAction } from "../actions";
import type { Discount, Product } from "@/types";

interface DiscountListProps {
  initialDiscounts: Discount[];
  availableProducts: Product[];
  isAdmin: boolean;
}

export function DiscountList({
  initialDiscounts,
  availableProducts,
  isAdmin,
}: DiscountListProps) {
  const [discounts] = React.useState<Discount[]>(initialDiscounts);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [scopeFilter, setScopeFilter] = React.useState<string>("all");

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingDiscount, setEditingDiscount] = React.useState<Discount | null>(null);

  const filteredDiscounts = discounts.filter((d) => {
    const matchesSearch =
      d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.discountCode.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesScope = scopeFilter === "all" || d.scope === scopeFilter;
    return matchesSearch && matchesScope;
  });

  const handleOpenCreate = () => {
    setEditingDiscount(null);
    setDialogOpen(true);
  };

  const handleOpenEdit = (disc: Discount) => {
    setEditingDiscount(disc);
    setDialogOpen(true);
  };

  const handleToggleArchive = async (disc: Discount) => {
    if (!isAdmin) return;
    await archiveDiscountAction(disc.id, !disc.isActive);
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
              placeholder="Search discounts by code or name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>

          <select
            value={scopeFilter}
            onChange={(e) => setScopeFilter(e.target.value)}
            className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="all">All Scopes</option>
            <option value="subscription">Subscription Scope</option>
            <option value="product">Product Scope</option>
          </select>
        </div>

        {isAdmin ? (
          <Button onClick={handleOpenCreate} size="sm" className="gap-1.5 shrink-0">
            <Plus className="h-4 w-4" />
            Create Discount Rule
          </Button>
        ) : (
          <Badge variant="outline" className="text-xs py-1 px-3">
            Read-Only (Admin-Only Configuration)
          </Badge>
        )}
      </div>

      {/* Discounts Grid */}
      {filteredDiscounts.length === 0 ? (
        <Card className="border-dashed p-8 text-center bg-muted/20">
          <Percent className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-foreground">
            No discount rules found
          </h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
            {discounts.length === 0
              ? "No discount rules have been configured yet. Only administrators can create promotional rules."
              : "No discount rules matched your search query."}
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredDiscounts.map((discount) => {
            const eligibility = checkDiscountEligibility(discount, {
              purchaseAmount: 999999,
              quantity: 999999,
              date: new Date(),
            });

            const valueDisplay =
              discount.discountType === "percentage"
                ? `${discount.value}% Off`
                : `${formatCurrency(discount.value, discount.currencyCode)} Off`;

            return (
              <Card
                key={discount.id}
                className={`border-border/80 transition-colors ${
                  !discount.isActive ? "opacity-70 bg-muted/20" : ""
                }`}
              >
                <CardHeader className="p-5 pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-muted text-foreground">
                          {discount.discountCode}
                        </span>
                        <Badge variant="outline" className="text-[10px] capitalize">
                          {discount.scope} Scope
                        </Badge>
                        <Badge
                          variant={eligibility.isEligible ? "default" : "outline"}
                          className="text-[10px]"
                        >
                          {eligibility.isEligible ? "Active" : "Expired / Inactive"}
                        </Badge>
                        {!discount.isActive && (
                          <Badge variant="destructive" className="text-[10px]">
                            Archived
                          </Badge>
                        )}
                      </div>
                      <CardTitle className="text-base font-semibold pt-1">
                        {discount.name}
                      </CardTitle>
                      <CardDescription className="text-xs">
                        {discount.scope === "subscription"
                          ? "Deducted from the overall recurring invoice subtotal before tax."
                          : "Deducted from eligible product lines only before tax."}
                      </CardDescription>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-base font-bold text-primary font-mono block">
                        {valueDisplay}
                      </span>
                      <span className="text-[10px] text-muted-foreground uppercase font-mono">
                        {discount.discountType}
                      </span>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="p-5 pt-0 space-y-3">
                  {/* Criteria & Caps Matrix */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs p-3 rounded-lg bg-muted/40 border">
                    <div>
                      <span className="text-[11px] text-muted-foreground block">
                        Min Spend:
                      </span>
                      <span className="font-mono font-semibold text-foreground">
                        {discount.minimumPurchaseAmount > 0
                          ? formatCurrency(discount.minimumPurchaseAmount, discount.currencyCode)
                          : "None"}
                      </span>
                    </div>

                    <div>
                      <span className="text-[11px] text-muted-foreground block">
                        Min Quantity:
                      </span>
                      <span className="font-mono font-semibold text-foreground">
                        {discount.minimumQuantity > 0
                          ? `${discount.minimumQuantity} units`
                          : "None"}
                      </span>
                    </div>

                    <div>
                      <span className="text-[11px] text-muted-foreground block">
                        Usage Limit:
                      </span>
                      <span className="font-mono font-semibold text-foreground">
                        {discount.maxUses ? `${discount.maxUses} uses` : "Unlimited"}
                      </span>
                    </div>
                  </div>

                  {/* Validity Window */}
                  <div className="flex items-center justify-between text-xs px-1">
                    <span className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5" />
                      Validity Window:
                    </span>
                    <span className="font-mono text-xs text-foreground">
                      {discount.startsOn} → {discount.endsOn}
                    </span>
                  </div>

                  {/* Target Products (for product-scoped rules) */}
                  {discount.scope === "product" && (
                    <div className="p-2.5 rounded-lg border bg-muted/20 text-xs space-y-1.5">
                      <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                        <Tag className="h-3 w-3" />
                        Target Products ({(discount.products || []).length}):
                      </span>
                      {(discount.products || []).length === 0 ? (
                        <p className="text-[11px] text-muted-foreground italic">
                          All products or specific mapping pending.
                        </p>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {discount.products?.map((p) => (
                            <Badge
                              key={p.id}
                              variant="outline"
                              className="text-[10px] font-mono py-0"
                            >
                              {p.name} ({p.productCode})
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Admin Mutation Actions */}
                  {isAdmin && (
                    <div className="flex items-center justify-end gap-2 pt-2 border-t">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenEdit(discount)}
                        className="h-7 text-xs gap-1"
                      >
                        <Edit className="h-3.5 w-3.5" />
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleArchive(discount)}
                        className="h-7 text-xs text-muted-foreground hover:text-foreground gap-1"
                      >
                        {discount.isActive ? (
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
      <DiscountDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        discount={editingDiscount}
        availableProducts={availableProducts}
      />
    </div>
  );
}
