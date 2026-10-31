import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let adminClientInstance: SupabaseClient | null = null;

/**
 * Returns a server-only Supabase client with the service role key.
 * Used exclusively for administrative operations like creating/inviting staff
 * and managing user roles.
 *
 * CRITICAL SECURITY INVARIANT:
 * Never expose this client or SUPABASE_SERVICE_ROLE_KEY to the browser or client components.
 */
export function getSupabaseAdminClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    return null;
  }

  if (!adminClientInstance) {
    adminClientInstance = createClient(url, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  return adminClientInstance;
}
