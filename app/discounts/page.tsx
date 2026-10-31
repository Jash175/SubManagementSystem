import * as React from "react";
import { requireStaffOrAdmin } from "@/features/auth/guards";
import { AdminShell } from "@/components/layout/admin-shell";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { getDiscounts } from "@/features/discounts/services";
import { getProducts } from "@/features/products/services";
import { DiscountList } from "@/features/discounts/components/discount-list";

export const instant = false;

export default async function DiscountsPage() {
  const session = await requireStaffOrAdmin();
  const isAdmin = session.role === "admin";

  const [discounts, products] = await Promise.all([
    getDiscounts({ includeArchived: true }),
    getProducts({ includeArchived: false }),
  ]);

  return (
    <AdminShell userSession={session}>
      <PageHeader
        heading="Discount Rules"
        subheading="Configure promotional discount rules with eligibility criteria, usage caps, and product/subscription scopes."
      >
        <Badge variant="outline" className="text-xs font-normal">
          Phase 2 Active
        </Badge>
      </PageHeader>

      <DiscountList
        initialDiscounts={discounts}
        availableProducts={products}
        isAdmin={isAdmin}
      />
    </AdminShell>
  );
}
