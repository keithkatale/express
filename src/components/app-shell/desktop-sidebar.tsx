"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { accountantNav, isNavActive, parentNav } from "./nav-items";

export function DesktopSidebar({ role }: { role: "parent" | "secretary" | "admin" }) {
  const pathname = usePathname();
  const items = role === "parent" ? parentNav : accountantNav;
  const title = "Benchmark Express";

  return (
    <aside className="app-desktop-sidebar hidden md:flex">
      <div className="app-desktop-sidebar-inner">
        <p className="app-desktop-sidebar-brand">{title}</p>
        <nav className="app-desktop-sidebar-nav" aria-label="Main navigation">
          {items.map((item) => {
            const active = isNavActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn("app-desktop-sidebar-item", active && "app-desktop-sidebar-item--active")}
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
