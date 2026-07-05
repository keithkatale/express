import { config } from "dotenv";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

config({ path: resolve(process.cwd(), ".env.local") });
config();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function ensureUser(email: string, password: string, fullName: string, role: string) {
  const { data: existing } = await admin.auth.admin.listUsers();
  const found = existing.users.find((u) => u.email === email);

  if (found) {
    await admin.from("profiles").update({ role, full_name: fullName }).eq("id", found.id);
    return found.id;
  }

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, role },
  });

  if (error || !data.user) throw error ?? new Error("Failed to create user");
  return data.user.id;
}

async function main() {
  const parentId = await ensureUser(
    "parent@schoolpurse.test",
    "password123",
    "Grace Nakato",
    "parent"
  );
  const secretaryId = await ensureUser(
    "secretary@schoolpurse.test",
    "password123",
    "Sarah Bursar",
    "secretary"
  );

  void secretaryId;

  const students = [
    { full_name: "Joel Nakato", class_name: "S.3 Blue", admission_no: "ADM-2024-001" },
    { full_name: "Amina Okello", class_name: "S.2 Green", admission_no: "ADM-2024-002" },
    { full_name: "Brian Mugisha", class_name: "S.4 Red", admission_no: "ADM-2024-003" },
  ];

  const studentRows = [];
  for (const student of students) {
    const [{ data: studentCode }, { data: slug }] = await Promise.all([
      admin.rpc("generate_unique_student_code"),
      admin.rpc("generate_unique_student_slug", { base_name: student.full_name }),
    ]);

    const { data, error } = await admin
      .from("students")
      .upsert(
        {
          ...student,
          student_code: studentCode,
          slug,
        },
        { onConflict: "admission_no" }
      )
      .select()
      .single();
    if (error) throw error;
    studentRows.push(data);
  }

  await admin.from("parent_students").upsert({
    parent_id: parentId,
    student_id: studentRows[0].id,
  });

  await admin.from("ledger_entries").delete().neq("id", "00000000-0000-0000-0000-000000000000");

  await admin.from("ledger_entries").insert([
    {
      student_id: studentRows[0].id,
      entry_type: "deposit",
      amount: 150000,
      status: "confirmed",
      note: "Opening balance",
      created_by: secretaryId,
      confirmed_by: secretaryId,
    },
    {
      student_id: studentRows[1].id,
      entry_type: "deposit",
      amount: 80000,
      status: "confirmed",
      note: "Term opening",
      created_by: secretaryId,
      confirmed_by: secretaryId,
    },
    {
      student_id: studentRows[1].id,
      entry_type: "withdrawal",
      amount: 20000,
      status: "confirmed",
      note: "Stationery",
      created_by: secretaryId,
      confirmed_by: secretaryId,
    },
  ]);

  console.log("Seed complete.");
  console.log("Parent: parent@schoolpurse.test / password123");
  console.log("Secretary: secretary@schoolpurse.test / password123");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
