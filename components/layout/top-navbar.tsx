"use client";

import * as React from "react";
import Link from "next/link";
import { Menu, Bell, LogOut, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { logoutAction } from "@/features/auth/actions";
import type { UserSession } from "@/types";

interface TopNavbarProps {
  onOpenMobileNav: () => void;
  userSession?: UserSession | null;
}

export function TopNavbar({ onOpenMobileNav, userSession }: TopNavbarProps) {
  const [loggingOut, setLoggingOut] = React.useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    await logoutAction();
  }

  const role = userSession?.role || "admin";
  const userInitials = userSession?.fullName
    ? userSession.fullName.slice(0, 2).toUpperCase()
    : userSession?.email
    ? userSession.email.slice(0, 2).toUpperCase()
    : "AD";

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b bg-card/95 px-4 backdrop-blur sm:px-6">
      {/* Left side: Mobile menu toggle & title */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={onOpenMobileNav}
          className="md:hidden h-9 w-9 text-muted-foreground hover:text-foreground"
          aria-label="Open mobile navigation"
        >
          <Menu className="h-5 w-5" />
        </Button>

        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground hidden sm:inline-block">
            Console
          </span>
          <span className="text-muted-foreground hidden sm:inline-block">/</span>
          <h1 className="text-sm font-semibold text-foreground">
            Subscription Management
          </h1>
        </div>
      </div>

      {/* Right side: Environment indicator & actions */}
      <div className="flex items-center gap-3">
        {/* Phase Status Pill */}
        <Badge
          variant="outline"
          className="gap-1.5 font-normal text-xs py-1 px-2.5 hidden sm:inline-flex bg-muted/50 border-border"
        >
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-medium text-foreground">Phase 1</span>
          <span className="text-muted-foreground">Auth & RBAC</span>
        </Badge>

        {/* Notifications Icon Button */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
        </Button>

        {/* User Profile Pill or Sign In Link */}
        {userSession ? (
          <div className="flex items-center gap-2 pl-2 border-l">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-xs border border-primary/20">
              {userInitials}
            </div>
            <div className="hidden lg:flex flex-col text-left">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold leading-none text-foreground">
                  {userSession.fullName || "User"}
                </span>
                <Badge
                  variant={role === "admin" ? "default" : "secondary"}
                  className="text-[9px] uppercase px-1 py-0 h-4 font-bold"
                >
                  {role}
                </Badge>
              </div>
              <span className="text-[10px] text-muted-foreground mt-0.5 truncate max-w-[140px]">
                {userSession.email}
              </span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              disabled={loggingOut}
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              title="Sign Out"
              aria-label="Sign Out"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2 pl-2 border-l">
            <Link href="/login">
              <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8">
                <LogIn className="h-3.5 w-3.5" />
                Sign In
              </Button>
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
