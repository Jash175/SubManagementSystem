import { NextResponse } from "next/server";
import { getCurrentUserSession } from "@/features/auth/guards";
import { createQuotationFromTemplateAction } from "@/features/quotations/actions";
import type { CreateQuotationFromTemplateInput } from "@/features/quotations/schemas";

export async function POST(request: Request) {
  const session = await getCurrentUserSession();
  if (!session || (session.role !== "admin" && session.role !== "staff")) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Staff or Admin access required to create quotations." } },
      { status: 403 }
    );
  }

  try {
    const body = (await request.json()) as CreateQuotationFromTemplateInput;
    const result = await createQuotationFromTemplateAction(body);

    if (!result.success) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: result.error || "Failed to create quotation from template." } },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { data: result.data, meta: { requestId: crypto.randomUUID() } },
      { status: 201 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Invalid JSON payload.";
    return NextResponse.json(
      { error: { code: "BAD_REQUEST", message } },
      { status: 400 }
    );
  }
}
