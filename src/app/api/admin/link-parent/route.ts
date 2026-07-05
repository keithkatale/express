import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

async function requireStaff() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || (profile.role !== "secretary" && profile.role !== "admin")) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { user };
}

export async function POST(request: Request) {
  const staff = await requireStaff();
  if ("error" in staff && staff.error) return staff.error;

  const body = await request.json();
  const parentEmail = String(body.parentEmail ?? "").trim().toLowerCase();
  const studentId = String(body.studentId ?? "").trim();

  if (!parentEmail || !studentId) {
    return NextResponse.json({ error: "Missing parentEmail or studentId" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();

  const { data: usersData, error: usersError } = await admin.auth.admin.listUsers();
  if (usersError) {
    return NextResponse.json({ error: usersError.message }, { status: 400 });
  }

  const parentUser = usersData.users.find(
    (u) => u.email?.toLowerCase() === parentEmail
  );

  if (!parentUser) {
    return NextResponse.json({ error: "Parent account not found for that email" }, { status: 404 });
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", parentUser.id)
    .single();

  if (profile?.role !== "parent") {
    return NextResponse.json({ error: "That account is not a parent" }, { status: 400 });
  }

  const { error } = await admin.from("parent_students").upsert({
    parent_id: parentUser.id,
    student_id: studentId,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
