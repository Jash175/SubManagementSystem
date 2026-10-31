import * as React from "react";
import { requireStaffOrAdmin } from "@/features/auth/guards";
import { AdminShell } from "@/components/layout/admin-shell";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { getProducts } from "@/features/products/services";
import { getTaxes } from "@/features/taxes/services";
import { ProductList } from "@/features/products/components/product-list";

export const instant = false;

export default async function ProductsPage() {
  const session = await requireStaffOrAdmin();
  const isAdmin = session.role === "admin";

  const [products, taxes] = await Promise.all([
    getProducts({ includeArchived: true }),
    getTaxes({ includeArchived: false }),
  ]);

  return (
    <AdminShell userSession={session}>
      <PageHeader
        heading="Products &amp; Variants"
        subheading="Manage sellable catalogue items, attribute variants with price deltas, and associated taxes."
      >
        <Badge variant="outline" className="text-xs font-normal">
          Phase 2 Active
        </Badge>
      </PageHeader>

      <ProductList
        initialProducts={products}
        availableTaxes={taxes}
        isAdmin={isAdmin}
      />
    </AdminShell>
  );
}
