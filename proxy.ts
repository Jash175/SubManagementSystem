import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

interface CookieToSet {
  name: string;
  value: string;
  options?: Record<string, unknown>;
}

/**
 * Next.js 16 Proxy for session cookie refresh and route-level protection.
 *
 * CRITICAL RELIABILITY INVARIANT:
 * If Supabase environment variables are not configured, pass through gracefully
 * so that the application remains runnable offline or in scaffolding mode.
 */
export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const { pathname } = request.nextUrl;

  // If Supabase is not configured, permit request flow without crashing
  if (!url || !key) {
    return NextResponse.next();
  }

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        response = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options as never)
        );
      },
    },
  });

  // Refresh session by retrieving current user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isProtectedAdminOrStaffPage =
    pathname === "/" ||
    pathname.startsWith("/products") ||
    pathname.startsWith("/plans") ||
    pathname.startsWith("/quotations") ||
    pathname.startsWith("/subscriptions") ||
    pathname.startsWith("/billing") ||
    pathname.startsWith("/payments") ||
    pathname.startsWith("/discounts") ||
    pathname.startsWith("/staff") ||
    pathname.startsWith("/settings");

  const isProtectedCustomerPortal = pathname.startsWith("/portal");

  // If user is not authenticated and attempts to access protected routes
  if (!user && (isProtectedAdminOrStaffPage || isProtectedCustomerPortal)) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
