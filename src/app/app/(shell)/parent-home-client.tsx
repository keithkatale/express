"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { StudentCard } from "@/components/ui/money-ui";
import { useLedgerRealtime } from "@/hooks/use-ledger-realtime";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { StudentSummary } from "@/types/database";

export function ParentHomeClient({ initialStudents }: { initialStudents: StudentSummary[] }) {
  const [students, setStudents] = useState(initialStudents);

  const refresh = useCallback(async () => {
    const supabase = createSupabaseBrowserClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: links } = await supabase
      .from("parent_students")
      .select("student_id")
      .eq("parent_id", user.id);

    if (!links?.length) return;

    const { data } = await supabase
      .from("student_summary")
      .select("*")
      .in(
        "id",
        links.map((l) => l.student_id)
      )
      .order("full_name");

    if (data) setStudents(data as StudentSummary[]);
  }, []);

  useLedgerRealtime(refresh);

  return (
    <div className="grid gap-2 md:grid-cols-2 md:gap-3">
      {students.map((student) => (
        <StudentCard
          key={student.id}
          name={student.full_name}
          className={student.class_name}
          balance={student.balance}
          studentCode={student.student_code}
          slug={student.slug}
          admissionNo={student.admission_no}
          href={`/app/student/${student.id}`}
          action={
            <Link href={`/app/send?student=${student.id}`} className="btn-secondary px-4 py-2 text-sm">
              Send
            </Link>
          }
        />
      ))}
    </div>
  );
}
