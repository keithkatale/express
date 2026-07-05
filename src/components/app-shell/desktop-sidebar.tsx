"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AppLogo } from "@/components/branding/app-logo";
import { NavBadge } from "@/components/ui/nav-badge";
import { usePendingDeposits } from "@/hooks/use-pending-deposits";
import { cn } from "@/lib/utils";
import { accountantNav, isNavActive, parentNav } from "./nav-items";

export function DesktopSidebar({ role }: { role: "parent" | "secretary" | "admin" }) {
  const pathname = usePathname();
  const isStaff = role === "secretary" || role === "admin";
  const items = isStaff ? accountantNav : parentNav;
  const pending = usePendingDeposits();
  const title = "Benchmark Express";

  return (
    <aside className="app-desktop-sidebar hidden md:flex">
      <div className="app-desktop-sidebar-inner">
        <div className="app-desktop-sidebar-brand">
          <AppLogo size={32} className="shrink-0" />
          <span>{title}</span>
        </div>
        <nav className="app-desktop-sidebar-nav" aria-label="Main navigation">
          {items.map((item) => {
            const active = isNavActive(pathname, item.href);
            const Icon = item.icon;
            const badgeCount =
              item.pendingBadge && pending.total > 0 ? pending.total : 0;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn("app-desktop-sidebar-item", active && "app-desktop-sidebar-item--active")}
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span className="flex-1">{item.label}</span>
                <NavBadge count={badgeCount} pulse />
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
