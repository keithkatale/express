"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { accountantNav, isNavActive, parentNav } from "./nav-items";

export function BottomNav({ role }: { role: "parent" | "secretary" | "admin" }) {
  const pathname = usePathname();
  const items = role === "parent" ? parentNav : accountantNav;

  return (
    <nav className="app-mobile-bottom-nav md:hidden" aria-label="Main navigation">
      <div className="app-mobile-bottom-nav-inner">
        {items.map((item) => {
          const active = isNavActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "app-mobile-bottom-nav-item",
                active && "app-mobile-bottom-nav-item--active"
              )}
            >
              <Icon className="h-5 w-5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
