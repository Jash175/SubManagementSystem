import { NextResponse } from "next/server";
import { getCurrentUserSession } from "@/features/auth/guards";
import { getFinancialMetrics } from "@/features/dashboard/services";

export async function GET(request: Request) {
  const session = await getCurrentUserSession();
  if (!session) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Sign in required." } },
      { status: 401 }
    );
  }

  if (session.role !== "admin" && session.role !== "staff") {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Only staff or admin can view financial summary reports." } },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(request.url);
  const fromDate = searchParams.get("fromDate") || undefined;
  const toDate = searchParams.get("toDate") || undefined;
  const customerId = searchParams.get("customerId") || undefined;

  const metrics = await getFinancialMetrics({
    fromDate,
    toDate,
    customerId,
  });

  return NextResponse.json({
    data: metrics,
    meta: { requestId: crypto.randomUUID() },
  });
}
