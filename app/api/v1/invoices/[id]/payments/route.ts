import { NextResponse } from "next/server";
import { getCurrentUserSession } from "@/features/auth/guards";
import { recordPaymentAction } from "@/features/payments/actions";
import type { PaymentMethod } from "@/types";

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
      { error: { code: "FORBIDDEN", message: "Only staff or admin can record payments." } },
      { status: 403 }
    );
  }

  const { id } = await params;
  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { error: { code: "BAD_REQUEST", message: "Invalid JSON body." } },
      { status: 400 }
    );
  }

  const result = await recordPaymentAction({
    invoiceId: id,
    amount: Number(body.amount),
    paymentMethod: body.paymentMethod as PaymentMethod,
    paidAt: typeof body.paidAt === "string" ? body.paidAt : undefined,
    referenceNumber: typeof body.referenceNumber === "string" ? body.referenceNumber : undefined,
    note: typeof body.note === "string" ? body.note : undefined,
  });

  if (!result.success) {
    return NextResponse.json(
      { error: { code: "PAYMENT_FAILED", message: result.error } },
      { status: 400 }
    );
  }

  return NextResponse.json(
    {
      data: result.data,
      meta: { requestId: crypto.randomUUID() },
    },
    { status: 201 }
  );
}
