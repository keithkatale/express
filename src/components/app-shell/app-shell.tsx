"use client";

import { BottomNav } from "./bottom-nav";
import { DesktopSidebar } from "./desktop-sidebar";
import { MobileTopMenu } from "./mobile-top-menu";
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
          <div className="flex min-w-0 flex-1 flex-col">
            {isStaff && <MobileTopMenu />}
            <main className={isStaff ? "app-main app-main--top-menu" : "app-main safe-bottom"}>
              {children}
            </main>
          </div>
        </div>
        {!isStaff && <BottomNav role={role} />}
      </div>
    </PendingDepositsProvider>
  );
}
