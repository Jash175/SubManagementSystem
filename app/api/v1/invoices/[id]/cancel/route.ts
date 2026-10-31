import { NextResponse } from "next/server";
import { getCurrentUserSession } from "@/features/auth/guards";
import { cancelInvoiceAction } from "@/features/billing/actions";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getCurrentUserSession();
  if (!session) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Sign in required." } },
      { status: 401 }
    );
  }

  if (session.role !== "admin" && session.role !== "staff") {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Only staff or admin can cancel invoices." } },
      { status: 403 }
    );
  }

  const { id } = await params;
  let reason: string | undefined = undefined;
  try {
    const body = await request.json();
    reason = body.reason;
  } catch {}

  const result = await cancelInvoiceAction({ invoiceId: id, reason });

  if (!result.success) {
    return NextResponse.json(
      { error: { code: "CANCELLATION_FAILED", message: result.error } },
      { status: 400 }
    );
  }

  return NextResponse.json({
    data: { cancelled: true },
    meta: { requestId: crypto.randomUUID() },
  });
}
