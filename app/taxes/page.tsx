import * as React from "react";
import { requireStaffOrAdmin } from "@/features/auth/guards";
import { AdminShell } from "@/components/layout/admin-shell";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { getTaxes } from "@/features/taxes/services";
import { TaxList } from "@/features/taxes/components/tax-list";

export const instant = false;

export default async function TaxesPage() {
  const session = await requireStaffOrAdmin();
  const isAdmin = session.role === "admin";

  const taxes = await getTaxes({ includeArchived: true });

  return (
    <AdminShell userSession={session}>
      <PageHeader
        heading="Tax Rules"
        subheading="Configure percentage tax rates attached to products and recurring plan base fees."
      >
        <Badge variant="outline" className="text-xs font-normal">
          Phase 2 Active
        </Badge>
      </PageHeader>

      <TaxList initialTaxes={taxes} isAdmin={isAdmin} />
    </AdminShell>
  );
}
