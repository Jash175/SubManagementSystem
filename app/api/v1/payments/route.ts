import { NextResponse } from "next/server";
import { getCurrentUserSession } from "@/features/auth/guards";
import { getPayments } from "@/features/payments/services";

export async function GET(request: Request) {
  const session = await getCurrentUserSession();
  if (!session) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Sign in required." } },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const invoiceId = searchParams.get("invoiceId") || undefined;
  const limitParam = searchParams.get("limit");
  const limit = limitParam ? parseInt(limitParam, 10) : undefined;

  let customerId: string | undefined = undefined;

  if (session.role === "customer") {
    if (!session.customer) {
      return NextResponse.json({
        data: [],
        meta: { total: 0, requestId: crypto.randomUUID() },
      });
    }
    // Strict isolation: Customer can only view own payments
    customerId = session.customer.id;
  } else {
    // Staff/Admin can optionally filter by customer
    const filterCust = searchParams.get("customerId");
    if (filterCust) customerId = filterCust;
  }

  const payments = await getPayments({
    customerId,
    invoiceId,
    limit,
  });

  return NextResponse.json({
    data: payments,
    meta: {
      total: payments.length,
      requestId: crypto.randomUUID(),
    },
  });
}
