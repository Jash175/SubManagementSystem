import * as React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
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
  FileText,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { getCustomerQuotations } from "@/features/portal/services";
import { formatDateUTC } from "@/features/subscriptions/lifecycle";

export const instant = false;

export default async function CustomerQuotationsPage() {
  const session = await getCurrentUserSession();
  if (!session) {
    redirect("/login?redirectTo=/portal/quotations");
  }

  const customerId = session.customer?.id;
  const quotations = customerId ? await getCustomerQuotations(customerId) : [];
  const today = formatDateUTC(new Date());

  return (
    <CustomerShell userSession={session}>
      <div className="space-y-6">
        <PageHeader
          heading="My Quotation Offers"
          subheading="Review tailored subscription proposals, check validity terms, and accept offers."
        >
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-mono text-xs">
              {quotations.length} Quotation Offers
            </Badge>
          </div>
        </PageHeader>

        {quotations.length === 0 ? (
          <Card className="border-border/80">
            <CardContent className="py-12 text-center">
              <div className="h-12 w-12 rounded-full bg-muted/50 mx-auto flex items-center justify-center text-muted-foreground mb-3">
                <FileText className="h-6 w-6 opacity-60" />
              </div>
              <h3 className="text-sm font-semibold text-foreground">
                No quotation offers available
              </h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                When our team prepares a subscription quotation or customized offer for your account, it will appear here for review.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {quotations.map((quote) => {
              const isValid =
                !quote.quotationValidUntil || quote.quotationValidUntil >= today;
              const isOffer = quote.status === "quotation";

              return (
                <Card
                  key={quote.id}
                  className={`border-border/80 transition-colors ${
                    isOffer && isValid
                      ? "border-primary/40 bg-primary/[0.02]"
                      : ""
                  }`}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-foreground">
                        {quote.subscriptionNumber}
                      </span>
                      {isOffer ? (
                        isValid ? (
                          <Badge variant="default" className="text-[10px] uppercase font-semibold">
                            Offer Ready
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="text-[10px] uppercase font-semibold">
                            Offer Expired
                          </Badge>
                        )
                      ) : (
                        <Badge variant="outline" className="text-[10px] uppercase font-semibold">
                          {quote.status}
                        </Badge>
                      )}
                    </div>
                    <CardTitle className="text-base pt-1">
                      {quote.planNameSnapshot}
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Quantity: {quote.planQuantity} unit(s) • Payment Terms: {quote.paymentTermsDays} days
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4 pt-1">
                    <div className="grid grid-cols-2 gap-2 text-xs bg-muted/30 p-2.5 rounded-lg border">
                      <div>
                        <span className="text-[11px] text-muted-foreground block">Proposed Start</span>
                        <span className="font-mono font-medium text-foreground">{quote.startDate}</span>
                      </div>
                      <div>
                        <span className="text-[11px] text-muted-foreground block">Offer Validity</span>
                        <span
                          className={`font-mono font-medium ${
                            isValid
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-destructive"
                          }`}
                        >
                          {quote.quotationValidUntil || "Indefinite"}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <div className="text-[11px] text-muted-foreground">
                        {isValid ? (
                          <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="h-3 w-3" /> Ready to confirm
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-destructive">
                            <AlertTriangle className="h-3 w-3" /> Validity expired
                          </span>
                        )}
                      </div>

                      <Link href={`/portal/quotations/${quote.id}`}>
                        <Button
                          size="sm"
                          variant={isValid ? "default" : "outline"}
                          className="h-8 text-xs gap-1"
                        >
                          Review Offer <ArrowRight className="h-3.5 w-3.5" />
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </CustomerShell>
  );
}
