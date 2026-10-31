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
import { Receipt, Plus, Edit, Archive, RefreshCw, Search } from "lucide-react";
import { TaxDialog } from "./tax-dialog";
import { archiveTaxAction } from "../actions";
import type { Tax } from "@/types";

interface TaxListProps {
  initialTaxes: Tax[];
  isAdmin: boolean;
}

export function TaxList({ initialTaxes, isAdmin }: TaxListProps) {
  const [taxes] = React.useState<Tax[]>(initialTaxes);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingTax, setEditingTax] = React.useState<Tax | null>(null);

  const filteredTaxes = taxes.filter(
    (t) =>
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.taxCode.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleOpenCreate = () => {
    setEditingTax(null);
    setDialogOpen(true);
  };

  const handleOpenEdit = (tax: Tax) => {
    setEditingTax(tax);
    setDialogOpen(true);
  };

  const handleToggleArchive = async (tax: Tax) => {
    if (!isAdmin) return;
    await archiveTaxAction(tax.id, !tax.isActive);
  };

  return (
    <div className="space-y-6">
      {/* Top Filter and Action Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search taxes by code or name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>

        {isAdmin ? (
          <Button onClick={handleOpenCreate} size="sm" className="gap-1.5 shrink-0">
            <Plus className="h-4 w-4" />
            Add Tax Rule
          </Button>
        ) : (
          <Badge variant="outline" className="text-xs py-1 px-3">
            Read-Only (Staff Permission)
          </Badge>
        )}
      </div>

      {/* Tax Rules List */}
      {filteredTaxes.length === 0 ? (
        <Card className="border-dashed p-8 text-center bg-muted/20">
          <Receipt className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-foreground">No taxes found</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
            {taxes.length === 0
              ? "No tax rules have been configured yet. Click 'Add Tax Rule' to establish your jurisdiction rates."
              : "No tax rules matched your search query."}
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTaxes.map((tax) => (
            <Card
              key={tax.id}
              className={`border-border/80 transition-colors ${
                !tax.isActive ? "opacity-70 bg-muted/20" : ""
              }`}
            >
              <CardHeader className="p-5 pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-muted text-foreground">
                      {tax.taxCode}
                    </span>
                    {!tax.isActive && (
                      <Badge variant="destructive" className="text-[10px]">
                        Archived
                      </Badge>
                    )}
                  </div>
                  <span className="text-lg font-bold font-mono text-primary">
                    {tax.ratePercent}%
                  </span>
                </div>
                <CardTitle className="text-sm font-semibold pt-2">
                  {tax.name}
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Percentage rate applied to eligible line items.
                </CardDescription>
              </CardHeader>

              {isAdmin && (
                <CardContent className="p-5 pt-0 flex items-center justify-end gap-2 border-t mt-3 pt-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenEdit(tax)}
                    className="h-7 text-xs gap-1"
                  >
                    <Edit className="h-3.5 w-3.5" />
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleToggleArchive(tax)}
                    className="h-7 text-xs text-muted-foreground hover:text-foreground gap-1"
                  >
                    {tax.isActive ? (
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
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Tax Dialog */}
      <TaxDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        tax={editingTax}
      />
    </div>
  );
}
