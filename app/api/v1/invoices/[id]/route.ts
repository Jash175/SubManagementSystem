import { NextResponse } from "next/server";
import { getCurrentUserSession } from "@/features/auth/guards";
import { getInvoiceById } from "@/features/billing/services";

export async function GET(
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

  const { id } = await params;
  let customerId: string | undefined = undefined;

  if (session.role === "customer") {
    if (!session.customer) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "No customer account linked." } },
        { status: 403 }
      );
    }
    customerId = session.customer.id;
  }

  const invoice = await getInvoiceById(id, { customerId });
  if (!invoice) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Invoice not found or access denied." } },
      { status: 404 }
    );
  }

  return NextResponse.json({
    data: invoice,
    meta: { requestId: crypto.randomUUID() },
  });
}
