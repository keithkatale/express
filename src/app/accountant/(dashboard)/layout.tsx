import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell/app-shell";
import { getProfile } from "@/lib/ledger/service";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function AccountantDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/accountant");

  const profile = await getProfile(supabase, user.id);
  if (profile.role === "parent") redirect("/app");

  return <AppShell role={profile.role}>{children}</AppShell>;
}
