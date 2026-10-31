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
  Package,
  Plus,
  Layers,
  Receipt,
  Edit,
  Archive,
  RefreshCw,
  Search,
  Sparkles,
} from "lucide-react";
import { formatCurrency, calculateProductPrice } from "../pricing";
import { ProductDialog } from "./product-dialog";
import { VariantDialog } from "./variant-dialog";
import { ProductTaxDialog } from "./product-tax-dialog";
import { archiveProductAction } from "../actions";
import type { Product, Tax } from "@/types";

interface ProductListProps {
  initialProducts: Product[];
  availableTaxes: Tax[];
  isAdmin: boolean;
}

export function ProductList({
  initialProducts,
  availableTaxes,
  isAdmin,
}: ProductListProps) {
  const [products] = React.useState<Product[]>(initialProducts);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState<string>("all");

  // Dialog states
  const [productDialogOpen, setProductDialogOpen] = React.useState(false);
  const [editingProduct, setEditingProduct] = React.useState<Product | null>(null);

  const [variantDialogOpen, setVariantDialogOpen] = React.useState(false);
  const [variantTargetProduct, setVariantTargetProduct] = React.useState<Product | null>(null);

  const [taxDialogOpen, setTaxDialogOpen] = React.useState(false);
  const [taxTargetProduct, setTaxTargetProduct] = React.useState<Product | null>(null);

  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.productCode.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === "all" || p.productType === typeFilter;
    return matchesSearch && matchesType;
  });

  const handleOpenCreate = () => {
    setEditingProduct(null);
    setProductDialogOpen(true);
  };

  const handleOpenEdit = (prod: Product) => {
    setEditingProduct(prod);
    setProductDialogOpen(true);
  };

  const handleOpenVariant = (prod: Product) => {
    setVariantTargetProduct(prod);
    setVariantDialogOpen(true);
  };

  const handleOpenTaxes = (prod: Product) => {
    setTaxTargetProduct(prod);
    setTaxDialogOpen(true);
  };

  const handleToggleArchive = async (prod: Product) => {
    if (!isAdmin) return;
    await archiveProductAction(prod.id, !prod.isActive);
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
              placeholder="Search by code or name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="all">All Types</option>
            <option value="software">Software</option>
            <option value="service">Service</option>
            <option value="addon">Addon</option>
            <option value="physical">Physical</option>
            <option value="other">Other</option>
          </select>
        </div>

        {isAdmin ? (
          <Button onClick={handleOpenCreate} size="sm" className="gap-1.5 shrink-0">
            <Plus className="h-4 w-4" />
            Add Product
          </Button>
        ) : (
          <Badge variant="outline" className="text-xs py-1 px-3">
            Read-Only (Staff Permission)
          </Badge>
        )}
      </div>

      {/* Products Grid */}
      {filteredProducts.length === 0 ? (
        <Card className="border-dashed p-8 text-center bg-muted/20">
          <Package className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-foreground">
            No products found
          </h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
            {products.length === 0
              ? "No catalogue products exist yet. Click 'Add Product' above or apply the Phase 2 database migration to seed initial items."
              : "No products matched your search filter."}
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredProducts.map((product) => {
            const variants = product.variants || [];
            const taxes = product.taxes || [];

            return (
              <Card
                key={product.id}
                className={`transition-colors border-border/80 ${
                  !product.isActive ? "opacity-70 bg-muted/20" : ""
                }`}
              >
                <CardHeader className="p-5 pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-muted text-foreground">
                          {product.productCode}
                        </span>
                        <Badge variant="outline" className="text-[11px] capitalize">
                          {product.productType}
                        </Badge>
                        {!product.isActive && (
                          <Badge variant="destructive" className="text-[10px]">
                            Archived
                          </Badge>
                        )}
                      </div>
                      <CardTitle className="text-base font-semibold pt-1">
                        {product.name}
                      </CardTitle>
                      {product.notes && (
                        <CardDescription className="text-xs line-clamp-2">
                          {product.notes}
                        </CardDescription>
                      )}
                    </div>

                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-foreground font-mono">
                        {formatCurrency(product.salesPrice, product.currencyCode)}
                      </p>
                      {product.costPrice > 0 && (
                        <p className="text-[11px] text-muted-foreground font-mono">
                          Cost: {formatCurrency(product.costPrice, product.currencyCode)}
                        </p>
                      )}
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="p-5 pt-0 space-y-3">
                  {/* Variants Section */}
                  <div className="rounded-lg bg-muted/40 p-3 border text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium flex items-center gap-1.5 text-muted-foreground text-[11px]">
                        <Layers className="h-3.5 w-3.5" />
                        Configured Variants ({variants.length})
                      </span>
                      {isAdmin && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenVariant(product)}
                          className="h-6 px-2 text-[11px] text-primary hover:text-primary"
                        >
                          + Add Variant
                        </Button>
                      )}
                    </div>

                    {variants.length === 0 ? (
                      <p className="text-[11px] text-muted-foreground italic">
                        No attribute variants configured yet.
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {variants.map((v) => {
                          const isOdoo =
                            v.attributeName.toLowerCase() === "brand" &&
                            v.attributeValue.toLowerCase() === "odoo";
                          const computedPrice = calculateProductPrice(
                            product.salesPrice,
                            v.priceDelta
                          );

                          return (
                            <div
                              key={v.id}
                              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] border font-mono ${
                                isOdoo
                                  ? "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300 font-semibold"
                                  : "bg-background border-border text-foreground"
                              }`}
                            >
                              {isOdoo && (
                                <Sparkles className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                              )}
                              <span>
                                {v.attributeName}: {v.attributeValue}
                              </span>
                              <span className="text-muted-foreground">
                                ({v.priceDelta >= 0 ? "+" : ""}
                                {v.priceDelta})
                              </span>
                              <span className="text-[10px] text-primary font-bold">
                                → {formatCurrency(computedPrice, product.currencyCode)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Taxes Section */}
                  <div className="flex items-center justify-between text-xs pt-1">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <Receipt className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="text-[11px] text-muted-foreground shrink-0">
                        Assigned Taxes:
                      </span>
                      {taxes.length === 0 ? (
                        <span className="text-[11px] text-muted-foreground italic">
                          None
                        </span>
                      ) : (
                        <div className="flex flex-wrap gap-1 truncate">
                          {taxes.map((t) => (
                            <Badge
                              key={t.id}
                              variant="outline"
                              className="text-[10px] py-0 px-1.5 font-mono"
                            >
                              {t.taxCode} ({t.ratePercent}%)
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>

                    {isAdmin && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenTaxes(product)}
                        className="h-6 px-2 text-[11px] text-primary hover:text-primary shrink-0"
                      >
                        Manage Taxes
                      </Button>
                    )}
                  </div>

                  {/* Admin Mutation Actions */}
                  {isAdmin && (
                    <div className="flex items-center justify-end gap-2 pt-2 border-t">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenEdit(product)}
                        className="h-7 text-xs gap-1"
                      >
                        <Edit className="h-3.5 w-3.5" />
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleArchive(product)}
                        className="h-7 text-xs text-muted-foreground hover:text-foreground gap-1"
                      >
                        {product.isActive ? (
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
      <ProductDialog
        open={productDialogOpen}
        onOpenChange={setProductDialogOpen}
        product={editingProduct}
      />

      <VariantDialog
        open={variantDialogOpen}
        onOpenChange={setVariantDialogOpen}
        product={variantTargetProduct}
      />

      <ProductTaxDialog
        open={taxDialogOpen}
        onOpenChange={setTaxDialogOpen}
        product={taxTargetProduct}
        availableTaxes={availableTaxes}
      />
    </div>
  );
}
