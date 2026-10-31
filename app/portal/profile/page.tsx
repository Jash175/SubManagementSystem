import * as React from "react";
import { redirect } from "next/navigation";
import { getCurrentUserSession } from "@/features/auth/guards";
import { CustomerShell } from "@/components/layout/customer-shell";
import { PageHeader } from "@/components/shared/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  User,
  Building,
  Mail,
  Phone,
  MapPin,
  ShieldCheck,
  CreditCard,
  Key,
  CheckCircle2,
} from "lucide-react";
import { getCustomerProfile } from "@/features/portal/services";

export const instant = false;

export default async function CustomerProfilePage() {
  const session = await getCurrentUserSession();
  if (!session) {
    redirect("/login?redirectTo=/portal/profile");
  }

  const customerId = session.customer?.id;
  const profile = customerId ? await getCustomerProfile(customerId) : null;

  return (
    <CustomerShell userSession={session}>
      <div className="space-y-6">
        <PageHeader
          heading="Subscriber Profile &amp; Account Settings"
          subheading="Inspect your registered customer organization profile, billing address, and account permissions."
        >
          <div className="flex items-center gap-2">
            {profile?.customerCode && (
              <Badge variant="outline" className="font-mono text-xs">
                {profile.customerCode}
              </Badge>
            )}
            <Badge variant="success" className="text-xs">
              Verified Subscriber
            </Badge>
          </div>
        </PageHeader>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Account Profile Card */}
          <Card className="lg:col-span-2 border-border/80">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Building className="h-4 w-4 text-primary" />
                Customer Account Information
              </CardTitle>
              <CardDescription className="text-xs">
                Legal and organizational identity registered with Brightloop
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-3 bg-muted/30 rounded-lg border">
                  <div className="flex items-center gap-2 text-muted-foreground text-[11px] mb-1">
                    <User className="h-3.5 w-3.5" />
                    <span>Legal / Registered Name</span>
                  </div>
                  <p className="font-semibold text-sm text-foreground">
                    {profile?.legalName || session.fullName || "Subscriber"}
                  </p>
                </div>

                <div className="p-3 bg-muted/30 rounded-lg border">
                  <div className="flex items-center gap-2 text-muted-foreground text-[11px] mb-1">
                    <Building className="h-3.5 w-3.5" />
                    <span>Company / Business Name</span>
                  </div>
                  <p className="font-semibold text-sm text-foreground">
                    {profile?.companyName || "Individual / Self-Employed"}
                  </p>
                </div>

                <div className="p-3 bg-muted/30 rounded-lg border">
                  <div className="flex items-center gap-2 text-muted-foreground text-[11px] mb-1">
                    <Mail className="h-3.5 w-3.5" />
                    <span>Billing Notification Email</span>
                  </div>
                  <p className="font-mono text-xs font-semibold text-foreground truncate">
                    {profile?.email || session.email}
                  </p>
                </div>

                <div className="p-3 bg-muted/30 rounded-lg border">
                  <div className="flex items-center gap-2 text-muted-foreground text-[11px] mb-1">
                    <Phone className="h-3.5 w-3.5" />
                    <span>Contact Phone</span>
                  </div>
                  <p className="font-mono text-xs font-semibold text-foreground">
                    {profile?.phone || "Not specified"}
                  </p>
                </div>

                <div className="p-3 bg-muted/30 rounded-lg border">
                  <div className="flex items-center gap-2 text-muted-foreground text-[11px] mb-1">
                    <CreditCard className="h-3.5 w-3.5" />
                    <span>Default Currency</span>
                  </div>
                  <p className="font-mono text-xs font-semibold text-foreground">
                    {profile?.currencyCode || "USD"}
                  </p>
                </div>

                <div className="p-3 bg-muted/30 rounded-lg border">
                  <div className="flex items-center gap-2 text-muted-foreground text-[11px] mb-1">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>Account Status</span>
                  </div>
                  <p className="font-semibold text-xs text-emerald-600 dark:text-emerald-400">
                    Active &amp; In Good Standing
                  </p>
                </div>
              </div>

              {/* Billing Address Sub-section */}
              <div className="pt-2">
                <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-primary" /> Billing Address
                </h4>
                <div className="p-3 bg-muted/20 rounded-lg border text-xs space-y-1">
                  {profile?.billingAddressLine1 ? (
                    <>
                      <p className="font-medium text-foreground">{profile.billingAddressLine1}</p>
                      {profile.billingAddressLine2 && (
                        <p className="text-muted-foreground">{profile.billingAddressLine2}</p>
                      )}
                      <p className="text-muted-foreground">
                        {[profile.billingCity, profile.billingState, profile.billingPostalCode]
                          .filter(Boolean)
                          .join(", ")}
                      </p>
                      {profile.billingCountry && (
                        <p className="text-muted-foreground font-medium">{profile.billingCountry}</p>
                      )}
                    </>
                  ) : (
                    <p className="text-muted-foreground italic">
                      No physical billing address recorded. Invoices will be issued electronically to {profile?.email || session.email}.
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Security & Multi-Tenant Scoping Card */}
          <Card className="border-border/80">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                Security &amp; Scope
              </CardTitle>
              <CardDescription className="text-xs">
                Row-Level Security (RLS) tenant isolation parameters
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <div>
                <span className="text-[11px] text-muted-foreground block">Customer Account ID</span>
                <span className="font-mono text-[11px] text-foreground bg-muted px-2 py-1 rounded block truncate mt-0.5">
                  {customerId || "Unmapped"}
                </span>
              </div>

              <div>
                <span className="text-[11px] text-muted-foreground block">User Authentication ID</span>
                <span className="font-mono text-[11px] text-foreground bg-muted px-2 py-1 rounded block truncate mt-0.5">
                  {session.id}
                </span>
              </div>

              <div>
                <span className="text-[11px] text-muted-foreground block">Assigned RBAC Role</span>
                <Badge variant="default" className="text-[10px] uppercase font-mono mt-1">
                  {session.role}
                </Badge>
              </div>

              <div className="pt-3 border-t text-[11px] text-muted-foreground space-y-1.5">
                <div className="flex items-start gap-1.5">
                  <Key className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                  <span>
                    Your session is authorized strictly for records associated with customer ID{" "}
                    <code className="text-foreground">{profile?.customerCode || "your account"}</code>.
                  </span>
                </div>
                <div className="flex items-start gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <span>Cross-customer record access is prevented at the PostgreSQL engine level.</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </CustomerShell>
  );
}
