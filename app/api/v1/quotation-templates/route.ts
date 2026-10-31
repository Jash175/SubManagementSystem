import { NextResponse } from "next/server";
import { getCurrentUserSession } from "@/features/auth/guards";
import { getQuotationTemplates } from "@/features/quotations/services";
import { createQuotationTemplateAction } from "@/features/quotations/actions";

export async function GET(request: Request) {
  const session = await getCurrentUserSession();
  if (!session || (session.role !== "admin" && session.role !== "staff")) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Staff or Admin access required." } },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(request.url);
  const includeArchived = searchParams.get("includeArchived") === "true";

  const templates = await getQuotationTemplates({ includeArchived });

  return NextResponse.json({
    data: templates,
    meta: {
      total: templates.length,
      requestId: crypto.randomUUID(),
    },
  });
}

export async function POST(request: Request) {
  const session = await getCurrentUserSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Only administrators can configure quotation templates." } },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const result = await createQuotationTemplateAction(body);

    if (!result.success) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: result.error || "Failed to create template." } },
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
