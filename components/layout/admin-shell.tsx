"use client";

import * as React from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { TopNavbar } from "@/components/layout/top-navbar";
import { MobileNav } from "@/components/layout/mobile-nav";
import type { UserSession } from "@/types";

interface AdminShellProps {
  children: React.ReactNode;
  userSession?: UserSession | null;
}

export function AdminShell({ children, userSession }: AdminShellProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);

  const toggleSidebar = React.useCallback(() => {
    setSidebarCollapsed((prev) => !prev);
  }, []);

  const openMobileNav = React.useCallback(() => {
    setMobileNavOpen(true);
  }, []);

  const closeMobileNav = React.useCallback(() => {
    setMobileNavOpen(false);
  }, []);

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggleCollapse={toggleSidebar}
        userSession={userSession}
      />

      {/* Mobile Drawer */}
      <MobileNav
        open={mobileNavOpen}
        onClose={closeMobileNav}
        userSession={userSession}
      />

      {/* Main Container */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Top Navbar */}
        <TopNavbar
          onOpenMobileNav={openMobileNav}
          userSession={userSession}
        />

        {/* Main Scrollable Content Area */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
