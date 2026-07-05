import { PageStack } from "@/components/layout/page-container";
import { SecretaryStudentsClient } from "./secretary-students-client";
import { getAllStudents } from "@/lib/ledger/service";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function AccountantStudentsPage() {
  const supabase = await createSupabaseServerClient();
  const students = await getAllStudents(supabase);

  return (
    <PageStack>
      <div>
        <h1 className="page-title">Students</h1>
        <p className="page-subtitle mt-1">Students with money on account</p>
      </div>
      <SecretaryStudentsClient initialStudents={students} />
    </PageStack>
  );
}
