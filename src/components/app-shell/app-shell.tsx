"use client";

import { BottomNav } from "./bottom-nav";
import { DesktopSidebar } from "./desktop-sidebar";
import { PendingDepositsProvider } from "@/hooks/use-pending-deposits";
import type { UserRole } from "@/types/database";

export function AppShell({
  children,
  role,
}: {
  children: React.ReactNode;
  role: UserRole;
}) {
  const isStaff = role === "secretary" || role === "admin";

  return (
    <PendingDepositsProvider enabled={isStaff}>
      <div className="app-shell">
        <div className="app-shell-frame">
          <DesktopSidebar role={role} />
          <main className="app-main safe-bottom">{children}</main>
        </div>
        <BottomNav role={role} />
      </div>
    </PendingDepositsProvider>
  );
}
