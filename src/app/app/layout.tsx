import { redirect } from "next/navigation";
import { getProfile } from "@/lib/ledger/service";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function ParentAppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const profile = await getProfile(supabase, user.id);
  if (profile.role !== "parent") redirect("/accountant/students");

  return children;
}
