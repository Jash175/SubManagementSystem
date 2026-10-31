import { NextResponse } from "next/server";
import { getCurrentUserSession } from "@/features/auth/guards";
import { getInvoices } from "@/features/billing/services";
import { formatDateUTC } from "@/features/subscriptions/lifecycle";

export async function GET() {
  const session = await getCurrentUserSession();
  if (!session) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Sign in required." } },
      { status: 401 }
    );
  }

  if (session.role !== "admin" && session.role !== "staff") {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Only staff or admin can view overdue reports." } },
      { status: 403 }
    );
  }

  const today = formatDateUTC(new Date());
  const allInvoices = await getInvoices();

  const overdueInvoices = allInvoices.filter(
    (inv) =>
      (inv.status === "confirmed" || inv.status === "partially_paid") &&
      inv.balanceDue > 0 &&
      inv.dueDate < today
  );

  return NextResponse.json({
    data: overdueInvoices,
    meta: {
      total: overdueInvoices.length,
      requestId: crypto.randomUUID(),
    },
  });
}
