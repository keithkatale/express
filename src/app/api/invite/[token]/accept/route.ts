import { NextResponse } from "next/server";
import { phoneToAuthEmail } from "@/lib/auth-identifier";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type Params = { params: Promise<{ token: string }> };

export async function POST(request: Request, { params }: Params) {
  const { token } = await params;
  if (!token) {
    return NextResponse.json({ error: "Missing invite token." }, { status: 400 });
  }

  const body = await request.json();
  const fullName = String(body.fullName ?? "").trim();
  const password = String(body.password ?? "");

  if (!fullName) {
    return NextResponse.json({ error: "Enter your full name." }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const { data: invite, error } = await admin
    .from("parent_invites")
    .select("*")
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

  const email =
    invite.email?.toLowerCase() ??
    (invite.phone ? phoneToAuthEmail(invite.phone) : null);

  if (!email) {
    return NextResponse.json({ error: "Invite is missing contact details." }, { status: 400 });
  }

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      role: "parent",
      phone: invite.phone ?? undefined,
    },
  });

  if (createError || !created.user) {
    return NextResponse.json(
      { error: createError?.message ?? "Could not create account." },
      { status: 400 }
    );
  }

  const userId = created.user.id;

  if (invite.phone) {
    await admin.from("profiles").update({ phone: invite.phone, full_name: fullName }).eq("id", userId);
  } else {
    await admin.from("profiles").update({ full_name: fullName }).eq("id", userId);
  }

  const { error: linkError } = await admin.from("parent_students").upsert({
    parent_id: userId,
    student_id: invite.student_id,
  });

  if (linkError) {
    return NextResponse.json({ error: linkError.message }, { status: 400 });
  }

  const { error: consumeError } = await admin
    .from("parent_invites")
    .update({
      consumed_at: new Date().toISOString(),
      consumed_by: userId,
    })
    .eq("id", invite.id)
    .is("consumed_at", null);

  if (consumeError) {
    return NextResponse.json({ error: consumeError.message }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    email,
    fullName,
  });
}
