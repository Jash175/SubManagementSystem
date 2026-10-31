"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  Layers,
  Users,
  FileSpreadsheet,
  Repeat,
  Receipt,
  CreditCard,
  Percent,
  Settings,
  UserCheck,
  X,
  Zap,
  LogOut,
  LogIn,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { logoutAction } from "@/features/auth/actions";
import type { UserSession, UserRole } from "@/types";

const allNavItems: {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  phase?: string;
  roles?: UserRole[];
}[] = [
  { title: "Dashboard", href: "/", icon: LayoutDashboard, roles: ["admin", "staff"] },
  { title: "Customers", href: "/customers", icon: Users, phase: "Phase 1", roles: ["admin", "staff"] },
  { title: "Staff Accounts", href: "/staff", icon: UserCheck, phase: "Phase 1", roles: ["admin"] },
  { title: "Products & Variants", href: "/products", icon: Package, phase: "Phase 2", roles: ["admin", "staff"] },
  { title: "Subscription Plans", href: "/plans", icon: Layers, phase: "Phase 2", roles: ["admin", "staff"] },
  { title: "Tax Rules", href: "/taxes", icon: Receipt, phase: "Phase 2", roles: ["admin", "staff"] },
  { title: "Discounts", href: "/discounts", icon: Percent, phase: "Phase 2", roles: ["admin", "staff"] },
  { title: "Quotations", href: "/quotations", icon: FileSpreadsheet, phase: "Phase 3", roles: ["admin", "staff"] },
  { title: "Subscriptions", href: "/subscriptions", icon: Repeat, phase: "Phase 3", roles: ["admin", "staff"] },
  { title: "Billing & Invoices", href: "/billing", icon: Receipt, phase: "Phase 4", roles: ["admin", "staff"] },
  { title: "Payments", href: "/payments", icon: CreditCard, phase: "Phase 4", roles: ["admin", "staff"] },
  { title: "Settings", href: "/settings", icon: Settings, roles: ["admin"] },
];

interface MobileNavProps {
  open: boolean;
  onClose: () => void;
  userSession?: UserSession | null;
}

export function MobileNav({ open, onClose, userSession }: MobileNavProps) {
  const pathname = usePathname();
  const [loggingOut, setLoggingOut] = React.useState(false);

  const currentRole = userSession?.role || "admin";
  const navItems = allNavItems.filter(
    (item) => !item.roles || item.roles.includes(currentRole)
  );

  React.useEffect(() => {
    onClose();
  }, [pathname, onClose]);

  React.useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) return null;

  async function handleLogout() {
    setLoggingOut(true);
    await logoutAction();
  }

  return (
    <div className="fixed inset-0 z-50 md:hidden" aria-modal="true" role="dialog">
      <div
        className="fixed inset-0 bg-background/80 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="fixed inset-y-0 left-0 z-50 w-72 bg-card border-r shadow-xl flex flex-col p-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Zap className="h-4 w-4" />
            </div>
            <div>
              <span className="text-base font-bold text-foreground">Brightloop</span>
              <p className="text-[11px] text-muted-foreground">Subscription Platform</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Close menu"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* User Info */}
        {userSession ? (
          <div className="p-3 my-2 rounded-md bg-muted/40 flex items-center justify-between">
            <div className="overflow-hidden">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-foreground truncate">
                  {userSession.fullName || "User"}
                </span>
                <Badge variant="default" className="text-[9px] uppercase px-1 py-0">
                  {userSession.role}
                </Badge>
              </div>
              <p className="text-[10px] text-muted-foreground truncate">
                {userSession.email}
              </p>
            </div>
          </div>
        ) : (
          <div className="my-2">
            <Link href="/login" className="w-full">
              <Button size="sm" variant="outline" className="w-full justify-center gap-1.5 text-xs">
                <LogIn className="h-3.5 w-3.5" />
                Sign In
              </Button>
            </Link>
          </div>
        )}

        {/* Links */}
        <nav className="flex-1 overflow-y-auto py-2 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-accent text-accent-foreground font-semibold"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <div className="flex items-center gap-3">
                  <Icon className={cn("h-4 w-4", isActive ? "text-primary" : "text-muted-foreground")} />
                  <span>{item.title}</span>
                </div>
                {item.phase && (
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border/50">
                    {item.phase}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer with Logout */}
        <div className="pt-4 border-t space-y-2">
          {userSession && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              disabled={loggingOut}
              className="w-full justify-center text-xs text-muted-foreground hover:text-destructive"
            >
              <LogOut className="h-3.5 w-3.5 mr-1.5" />
              Sign Out
            </Button>
          )}
          <p className="text-[10px] text-center text-muted-foreground">
            Odoo × Lucknow Hackathon • Phase 1
          </p>
        </div>
      </div>
    </div>
  );
}
