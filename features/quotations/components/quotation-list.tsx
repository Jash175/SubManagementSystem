"use client";

import * as React from "react";
import Link from "next/link";
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
  FileSpreadsheet,
  Send,
  CheckCircle2,
  Eye,
  Plus,
  Search,
  User,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { sendQuotationAction, confirmSubscriptionAction } from "@/features/subscriptions/actions";
import { formatCurrency } from "@/features/products/pricing";
import type { Subscription } from "@/types";

interface QuotationListProps {
  quotations: Subscription[];
  userRole: "admin" | "staff" | "customer";
  onCreateClick: () => void;
}

export function QuotationList({
  quotations,
  userRole,
  onCreateClick,
}: QuotationListProps) {
  const [search, setSearch] = React.useState("");
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [loadingId, setLoadingId] = React.useState<string | null>(null);
  const [isPending, startTransition] = React.useTransition();

  const isStaffOrAdmin = userRole === "admin" || userRole === "staff";

  const filtered = quotations.filter((q) => {
    const s = search.toLowerCase();
    return (
      q.subscriptionNumber.toLowerCase().includes(s) ||
      q.customer?.legalName.toLowerCase().includes(s) ||
      q.planNameSnapshot.toLowerCase().includes(s)
    );
  });

  const handleSendQuotation = (id: string) => {
    setActionError(null);
    setLoadingId(id);
    startTransition(async () => {
      const res = await sendQuotationAction(id);
      if (!res.success) {
        setActionError(res.error || "Failed to send quotation.");
      }
      setLoadingId(null);
    });
  };

  const handleConfirmQuotation = (id: string) => {
    setActionError(null);
    setLoadingId(id);
    startTransition(async () => {
      const res = await confirmSubscriptionAction(id);
      if (!res.success) {
        setActionError(res.error || "Failed to confirm quotation.");
      }
      setLoadingId(null);
    });
  };

  return (
    <div className="space-y-4">
      {actionError && (
        <div className="p-3 text-xs bg-destructive/10 border border-destructive/20 text-destructive rounded-lg flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Control Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by quote #, customer, plan..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-md border border-input bg-background pl-9 pr-4 py-2 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        {isStaffOrAdmin && (
          <Button size="sm" onClick={onCreateClick} className="h-9 gap-1.5 text-xs w-full sm:w-auto">
            <Plus className="h-3.5 w-3.5" />
            Create Quotation
          </Button>
        )}
      </div>

      {filtered.length === 0 ? (
        <Card className="border-border/80">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
              <FileSpreadsheet className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-semibold text-foreground">No Quotations Found</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm">
              {search
                ? "No quotation matches your search criteria. Try a different query."
                : "Create your first quotation from a template or directly for a customer."}
            </p>
            {isStaffOrAdmin && !search && (
              <Button size="sm" onClick={onCreateClick} className="mt-4 gap-1.5 text-xs">
                <Plus className="h-3.5 w-3.5" />
                Create Quotation
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((quote) => {
            const isDraft = quote.status === "draft";
            const isQuotation = quote.status === "quotation";
            const isLoading = isPending && loadingId === quote.id;

            return (
              <Card
                key={quote.id}
                className="border-border/80 hover:border-primary/40 transition-all flex flex-col justify-between"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="font-mono text-[10px]">
                      {quote.subscriptionNumber}
                    </Badge>
                    <Badge
                      variant={isDraft ? "secondary" : "default"}
                      className="text-[10px] uppercase font-semibold"
                    >
                      {quote.status}
                    </Badge>
                  </div>
                  <CardTitle className="text-sm font-bold pt-1 text-foreground">
                    {quote.planNameSnapshot}
                  </CardTitle>
                  <CardDescription className="text-xs flex items-center gap-1.5 text-muted-foreground">
                    <User className="h-3 w-3" />
                    <span>{quote.customer?.legalName || "Unknown Customer"}</span>
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-3 pt-0 text-xs">
                  <div className="p-2.5 bg-muted/40 rounded-lg space-y-1.5">
                    <div className="flex justify-between items-center text-muted-foreground">
                      <span>Plan Price:</span>
                      <span className="font-semibold text-foreground">
                        {formatCurrency(quote.planPriceSnapshot, quote.currencyCode)} (x{quote.planQuantity})
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-muted-foreground">
                      <span>Start Date:</span>
                      <span className="font-mono text-foreground">{quote.startDate}</span>
                    </div>

                    {quote.quotationValidUntil && (
                      <div className="flex justify-between items-center text-muted-foreground">
                        <span>Valid Until:</span>
                        <span className="font-mono text-primary font-medium">
                          {quote.quotationValidUntil}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t">
                    <Link href={`/subscriptions/${quote.id}`} className="flex-1">
                      <Button variant="outline" size="sm" className="w-full text-xs h-8 gap-1">
                        <Eye className="h-3.5 w-3.5" />
                        Details
                      </Button>
                    </Link>

                    {isStaffOrAdmin && isDraft && (
                      <Button
                        size="sm"
                        disabled={isLoading}
                        onClick={() => handleSendQuotation(quote.id)}
                        className="text-xs h-8 gap-1"
                      >
                        {isLoading ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Send className="h-3.5 w-3.5" />
                        )}
                        Send Offer
                      </Button>
                    )}

                    {isStaffOrAdmin && isQuotation && (
                      <Button
                        size="sm"
                        disabled={isLoading}
                        onClick={() => handleConfirmQuotation(quote.id)}
                        className="text-xs h-8 gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                      >
                        {isLoading ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        )}
                        Confirm
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
