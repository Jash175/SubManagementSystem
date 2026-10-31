import * as React from "react";
import { redirect } from "next/navigation";
import { getCurrentUserSession } from "@/features/auth/guards";
import { CustomerShell } from "@/components/layout/customer-shell";
import { PageHeader } from "@/components/shared/page-header";
import { getInvoices } from "@/features/billing/services";
import { InvoiceList } from "@/features/billing/components/invoice-list";

export const instant = false;

export default async function CustomerInvoicesPage() {
  const session = await getCurrentUserSession();
  if (!session) {
    redirect("/login");
  }

  if (session.role !== "customer") {
    redirect("/billing");
  }

  const customerId = session.customer?.id;
  const invoices = customerId ? await getInvoices({ customerId }) : [];

  return (
    <CustomerShell userSession={session}>
      <div className="space-y-6">
        <PageHeader
          heading="My Invoices"
          subheading="View your billing statements, payment receipts, and outstanding dues."
        >
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-muted-foreground bg-muted px-2.5 py-1 rounded-md border">
              {invoices.length} Invoices
            </span>
          </div>
        </PageHeader>

        <InvoiceList invoices={invoices} portalMode={true} />
      </div>
    </CustomerShell>
  );
}
