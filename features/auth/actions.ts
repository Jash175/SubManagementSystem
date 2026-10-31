"use server";

import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  loginSchema,
  registerSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  createStaffSchema,
  type LoginInput,
  type RegisterInput,
  type ForgotPasswordInput,
  type ResetPasswordInput,
  type CreateStaffInput,
} from "./schemas";
import { getCurrentUserSession } from "./guards";
import type { AuthActionResult, UserRole } from "@/types";

/**
 * Server Action: Log in user with email and password
 */
export async function loginAction(
  input: LoginInput
): Promise<AuthActionResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message || "Invalid input data",
    };
  }

  const supabase = await getSupabaseServerClient();
  if (!supabase) {
    return {
      success: false,
      error:
        "Supabase credentials are not configured in this environment. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local to enable live sign-in.",
    };
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error || !data.user) {
    return {
      success: false,
      error: error?.message || "Invalid email or password",
    };
  }

  // Fetch verified profile role from database
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_active, full_name, email")
    .eq("id", data.user.id)
    .single();

  if (profile && !profile.is_active) {
    await supabase.auth.signOut();
    return {
      success: false,
      error: "This account has been deactivated. Please contact an administrator.",
    };
  }

  const role = (profile?.role as UserRole) || "customer";

  // If customer role, ensure customer account and mapping exist in database
  if (role === "customer") {
    const { data: cu } = await supabase
      .from("customer_users")
      .select("customer_id")
      .eq("user_id", data.user.id)
      .maybeSingle();

    if (!cu) {
      try {
        await supabase.rpc("create_customer_account", {
          p_legal_name: (profile?.full_name as string) || (data.user.user_metadata?.full_name as string) || "Subscriber",
          p_email: data.user.email || profile?.email || "",
          p_company_name: (data.user.user_metadata?.company_name as string) || null,
        });
      } catch (err) {
        console.warn("[loginAction] Auto customer account provisioning notice:", err);
      }
    }
  }

  const redirectTo = role === "customer" ? "/portal" : "/";

  return {
    success: true,
    redirectTo,
  };
}

/**
 * Server Action: Register a new customer
 */
export async function registerCustomerAction(
  input: RegisterInput
): Promise<AuthActionResult> {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message || "Invalid input data",
    };
  }

  const supabase = await getSupabaseServerClient();
  if (!supabase) {
    return {
      success: false,
      error:
        "Supabase credentials are not configured in this environment. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local to enable registration.",
    };
  }

  // Sign up via Supabase Auth
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: {
        full_name: parsed.data.fullName,
        company_name: parsed.data.companyName || null,
      },
    },
  });

  if (error) {
    return {
      success: false,
      error: error.message,
    };
  }

  if (!data.user) {
    return {
      success: false,
      error: "Unable to complete registration. Please try again.",
    };
  }

  // If session is immediately available, initialize customer record
  if (data.session) {
    try {
      await supabase.rpc("create_customer_account", {
        p_legal_name: parsed.data.fullName,
        p_email: parsed.data.email,
        p_company_name: parsed.data.companyName || null,
      });
    } catch {
      // RPC will execute when the customer first logs in if email confirmation is required
    }

    return {
      success: true,
      redirectTo: "/portal",
    };
  }

  // Email confirmation required flow
  return {
    success: true,
    message:
      "Account registered successfully! If email confirmation is enabled on your Supabase project, please check your inbox to activate your account.",
    redirectTo: "/login",
  };
}

/**
 * Server Action: Request password reset link
 *
 * CRITICAL SECURITY INVARIANT:
 * Never leak whether an arbitrary email address exists in the database.
 */
export async function forgotPasswordAction(
  input: ForgotPasswordInput
): Promise<AuthActionResult> {
  const parsed = forgotPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message || "Invalid email address",
    };
  }

  const supabase = await getSupabaseServerClient();
  if (!supabase) {
    return {
      success: false,
      error:
        "Supabase credentials are not configured in this environment. Please configure environment variables in .env.local.",
    };
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  // Trigger Supabase reset email
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${appUrl}/reset-password`,
  });

  // Always return identical success message to prevent user enumeration
  return {
    success: true,
    message:
      "If an account is associated with that email address, you will receive password reset instructions shortly.",
  };
}

/**
 * Server Action: Reset password with authenticated recovery token
 */
export async function resetPasswordAction(
  input: ResetPasswordInput
): Promise<AuthActionResult> {
  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message || "Invalid password",
    };
  }

  const supabase = await getSupabaseServerClient();
  if (!supabase) {
    return {
      success: false,
      error: "Supabase credentials are not configured in this environment.",
    };
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });

  if (error) {
    return {
      success: false,
      error: error.message || "Failed to update password. Your reset link may have expired.",
    };
  }

  return {
    success: true,
    message: "Your password has been successfully reset. You may now log in.",
    redirectTo: "/login",
  };
}

/**
 * Server Action: Log out
 */
export async function logoutAction(): Promise<void> {
  const supabase = await getSupabaseServerClient();
  if (supabase) {
    await supabase.auth.signOut();
  }
  redirect("/login");
}

/**
 * Server Action: Admin creates a new staff account
 *
 * CRITICAL SECURITY INVARIANT:
 * - Only verified administrators can execute this.
 * - Uses server-only Supabase admin client with service-role key.
 * - Service-role key is never exposed to client.
 */
export async function createStaffAccountAction(
  input: CreateStaffInput
): Promise<AuthActionResult> {
  // 1. Verify caller has admin role
  const session = await getCurrentUserSession();
  if (!session || session.role !== "admin") {
    return {
      success: false,
      error: "Unauthorized: Only administrators can create internal staff accounts.",
    };
  }

  // 2. Validate input
  const parsed = createStaffSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message || "Invalid input data",
    };
  }

  // 3. Obtain admin client
  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    return {
      success: false,
      error:
        "Supabase service-role key (SUPABASE_SERVICE_ROLE_KEY) is not configured in this environment.",
    };
  }

  // 4. Create user via Supabase Auth Admin
  const { data: newUser, error: createError } =
    await adminClient.auth.admin.createUser({
      email: parsed.data.email,
      password: parsed.data.password,
      email_confirm: true,
      user_metadata: {
        full_name: parsed.data.fullName,
      },
    });

  if (createError || !newUser.user) {
    return {
      success: false,
      error: createError?.message || "Failed to create staff account.",
    };
  }

  // 5. Explicitly assign 'staff' role in profiles table
  const { error: profileError } = await adminClient
    .from("profiles")
    .upsert({
      id: newUser.user.id,
      email: parsed.data.email,
      full_name: parsed.data.fullName,
      role: "staff",
      is_active: true,
      updated_at: new Date().toISOString(),
    });

  if (profileError) {
    return {
      success: false,
      error: "User was created but role assignment failed: " + profileError.message,
    };
  }

  return {
    success: true,
    message: `Staff account for ${parsed.data.fullName} (${parsed.data.email}) created successfully.`,
  };
}
