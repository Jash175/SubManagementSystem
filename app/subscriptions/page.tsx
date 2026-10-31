import * as React from "react";
import { requireStaffOrAdmin } from "@/features/auth/guards";
import { AdminShell } from "@/components/layout/admin-shell";
import { PageHeader } from "@/components/shared/page-header";
import { SubscriptionList } from "@/features/subscriptions/components/subscription-list";
import { getSubscriptions } from "@/features/subscriptions/services";
import { Badge } from "@/components/ui/badge";

export const instant = false;

export default async function SubscriptionsPage() {
  const session = await requireStaffOrAdmin();

  // Load all subscriptions
  const subscriptions = await getSubscriptions();

  const activeCount = subscriptions.filter((s) => s.status === "active").length;

  return (
    <AdminShell userSession={session}>
      <PageHeader
        heading="Customer Subscriptions"
        subheading="Monitor active recurring subscriptions, manage lifecycle status transitions, and inspect billing anchor dates."
      >
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="font-mono text-xs">
            {activeCount} Active
          </Badge>
          <Badge variant="default" className="text-xs">
            {subscriptions.length} Total Records
          </Badge>
        </div>
      </PageHeader>

      <SubscriptionList
        subscriptions={subscriptions}
        userRole={session.role}
      />
    </AdminShell>
  );
}
