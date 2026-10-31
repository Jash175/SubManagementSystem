import { NextResponse } from "next/server";
import { getCurrentUserSession } from "@/features/auth/guards";
import { getInvoices } from "@/features/billing/services";
import type { InvoiceStatus } from "@/types";

export async function GET(request: Request) {
  const session = await getCurrentUserSession();
  if (!session) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Sign in required." } },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const statusParam = searchParams.get("status") as InvoiceStatus | null;
  const q = searchParams.get("q") || undefined;
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
    // Strict customer isolation
    customerId = session.customer.id;
  } else {
    // Staff/Admin can optionally filter by customer
    const filterCust = searchParams.get("customerId");
    if (filterCust) customerId = filterCust;
  }

  const invoices = await getInvoices({
    customerId,
    status: statusParam || undefined,
    search: q,
    limit,
  });

  return NextResponse.json({
    data: invoices,
    meta: {
      total: invoices.length,
      requestId: crypto.randomUUID(),
    },
  });
}
