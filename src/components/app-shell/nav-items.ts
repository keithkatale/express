import { Activity, Clock, Home, Send, Settings, Users } from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  pendingBadge?: boolean;
};

export const parentNav: NavItem[] = [
  { href: "/app", label: "Home", icon: Home },
  { href: "/app/send", label: "Send", icon: Send },
  { href: "/app/activity", label: "Activity", icon: Activity },
  { href: "/app/settings", label: "Settings", icon: Settings },
];

export const accountantNav: NavItem[] = [
  { href: "/accountant/students", label: "Students", icon: Users, pendingBadge: true },
  { href: "/accountant/pending", label: "Pending", icon: Clock, pendingBadge: true },
  { href: "/accountant/activity", label: "Activity", icon: Activity },
  { href: "/accountant/settings", label: "Settings", icon: Settings },
];

export function isNavActive(pathname: string, href: string): boolean {
  if (href === "/app" || href === "/accountant/students") {
    return pathname === href;
  }
  return pathname.startsWith(href);
}
