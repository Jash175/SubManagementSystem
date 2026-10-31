import { NextResponse } from "next/server";
import { getCurrentUserSession } from "@/features/auth/guards";
import { confirmInvoiceAction } from "@/features/billing/actions";

export async function POST(
  _request: Request,
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
      { error: { code: "FORBIDDEN", message: "Only staff or admin can confirm invoices." } },
      { status: 403 }
    );
  }

  const { id } = await params;
  const result = await confirmInvoiceAction({ invoiceId: id });

  if (!result.success) {
    return NextResponse.json(
      { error: { code: "CONFIRMATION_FAILED", message: result.error } },
      { status: 400 }
    );
  }

  return NextResponse.json({
    data: { confirmed: true },
    meta: { requestId: crypto.randomUUID() },
  });
}
