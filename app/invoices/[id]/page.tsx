import * as React from "react";
import { notFound, redirect } from "next/navigation";
import { getCurrentUserSession } from "@/features/auth/guards";
import { AdminShell } from "@/components/layout/admin-shell";
import { getInvoiceById } from "@/features/billing/services";
import { InvoiceDetail } from "@/features/billing/components/invoice-detail";

export const instant = false;

interface InvoicePageProps {
  params: Promise<{ id: string }>;
}

export default async function SingleInvoicePage({ params }: InvoicePageProps) {
  const session = await getCurrentUserSession();
  if (!session) {
    redirect("/login");
  }

  const { id } = await params;

  if (session.role === "customer") {
    redirect(`/portal/invoices/${id}`);
  }

  const invoice = await getInvoiceById(id);
  if (!invoice) {
    notFound();
  }

  return (
    <AdminShell userSession={session}>
      <InvoiceDetail invoice={invoice} portalMode={false} />
    </AdminShell>
  );
}
