import * as React from "react";
import { notFound, redirect } from "next/navigation";
import { getCurrentUserSession } from "@/features/auth/guards";
import { CustomerShell } from "@/components/layout/customer-shell";
import { getInvoiceById } from "@/features/billing/services";
import { InvoiceDetail } from "@/features/billing/components/invoice-detail";

export const instant = false;

interface CustomerSingleInvoiceProps {
  params: Promise<{ id: string }>;
}

export default async function CustomerSingleInvoicePage({
  params,
}: CustomerSingleInvoiceProps) {
  const session = await getCurrentUserSession();
  if (!session) {
    redirect("/login");
  }

  if (session.role !== "customer") {
    redirect("/billing");
  }

  const { id } = await params;
  const customerId = session.customer?.id;

  if (!customerId) {
    notFound();
  }

  // Strict customer isolation check
  const invoice = await getInvoiceById(id, { customerId });
  if (!invoice) {
    notFound();
  }

  return (
    <CustomerShell userSession={session}>
      <div className="space-y-6">
        <InvoiceDetail invoice={invoice} portalMode={true} />
      </div>
    </CustomerShell>
  );
}
