import { NextResponse } from "next/server";
import { getCurrentUserSession } from "@/features/auth/guards";
import {
  sendQuotationAction,
  confirmSubscriptionAction,
  activateSubscriptionAction,
  pauseSubscriptionAction,
  resumeSubscriptionAction,
  closeSubscriptionAction,
  renewSubscriptionAction,
} from "@/features/subscriptions/actions";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; action: string }> }
) {
  const session = await getCurrentUserSession();
  if (!session) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Sign in required." } },
      { status: 401 }
    );
  }

  const { id, action } = await params;
  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }

  let result: { success: boolean; error?: string; data?: unknown };

  switch (action) {
    case "send-quotation":
      result = await sendQuotationAction(id);
      break;

    case "confirm":
      result = await confirmSubscriptionAction(id);
      break;

    case "activate":
      result = await activateSubscriptionAction(id);
      break;

    case "pause":
      result = await pauseSubscriptionAction(
        id,
        typeof body.note === "string" ? body.note : undefined
      );
      break;

    case "resume":
      result = await resumeSubscriptionAction(
        id,
        typeof body.note === "string" ? body.note : undefined
      );
      break;

    case "close":
      result = await closeSubscriptionAction(
        id,
        typeof body.reason === "string" ? body.reason : undefined
      );
      break;

    case "renew":
      result = await renewSubscriptionAction(id);
      break;

    default:
      return NextResponse.json(
        { error: { code: "INVALID_ACTION", message: `Unknown lifecycle action: ${action}` } },
        { status: 400 }
      );
  }

  if (!result.success) {
    return NextResponse.json(
      { error: { code: "STATE_CONFLICT", message: result.error || "Action failed." } },
      { status: 400 }
    );
  }

  return NextResponse.json({
    data: result.data || { status: "success" },
    meta: { requestId: crypto.randomUUID() },
  });
}
