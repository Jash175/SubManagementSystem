import { NextResponse } from "next/server";
import { getCurrentUserSession } from "@/features/auth/guards";

export async function GET() {
  const session = await getCurrentUserSession();

  if (!session) {
    return NextResponse.json(
      {
        error: {
          code: "UNAUTHENTICATED",
          message: "No active authenticated session",
        },
      },
      { status: 401 }
    );
  }

  return NextResponse.json({
    data: {
      user: {
        id: session.id,
        email: session.email,
        fullName: session.fullName,
        role: session.role,
        customer: session.customer,
      },
    },
  });
}
