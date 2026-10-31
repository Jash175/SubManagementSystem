import * as React from "react";
import { requireAdmin } from "@/features/auth/guards";
import { AdminShell } from "@/components/layout/admin-shell";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CreateStaffForm } from "@/features/auth/components/create-staff-form";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { ShieldAlert, Users, CheckCircle2, AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export const instant = false;

export default async function StaffManagementPage() {
  const session = await requireAdmin();

  const adminClient = getSupabaseAdminClient();
  let staffMembers: {
    id: string;
    email: string;
    full_name: string;
    role: string;
    is_active: boolean;
    created_at: string;
  }[] = [];

  const isConfigured = Boolean(adminClient);

  if (adminClient) {
    const { data } = await adminClient
      .from("profiles")
      .select("id, email, full_name, role, is_active, created_at")
      .in("role", ["admin", "staff"])
      .order("created_at", { ascending: false });

    if (data) {
      staffMembers = data;
    }
  }

  return (
    <AdminShell userSession={session}>
      <PageHeader
        heading="Internal Staff Management"
        subheading="Manage internal team accounts with operational access to Brightloop."
      >
        <Badge variant="default" className="text-xs">
          Admin Role Required
        </Badge>
      </PageHeader>

      <div className="space-y-6">
        {!isConfigured && (
          <Alert variant="warning">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Admin Credentials Notice</AlertTitle>
            <AlertDescription>
              To provision staff accounts, configure <code className="font-mono text-[11px] bg-amber-100 dark:bg-amber-900/50 px-1 py-0.5 rounded">SUPABASE_SERVICE_ROLE_KEY</code> in <code className="font-mono text-[11px]">.env.local</code>. The service-role key is server-only and is never sent to the browser.
            </AlertDescription>
          </Alert>
        )}

        {/* Security Invariant Info Banner */}
        <div className="flex items-start gap-3 p-4 rounded-lg bg-primary/5 border border-primary/20 text-xs">
          <ShieldAlert className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-foreground">
              Security Boundary: Admin-Only Staff Creation
            </p>
            <p className="text-muted-foreground leading-relaxed">
              Internal staff accounts cannot be registered publicly. Only active Administrators can provision staff accounts using server-side elevated privileges. Users cannot modify or elevate their own roles.
            </p>
          </div>
        </div>

        {/* Create Staff Form */}
        <CreateStaffForm />

        {/* Existing Staff Roster */}
        <Card className="border-border/80">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-base font-semibold">
                  Active Internal Accounts
                </CardTitle>
              </div>
              <Badge variant="outline" className="text-xs font-normal">
                {staffMembers.length} Accounts
              </Badge>
            </div>
            <CardDescription className="text-xs text-muted-foreground">
              Internal users with administrative or staff privileges.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {staffMembers.length === 0 ? (
              <div className="rounded-md bg-muted/20 p-6 text-center border border-dashed text-xs text-muted-foreground">
                No secondary staff accounts registered yet. Use the form above to provision your first staff account.
              </div>
            ) : (
              <div className="divide-y border rounded-md">
                {staffMembers.map((member) => (
                  <div
                    key={member.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 gap-2 text-xs"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground">
                          {member.full_name || "Unnamed"}
                        </span>
                        <Badge
                          variant={member.role === "admin" ? "default" : "secondary"}
                          className="text-[10px] uppercase font-bold"
                        >
                          {member.role}
                        </Badge>
                        {member.is_active && (
                          <span className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                            <CheckCircle2 className="h-3 w-3" />
                            Active
                          </span>
                        )}
                      </div>
                      <p className="text-muted-foreground font-mono text-[11px]">
                        {member.email}
                      </p>
                    </div>

                    <div className="text-muted-foreground text-[11px]">
                      Created: {new Date(member.created_at).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminShell>
  );
}
