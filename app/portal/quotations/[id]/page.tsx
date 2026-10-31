import * as React from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUserSession } from "@/features/auth/guards";
import { CustomerShell } from "@/components/layout/customer-shell";
import { PageHeader } from "@/components/shared/page-header";
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
  ArrowLeft,
  Calendar,
  Package,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { getSubscriptionById } from "@/features/subscriptions/services";
import { SubscriptionActions } from "@/features/subscriptions/components/subscription-actions";
import { formatCurrency } from "@/features/products/pricing";
import { formatDateUTC } from "@/features/subscriptions/lifecycle";

export const instant = false;

interface CustomerQuotationDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function CustomerQuotationDetailPage({
  params,
}: CustomerQuotationDetailPageProps) {
  const session = await getCurrentUserSession();
  if (!session) {
    redirect("/login?redirectTo=/portal/quotations");
  }

  const { id } = await params;
  const customerId = session.role === "customer" ? session.customer?.id : undefined;

  const quotation = await getSubscriptionById(id, customerId);

  // If quotation not found or belongs to another customer, deny access
  if (!quotation) {
    notFound();
  }

  // If already confirmed or active, redirect to subscriptions view
  if (quotation.status !== "draft" && quotation.status !== "quotation") {
    redirect(`/portal/subscriptions/${quotation.id}`);
  }

  const today = formatDateUTC(new Date());
  const isExpired =
    Boolean(quotation.quotationValidUntil) &&
    Boolean(quotation.quotationValidUntil && quotation.quotationValidUntil < today);

  return (
    <CustomerShell userSession={session}>
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Link href="/portal/quotations">
            <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs text-muted-foreground">
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to Quotations
            </Button>
          </Link>
        </div>

        <PageHeader
          heading={`Quotation Offer ${quotation.subscriptionNumber}`}
          subheading={`Review quotation terms, itemized package contents, and accept your offer for ${quotation.planNameSnapshot}.`}
        >
          <div className="flex items-center gap-2">
            {isExpired ? (
              <Badge variant="destructive" className="text-xs uppercase">
                Offer Expired
              </Badge>
            ) : (
              <Badge variant="default" className="text-xs uppercase">
                Offer Pending
              </Badge>
            )}
            <Badge variant="outline" className="font-mono text-xs">
              {quotation.planNameSnapshot}
            </Badge>
          </div>
        </PageHeader>

        {/* Expiry Banner (T-10 compliance) */}
        {isExpired ? (
          <div className="flex items-center gap-3 p-4 rounded-lg bg-destructive/10 border border-destructive/30 text-xs text-destructive">
            <AlertTriangle className="h-5 w-5 shrink-0 text-destructive" />
            <div>
              <span className="font-semibold">Quotation Validity Expired:</span> This quotation offer expired on{" "}
              <span className="font-mono font-bold">{quotation.quotationValidUntil}</span> and can no longer be confirmed.
              Please reach out to your sales representative to request a revised proposal.
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-800 dark:text-emerald-200">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <div>
                <span className="font-semibold">Offer Valid:</span> This quotation offer is active until{" "}
                <span className="font-mono font-bold">{quotation.quotationValidUntil || "further notice"}</span>.
                Review the terms below and click &ldquo;Accept &amp; Confirm Quotation&rdquo; to begin your subscription.
              </div>
            </div>
          </div>
        )}

        {/* Self-Service Confirmation Action Bar */}
        {!isExpired && (
          <Card className="border-border/80 bg-muted/20">
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-xs font-semibold text-foreground uppercase tracking-wider">
                Acceptance Controls
              </CardTitle>
              <CardDescription className="text-xs">
                Confirm your agreement to initiate your recurring subscription plan
              </CardDescription>
            </CardHeader>
            <CardContent className="py-3 px-4 pt-0">
              <SubscriptionActions subscription={quotation} userRole={session.role} />
            </CardContent>
          </Card>
        )}

        {/* Quotation Details and Line Items */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="md:col-span-2 border-border/80">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Package className="h-4 w-4 text-primary" />
                Package Items &amp; Add-ons
              </CardTitle>
              <CardDescription className="text-xs">
                Products and service lines bundled into this quotation
              </CardDescription>
            </CardHeader>
            <CardContent>
              {(!quotation.lines || quotation.lines.length === 0) ? (
                <div className="p-4 text-center rounded-lg bg-muted/30 border text-xs text-muted-foreground">
                  Standard plan package with no supplementary product lines.
                </div>
              ) : (
                <div className="border rounded-lg overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-muted/50 border-b text-[11px] font-semibold text-muted-foreground uppercase">
                      <tr>
                        <th className="p-2.5">Product</th>
                        <th className="p-2.5">Description</th>
                        <th className="p-2.5 text-right">Quantity</th>
                        <th className="p-2.5 text-right">Agreed Unit Price</th>
                        <th className="p-2.5 text-right">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {(quotation.lines || []).map((line) => (
                        <tr key={line.id}>
                          <td className="p-2.5 font-medium text-foreground">
                            {line.product?.name || line.descriptionSnapshot}
                            {line.variant && (
                              <Badge variant="outline" className="ml-1.5 text-[9px] font-normal">
                                {line.variant.attributeValue}
                              </Badge>
                            )}
                          </td>
                          <td className="p-2.5 text-muted-foreground">
                            {line.descriptionSnapshot}
                          </td>
                          <td className="p-2.5 text-right font-mono">
                            {line.quantity}
                          </td>
                          <td className="p-2.5 text-right font-mono">
                            {formatCurrency(line.unitPrice, "USD")}
                          </td>
                          <td className="p-2.5 text-right font-mono font-semibold">
                            {formatCurrency(line.lineSubtotal, "USD")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quotation Terms Card */}
          <Card className="border-border/80">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                Quotation Terms
              </CardTitle>
              <CardDescription className="text-xs">
                Schedule, billing cadence, and payment terms
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 pt-1 text-xs">
              <div className="flex justify-between py-1.5 border-b">
                <span className="text-muted-foreground">Plan Quantity</span>
                <span className="font-mono font-semibold text-foreground">
                  {quotation.planQuantity} unit(s)
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b">
                <span className="text-muted-foreground">Proposed Start Date</span>
                <span className="font-mono font-medium text-foreground">{quotation.startDate}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b">
                <span className="text-muted-foreground">Validity Deadline</span>
                <span
                  className={`font-mono font-medium ${
                    isExpired ? "text-destructive" : "text-emerald-600 dark:text-emerald-400"
                  }`}
                >
                  {quotation.quotationValidUntil || "Open"}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b">
                <span className="text-muted-foreground">Payment Terms</span>
                <span className="font-medium text-foreground">
                  Net {quotation.paymentTermsDays} days
                </span>
              </div>
              {quotation.expiryDate && (
                <div className="flex justify-between py-1.5 border-b">
                  <span className="text-muted-foreground">Contract Expiry</span>
                  <span className="font-mono font-medium text-foreground">
                    {quotation.expiryDate}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </CustomerShell>
  );
}
