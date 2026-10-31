import "server-only";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { UserRole, UserSession } from "@/types";

/**
 * Retrieves the current authenticated user session verified against
 * the database-backed profiles table.
 *
 * CRITICAL SECURITY INVARIANT:
 * Never trust roles from client-side cookies or user metadata.
 * The role must always be verified from the server-side database query on public.profiles.
 */
export async function getCurrentUserSession(): Promise<UserSession | null> {
  await connection();
  const supabase = await getSupabaseServerClient();
  if (!supabase) {
    return null;
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return null;
  }

  // Fetch verified profile from database
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, is_active")
    .eq("id", user.id)
    .single();

  if (profileError || !profile || !profile.is_active) {
    // If auth user exists but profile not yet synced or inactive, fallback to unprivileged customer
    return {
      id: user.id,
      email: user.email || "",
      role: "customer",
      fullName: (user.user_metadata?.full_name as string) || "",
      customer: null,
    };
  }

  const role = (profile.role as UserRole) || "customer";

  // If customer, fetch linked customer profile
  let customerInfo = null;
  if (role === "customer") {
    const { data: customerUser } = await supabase
      .from("customer_users")
      .select("customer_id, customers ( id, customer_code, legal_name, company_name, email, phone, currency_code, is_active )")
      .eq("user_id", user.id)
      .maybeSingle();

    if (customerUser && customerUser.customers) {
      const c = Array.isArray(customerUser.customers)
        ? customerUser.customers[0]
        : customerUser.customers;

      customerInfo = {
        id: c.id,
        customerCode: c.customer_code,
        legalName: c.legal_name,
        companyName: c.company_name,
        email: c.email,
        phone: c.phone,
        currencyCode: c.currency_code,
        isActive: c.is_active,
      };
    }
  }

  return {
    id: profile.id,
    email: profile.email,
    role,
    fullName: profile.full_name,
    customer: customerInfo,
  };
}

/**
 * Server guard requiring an authenticated session.
 * Redirects to /login if no valid session exists.
 */
export async function requireAuth(redirectTo = "/login"): Promise<UserSession> {
  const session = await getCurrentUserSession();
  if (!session) {
    redirect(redirectTo);
  }
  return session;
}

/**
 * Server guard requiring specific roles.
 * Directs customers to /portal and staff to / if unauthorized.
 */
export async function requireRole(allowedRoles: UserRole[]): Promise<UserSession> {
  const session = await requireAuth();

  if (!allowedRoles.includes(session.role)) {
    if (session.role === "customer") {
      redirect("/portal");
    } else {
      redirect("/");
    }
  }

  return session;
}

/**
 * Server guard: Admin only.
 */
export async function requireAdmin(): Promise<UserSession> {
  return requireRole(["admin"]);
}

/**
 * Server guard: Staff or Admin.
 */
export async function requireStaffOrAdmin(): Promise<UserSession> {
  return requireRole(["admin", "staff"]);
}
