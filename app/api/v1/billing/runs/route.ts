import { NextResponse } from "next/server";
import { getCurrentUserSession } from "@/features/auth/guards";
import { getBillingRuns } from "@/features/billing/services";

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
      { error: { code: "FORBIDDEN", message: "Only staff or admin can view billing execution history." } },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(request.url);
  const limitParam = searchParams.get("limit");
  const limit = limitParam ? parseInt(limitParam, 10) : 50;

  const runs = await getBillingRuns({ limit });

  return NextResponse.json({
    data: runs,
    meta: {
      total: runs.length,
      requestId: crypto.randomUUID(),
    },
  });
}
