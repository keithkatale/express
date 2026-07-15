import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import {
  authEmailFromIdentifier,
  parseAuthIdentifier,
} from "@/lib/auth-identifier";
import { ugPhoneToWhatsAppPath } from "@/lib/phone-ug";
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

function appOrigin(request: Request) {
  const env = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (env) return env;
  return new URL(request.url).origin;
}

function inviteMessage(studentName: string, inviteUrl: string) {
  return `You've been invited to Benchmark Express for ${studentName}. Open this link to set your password and view their school money: ${inviteUrl}`;
}

async function findParentIdByAuthEmail(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  email: string
): Promise<string | null> {
  const target = email.toLowerCase();
  let page = 1;
  while (page <= 20) {
    const { data: listed, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) break;
    const match = listed?.users.find((u) => u.email?.toLowerCase() === target);
    if (match) return match.id;
    if (!listed?.users?.length || listed.users.length < 200) break;
    page += 1;
  }
  return null;
}

export async function POST(request: Request) {
  const staff = await requireStaff();
  if ("error" in staff && staff.error) return staff.error;

  const body = await request.json();
  const studentId = String(body.studentId ?? "").trim();
  const contact = String(body.contact ?? body.parentEmail ?? "").trim();
  const parentName = String(body.parentName ?? "").trim() || null;

  if (!studentId || !contact) {
    return NextResponse.json({ error: "Student and email or phone are required." }, { status: 400 });
  }

  const parsed = parseAuthIdentifier(contact);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();

  const { data: student, error: studentError } = await admin
    .from("students")
    .select("id, full_name")
    .eq("id", studentId)
    .maybeSingle();

  if (studentError || !student) {
    return NextResponse.json({ error: "Student not found." }, { status: 404 });
  }

  let parentId: string | null = null;

  if (parsed.value.kind === "phone") {
    const { data: byPhone } = await admin
      .from("profiles")
      .select("id, role")
      .eq("phone", parsed.value.e164)
      .maybeSingle();
    if (byPhone?.id) parentId = byPhone.id;
  }

  if (!parentId) {
    parentId = await findParentIdByAuthEmail(admin, authEmailFromIdentifier(parsed.value));
  }

  if (parentId) {
    const { data: profile } = await admin.from("profiles").select("role").eq("id", parentId).single();
    if (profile?.role !== "parent") {
      return NextResponse.json({ error: "That account is not a parent." }, { status: 400 });
    }

    const { error: linkError } = await admin.from("parent_students").upsert({
      parent_id: parentId,
      student_id: studentId,
    });

    if (linkError) {
      return NextResponse.json({ error: linkError.message }, { status: 400 });
    }

    const origin = appOrigin(request);
    const loginUrl = `${origin}/login`;
    const message = `${student.full_name} is now linked to your Benchmark Express account. Sign in here: ${loginUrl}`;
    const waDigits =
      parsed.value.kind === "phone" ? ugPhoneToWhatsAppPath(parsed.value.e164) : null;

    return NextResponse.json({
      status: "linked",
      studentName: student.full_name,
      message,
      url: loginUrl,
      whatsappUrl: waDigits
        ? `https://wa.me/${waDigits}?text=${encodeURIComponent(message)}`
        : null,
    });
  }

  const token = randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

  const { error: inviteError } = await admin.from("parent_invites").insert({
    token,
    student_id: studentId,
    email: parsed.value.kind === "email" ? parsed.value.email : null,
    phone: parsed.value.kind === "phone" ? parsed.value.e164 : null,
    parent_name: parentName,
    created_by: staff.user.id,
    expires_at: expiresAt,
  });

  if (inviteError) {
    return NextResponse.json({ error: inviteError.message }, { status: 400 });
  }

  const origin = appOrigin(request);
  const inviteUrl = `${origin}/invite/${token}`;
  const message = inviteMessage(student.full_name, inviteUrl);
  const waDigits =
    parsed.value.kind === "phone" ? ugPhoneToWhatsAppPath(parsed.value.e164) : null;

  return NextResponse.json({
    status: "invited",
    studentName: student.full_name,
    url: inviteUrl,
    message,
    whatsappUrl: waDigits
      ? `https://wa.me/${waDigits}?text=${encodeURIComponent(message)}`
      : null,
    expiresAt,
  });
}
