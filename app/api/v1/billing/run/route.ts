import { NextResponse } from "next/server";
import { getCurrentUserSession } from "@/features/auth/guards";
import { runDueBillingAction } from "@/features/billing/actions";

export async function POST(request: Request) {
  const session = await getCurrentUserSession();
  if (!session) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Sign in required." } },
      { status: 401 }
    );
  }

  if (session.role !== "admin" && session.role !== "staff") {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Only staff or admin can trigger billing runs." } },
      { status: 403 }
    );
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {}

  const result = await runDueBillingAction({
    asOfDate: typeof body.asOfDate === "string" ? body.asOfDate : undefined,
    triggerSource: body.triggerSource === "scheduled" || body.triggerSource === "retry" ? body.triggerSource : "manual",
    autoConfirm: Boolean(body.autoConfirm),
    subscriptionIds: Array.isArray(body.subscriptionIds) ? (body.subscriptionIds as string[]) : undefined,
  });

  if (!result.success) {
    return NextResponse.json(
      { error: { code: "BILLING_RUN_FAILED", message: result.error } },
      { status: 500 }
    );
  }

  return NextResponse.json({
    data: result.data,
    meta: { requestId: crypto.randomUUID() },
  });
}
