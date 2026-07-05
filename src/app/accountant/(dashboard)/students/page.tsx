import Link from "next/link";
import { PageStack } from "@/components/layout/page-container";
import { SecretaryStudentsClient } from "./secretary-students-client";
import { AccountantHomeHeader } from "../accountant-home-header";
import { getAllStudents } from "@/lib/ledger/service";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function AccountantStudentsPage() {
  const supabase = await createSupabaseServerClient();
  const students = await getAllStudents(supabase);

  return (
    <PageStack>
      <AccountantHomeHeader />

      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="page-title">Students</h1>
          <p className="page-subtitle mt-1">School profiles — parents link their accounts during signup</p>
        </div>
        <Link href="/accountant/students/new" className="btn-primary shrink-0 px-4 py-2 text-sm">
          Add student
        </Link>
      </div>
      <SecretaryStudentsClient initialStudents={students} />
    </PageStack>
  );
}
