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
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { UserSession, UserRole } from "@/types";

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  phase?: string;
  roles?: UserRole[];
}

const mainNavItems: NavItem[] = [
  {
    title: "Dashboard",
    href: "/",
    icon: LayoutDashboard,
    roles: ["admin", "staff"],
  },
  {
    title: "Customers",
    href: "/customers",
    icon: Users,
    phase: "Phase 1",
    roles: ["admin", "staff"],
  },
  {
    title: "Staff Accounts",
    href: "/staff",
    icon: UserCheck,
    phase: "Phase 1",
    roles: ["admin"], // Admin-only staff management!
  },
  {
    title: "Products & Variants",
    href: "/products",
    icon: Package,
    phase: "Phase 2",
    roles: ["admin", "staff"],
  },
  {
    title: "Subscription Plans",
    href: "/plans",
    icon: Layers,
    phase: "Phase 2",
    roles: ["admin", "staff"],
  },
  {
    title: "Tax Rules",
    href: "/taxes",
    icon: Receipt,
    phase: "Phase 2",
    roles: ["admin", "staff"],
  },
  {
    title: "Discounts",
    href: "/discounts",
    icon: Percent,
    phase: "Phase 2",
    roles: ["admin", "staff"],
  },
  {
    title: "Quotations",
    href: "/quotations",
    icon: FileSpreadsheet,
    phase: "Phase 3",
    roles: ["admin", "staff"],
  },
  {
    title: "Subscriptions",
    href: "/subscriptions",
    icon: Repeat,
    phase: "Phase 3",
    roles: ["admin", "staff"],
  },
  {
    title: "Billing & Invoices",
    href: "/billing",
    icon: Receipt,
    phase: "Phase 4",
    roles: ["admin", "staff"],
  },
  {
    title: "Payments",
    href: "/payments",
    icon: CreditCard,
    phase: "Phase 4",
    roles: ["admin", "staff"],
  },
];

const secondaryNavItems: NavItem[] = [
  {
    title: "Settings",
    href: "/settings",
    icon: Settings,
    roles: ["admin"],
  },
];

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  userSession?: UserSession | null;
}

export function Sidebar({ collapsed, onToggleCollapse, userSession }: SidebarProps) {
  const pathname = usePathname();
  const currentRole = userSession?.role || "admin";

  const filteredMainNav = mainNavItems.filter(
    (item) => !item.roles || item.roles.includes(currentRole)
  );

  const filteredSecondaryNav = secondaryNavItems.filter(
    (item) => !item.roles || item.roles.includes(currentRole)
  );

  return (
    <aside
      className={cn(
        "hidden md:flex flex-col border-r bg-card transition-all duration-300 ease-in-out select-none",
        collapsed ? "w-18" : "w-64"
      )}
      aria-label="Sidebar Navigation"
    >
      {/* Brand Header */}
      <div className="flex h-16 items-center justify-between px-4 border-b">
        <Link
          href="/"
          className={cn(
            "flex items-center gap-2.5 font-semibold text-foreground overflow-hidden",
            collapsed && "justify-center w-full"
          )}
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
            <Zap className="h-5 w-5" />
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="text-base font-bold tracking-tight text-foreground leading-none">
                Brightloop
              </span>
              <span className="text-[11px] font-medium text-muted-foreground mt-0.5">
                Subscription Engine
              </span>
            </div>
          )}
        </Link>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        <div className="space-y-1">
          {!collapsed && (
            <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80 mb-2">
              Operations
            </p>
          )}
          {filteredMainNav.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-accent text-accent-foreground font-semibold"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  collapsed && "justify-center px-2"
                )}
                title={collapsed ? item.title : undefined}
              >
                <Icon
                  className={cn(
                    "h-4 w-4 shrink-0 transition-colors",
                    isActive
                      ? "text-primary"
                      : "text-muted-foreground group-hover:text-foreground"
                  )}
                />
                {!collapsed && (
                  <span className="truncate flex-1">{item.title}</span>
                )}
                {!collapsed && item.phase && (
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground/80 border border-border/50">
                    {item.phase}
                  </span>
                )}
              </Link>
            );
          })}
        </div>

        {filteredSecondaryNav.length > 0 && (
          <div className="space-y-1 pt-2 border-t">
            {!collapsed && (
              <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80 mb-2">
                Administration
              </p>
            )}
            {filteredSecondaryNav.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-accent text-accent-foreground font-semibold"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    collapsed && "justify-center px-2"
                  )}
                  title={collapsed ? item.title : undefined}
                >
                  <Icon
                    className={cn(
                      "h-4 w-4 shrink-0 transition-colors",
                      isActive
                        ? "text-primary"
                        : "text-muted-foreground group-hover:text-foreground"
                    )}
                  />
                  {!collapsed && (
                    <span className="truncate flex-1">{item.title}</span>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Collapse Toggle Footer */}
      <div className="p-3 border-t bg-muted/30 flex items-center justify-between">
        {!collapsed && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground px-2">
            <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <span className="font-medium">Odoo Hackathon</span>
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleCollapse}
          className={cn(
            "h-8 w-8 text-muted-foreground hover:text-foreground",
            collapsed && "mx-auto"
          )}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
      </div>
    </aside>
  );
}
