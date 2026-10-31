"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Zap,
  LayoutDashboard,
  Repeat,
  Receipt,
  FileText,
  CreditCard,
  UserCheck,
  LogOut,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { logoutAction } from "@/features/auth/actions";
import type { UserSession } from "@/types";

interface CustomerShellProps {
  userSession: UserSession;
  children: React.ReactNode;
}

export function CustomerShell({ userSession, children }: CustomerShellProps) {
  const pathname = usePathname();
  const [loggingOut, setLoggingOut] = React.useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    await logoutAction();
  }

  const portalNav = [
    { title: "Dashboard", href: "/portal", icon: LayoutDashboard },
    { title: "My Subscriptions", href: "/portal/subscriptions", icon: Repeat },
    { title: "My Quotations", href: "/portal/quotations", icon: FileText },
    { title: "My Invoices", href: "/portal/invoices", icon: Receipt },
    { title: "Payment History", href: "/portal/payments", icon: CreditCard },
    { title: "Account Profile", href: "/portal/profile", icon: UserCheck },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Customer Header */}
      <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b bg-card/95 px-4 backdrop-blur sm:px-6">
        <div className="flex items-center gap-3">
          <Link href="/portal" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Zap className="h-4 w-4" />
            </div>
            <div className="flex flex-col">
              <span className="text-base font-bold text-foreground leading-none">
                Brightloop
              </span>
              <span className="text-[10px] text-muted-foreground font-medium mt-0.5">
                Customer Portal
              </span>
            </div>
          </Link>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-3">
          <Badge
            variant="outline"
            className="hidden sm:inline-flex gap-1.5 py-1 px-2.5 text-xs bg-muted/40"
          >
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Customer Isolation Active</span>
          </Badge>

          {/* User Profile Info */}
          <div className="flex items-center gap-2 pl-2 border-l">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-secondary-foreground font-semibold text-xs border">
              {userSession.fullName
                ? userSession.fullName.slice(0, 2).toUpperCase()
                : "CU"}
            </div>
            <div className="hidden md:flex flex-col text-left">
              <span className="text-xs font-semibold text-foreground leading-none">
                {userSession.fullName || "Subscriber"}
              </span>
              <span className="text-[10px] text-muted-foreground mt-0.5">
                {userSession.email}
              </span>
            </div>
          </div>

          {/* Logout Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            disabled={loggingOut}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            <LogOut className="h-3.5 w-3.5 mr-1.5" />
            Sign Out
          </Button>
        </div>
      </header>

      {/* Portal Navigation Bar */}
      <div className="border-b bg-card px-4 sm:px-6">
        <div className="mx-auto max-w-7xl flex gap-4 overflow-x-auto">
          {portalNav.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2 py-3 px-1 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  isActive
                    ? "border-primary text-foreground font-semibold"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{item.title}</span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-7xl">{children}</div>
      </main>
    </div>
  );
}
