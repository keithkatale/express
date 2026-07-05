import { AppShell } from "@/components/app-shell/app-shell";

export default function ParentShellLayout({ children }: { children: React.ReactNode }) {
  return <AppShell role="parent">{children}</AppShell>;
}
