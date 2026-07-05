import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { UserRole } from "@/types/database";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const metadataRole = user.user_metadata?.role as UserRole | undefined;
  const role = (profile?.role ?? metadataRole ?? "parent") as UserRole;

  return NextResponse.json({
    role,
    fullName: profile?.full_name ?? user.user_metadata?.full_name ?? "",
  });
}
