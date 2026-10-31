import * as React from "react";
import { requireStaffOrAdmin } from "@/features/auth/guards";
import { AdminShell } from "@/components/layout/admin-shell";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { getPlans } from "@/features/plans/services";
import { getTaxes } from "@/features/taxes/services";
import { PlanList } from "@/features/plans/components/plan-list";

export const instant = false;

export default async function PlansPage() {
  const session = await requireStaffOrAdmin();
  const isAdmin = session.role === "admin";

  const [plans, taxes] = await Promise.all([
    getPlans({ includeArchived: true }),
    getTaxes({ includeArchived: false }),
  ]);

  return (
    <AdminShell userSession={session}>
      <PageHeader
        heading="Subscription Plans"
        subheading="Configure recurring billing frequencies, minimum order quantities, availability dates, and lifecycle policies."
      >
        <Badge variant="outline" className="text-xs font-normal">
          Phase 2 Active
        </Badge>
      </PageHeader>

      <PlanList
        initialPlans={plans}
        availableTaxes={taxes}
        isAdmin={isAdmin}
      />
    </AdminShell>
  );
}
