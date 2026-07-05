import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isValidClassName } from "@/lib/school-classes";

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
  const fullName = String(body.fullName ?? "").trim();
  const className = String(body.className ?? "").trim();

  if (!fullName || !className) {
    return NextResponse.json({ error: "Name and class are required" }, { status: 400 });
  }

  if (!isValidClassName(className)) {
    return NextResponse.json({ error: "Select a valid senior class and stream" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const [{ data: studentCode, error: codeError }, { data: slug, error: slugError }] =
    await Promise.all([
      admin.rpc("generate_unique_student_code"),
      admin.rpc("generate_unique_student_slug", { base_name: fullName }),
    ]);

  if (codeError || slugError || !studentCode || !slug) {
    return NextResponse.json(
      { error: codeError?.message ?? slugError?.message ?? "Could not generate student ID" },
      { status: 400 }
    );
  }

  const { data, error } = await admin
    .from("students")
    .insert({
      full_name: fullName,
      class_name: className,
      admission_no: studentCode,
      student_code: studentCode,
      slug,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ student: data });
}
