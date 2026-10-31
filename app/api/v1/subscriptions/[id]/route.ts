import { NextResponse } from "next/server";
import { getCurrentUserSession } from "@/features/auth/guards";
import { getSubscriptionById } from "@/features/subscriptions/services";

export async function GET(
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

  const { id } = await params;

  let customerId: string | undefined = undefined;
  if (session.role === "customer") {
    if (!session.customer) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Subscription not found." } },
        { status: 404 }
      );
    }
    customerId = session.customer.id;
  }

  const subscription = await getSubscriptionById(id, customerId);

  if (!subscription) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Subscription not found or access denied." } },
      { status: 404 }
    );
  }

  return NextResponse.json({
    data: subscription,
    meta: { requestId: crypto.randomUUID() },
  });
}
