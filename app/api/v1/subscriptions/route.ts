import { NextResponse } from "next/server";
import { getCurrentUserSession } from "@/features/auth/guards";
import { getSubscriptions } from "@/features/subscriptions/services";
import type { SubscriptionStatus } from "@/types";

export async function GET(request: Request) {
  const session = await getCurrentUserSession();
  if (!session) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Sign in required." } },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const statusParam = searchParams.get("status") as SubscriptionStatus | "all" | null;
  const q = searchParams.get("q") || undefined;

  let customerId: string | undefined = undefined;

  if (session.role === "customer") {
    if (!session.customer) {
      return NextResponse.json({
        data: [],
        meta: { total: 0, requestId: crypto.randomUUID() },
      });
    }
    // Strict isolation: Customer can only view own subscriptions
    customerId = session.customer.id;
  } else {
    // Staff/Admin can optionally filter by customer
    const filterCust = searchParams.get("customerId");
    if (filterCust) customerId = filterCust;
  }

  const subscriptions = await getSubscriptions({
    customerId,
    status: statusParam || "all",
    search: q,
  });

  return NextResponse.json({
    data: subscriptions,
    meta: {
      total: subscriptions.length,
      requestId: crypto.randomUUID(),
    },
  });
}
