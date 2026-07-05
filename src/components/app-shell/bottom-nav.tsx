"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NavBadge } from "@/components/ui/nav-badge";
import { usePendingDeposits } from "@/hooks/use-pending-deposits";
import { cn } from "@/lib/utils";
import { accountantNav, isNavActive, parentNav } from "./nav-items";

function navBadgeCount(
  href: string,
  total: number,
  pendingBadge?: boolean
): number {
  if (!pendingBadge || total <= 0) return 0;
  return total;
}

export function BottomNav({ role }: { role: "parent" | "secretary" | "admin" }) {
  const pathname = usePathname();
  const isStaff = role === "secretary" || role === "admin";
  const items = isStaff ? accountantNav : parentNav;
  const pending = usePendingDeposits();

  return (
    <nav className="app-mobile-bottom-nav md:hidden" aria-label="Main navigation">
      <div className="app-mobile-bottom-nav-inner">
        {items.map((item) => {
          const active = isNavActive(pathname, item.href);
          const Icon = item.icon;
          const badgeCount = navBadgeCount(item.href, pending.total, item.pendingBadge);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "app-mobile-bottom-nav-item",
                active && "app-mobile-bottom-nav-item--active"
              )}
            >
              <span className="relative">
                <Icon className="h-5 w-5" />
                <NavBadge count={badgeCount} className="absolute -right-2 -top-1.5" pulse />
              </span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
