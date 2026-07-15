import { NextResponse } from "next/server";
import { maskContact } from "@/lib/auth-identifier";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type Params = { params: Promise<{ token: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { token } = await params;
  if (!token) {
    return NextResponse.json({ error: "Missing invite token." }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const { data: invite, error } = await admin
    .from("parent_invites")
    .select("id, email, phone, parent_name, expires_at, consumed_at, student:students(id, full_name, class_name)")
    .eq("token", token)
    .maybeSingle();

  if (error || !invite) {
    return NextResponse.json({ error: "Invite not found." }, { status: 404 });
  }

  if (invite.consumed_at) {
    return NextResponse.json({ error: "This invite has already been used." }, { status: 410 });
  }

  if (new Date(invite.expires_at).getTime() < Date.now()) {
    return NextResponse.json({ error: "This invite has expired." }, { status: 410 });
  }

  const student = invite.student as unknown as {
    id: string;
    full_name: string;
    class_name: string;
  } | null;

  return NextResponse.json({
    parentName: invite.parent_name,
    contactMasked: maskContact(invite.email, invite.phone),
    contactKind: invite.email ? "email" : "phone",
    studentName: student?.full_name ?? "your child",
    studentClass: student?.class_name ?? null,
  });
}
