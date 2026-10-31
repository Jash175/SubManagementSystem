import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUserSession } from "@/features/auth/guards";
import { createStaffAccountAction } from "@/features/auth/actions";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const session = await getCurrentUserSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json(
      {
        error: {
          code: "FORBIDDEN",
          message: "Only administrators can view internal staff records",
        },
      },
      { status: 403 }
    );
  }

  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    return NextResponse.json(
      {
        error: {
          code: "CONFIGURATION_ERROR",
          message: "Supabase service-role key is not configured",
        },
      },
      { status: 503 }
    );
  }

  const { data: staffList, error } = await adminClient
    .from("profiles")
    .select("id, email, full_name, role, is_active, created_at")
    .in("role", ["staff", "admin"])
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: { code: "QUERY_ERROR", message: error.message } },
      { status: 500 }
    );
  }

  return NextResponse.json({
    data: {
      staff: staffList,
    },
  });
}

export async function POST(req: NextRequest) {
  const session = await getCurrentUserSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json(
      {
        error: {
          code: "FORBIDDEN",
          message: "Only administrators can create staff accounts",
        },
      },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const result = await createStaffAccountAction(body);

    if (!result.success) {
      return NextResponse.json(
        {
          error: {
            code: "ACTION_FAILED",
            message: result.error || "Failed to create staff account",
          },
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        data: {
          message: result.message,
        },
      },
      { status: 201 }
    );
  } catch {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_BODY",
          message: "Malformed JSON payload",
        },
      },
      { status: 400 }
    );
  }
}
