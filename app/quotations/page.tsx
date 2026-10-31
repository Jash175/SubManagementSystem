import * as React from "react";
import { requireStaffOrAdmin } from "@/features/auth/guards";
import { AdminShell } from "@/components/layout/admin-shell";
import { PageHeader } from "@/components/shared/page-header";
import { QuotationHub } from "./quotation-hub";
import { getSubscriptions } from "@/features/subscriptions/services";
import { getQuotationTemplates } from "@/features/quotations/services";
import { getCustomers } from "@/features/customers/queries";
import { getPlans } from "@/features/plans/services";
import { getProducts } from "@/features/products/services";
import { Badge } from "@/components/ui/badge";

export const instant = false;

export default async function QuotationsPage() {
  const session = await requireStaffOrAdmin();

  // Load subscriptions in quotation/draft state
  const [draftSubs, quoteSubs, templates, customers, plans, products] = await Promise.all([
    getSubscriptions({ status: "draft" }),
    getSubscriptions({ status: "quotation" }),
    getQuotationTemplates({ includeArchived: true }),
    getCustomers(),
    getPlans({ includeArchived: false }),
    getProducts({ includeArchived: false }),
  ]);

  const allQuotations = [...draftSubs, ...quoteSubs];

  return (
    <AdminShell userSession={session}>
      <PageHeader
        heading="Quotations & Templates"
        subheading="Manage quotation templates, prepare customer offers, set validity terms, and track acceptance."
      >
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="font-mono text-xs">
            {allQuotations.length} Active Quotes
          </Badge>
          <Badge variant="default" className="text-xs">
            Phase 3 Ready
          </Badge>
        </div>
      </PageHeader>

      <QuotationHub
        quotations={allQuotations}
        templates={templates}
        customers={customers}
        plans={plans}
        products={products}
        userSession={session}
      />
    </AdminShell>
  );
}
