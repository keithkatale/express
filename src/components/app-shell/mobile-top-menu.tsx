"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Menu, X } from "lucide-react";
import { AppLogo } from "@/components/branding/app-logo";
import { NavBadge } from "@/components/ui/nav-badge";
import { usePendingDeposits } from "@/hooks/use-pending-deposits";
import { cn } from "@/lib/utils";
import { accountantNav, isNavActive } from "./nav-items";

/**
 * Mobile-only top bar for staff: logo on the left, expandable menu on the right.
 * Replaces the bottom tab bar for the accountant dashboard.
 */
export function MobileTopMenu() {
  const pathname = usePathname();
  const pending = usePendingDeposits();
  // Remember which page the menu was opened on; navigating elsewhere closes it.
  const [openPath, setOpenPath] = useState<string | null>(null);
  const open = openPath === pathname;
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpenPath(null);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenPath(null);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <header
      ref={rootRef}
      className="sticky top-0 z-40 border-b border-[var(--app-divider)] bg-[var(--app-mobile-nav-bar-bg)] md:hidden"
      style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
    >
      <div className="flex h-14 items-center justify-between px-3">
        <Link href="/accountant/students" className="flex items-center gap-2">
          <AppLogo size={32} className="shrink-0" />
          <span className="text-sm font-semibold text-[var(--app-text-primary)]">
            Benchmark Express
          </span>
        </Link>

        <button
          type="button"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          aria-controls="mobile-top-menu"
          onClick={() => setOpenPath(open ? null : pathname)}
          className="relative flex h-10 w-10 items-center justify-center rounded-full text-[var(--app-text-primary)] transition-colors hover:bg-[var(--app-divider)]"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          {!open && pending.total > 0 && (
            <NavBadge count={pending.total} className="absolute -right-0.5 -top-0.5" pulse />
          )}
        </button>
      </div>

      {open && (
        <nav
          id="mobile-top-menu"
          aria-label="Main navigation"
          className="absolute right-2 top-full mt-1 w-56 overflow-hidden rounded-2xl border border-[var(--app-divider)] bg-[var(--app-mobile-nav-bar-bg)] p-1.5 shadow-lg"
        >
          {accountantNav.map((item) => {
            const active = isNavActive(pathname, item.href);
            const Icon = item.icon;
            const badgeCount = item.pendingBadge && pending.total > 0 ? pending.total : 0;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpenPath(null)}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors",
                  active
                    ? "bg-[image:var(--app-mobile-nav-active-bg)] text-[var(--app-mobile-nav-active-fg)]"
                    : "text-[var(--app-text-secondary)] hover:bg-[var(--app-divider)]"
                )}
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span className="flex-1">{item.label}</span>
                <NavBadge count={badgeCount} pulse />
              </Link>
            );
          })}
        </nav>
      )}
    </header>
  );
}
